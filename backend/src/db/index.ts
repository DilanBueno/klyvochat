import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { SQLJsSession, PreparedQuery } from "drizzle-orm/sql-js/session";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core/dialect";
import { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core/db";
import type { SQLJsDatabase } from "drizzle-orm/sql-js";
import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
} from "drizzle-orm/relations";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import * as schema from "./schema.js";

const require = createRequire(import.meta.url);

// ---- Sessão custom do Drizzle que sincroniza o disco após escritas ----

const WRITE_RE =
  /^\s*(insert|update|delete|replace|create|drop|alter|attach|detach|pragma|reindex|vacuum)/i;

function isWrite(sqlText: string): boolean {
  return WRITE_RE.test(sqlText);
}

class AutoSaveSession extends SQLJsSession<Record<string, unknown>, any> {
  private txDepth = 0;

  constructor(
    client: SqlJsDatabase,
    dialect: SQLiteSyncDialect,
    schemaConfig: unknown,
    private save: () => void
  ) {
    super(client, dialect, schemaConfig as never);
  }

  private maybeSave(sqlText: string) {
    // Transações raw (BEGIN/COMMIT/ROLLBACK via session.run) controlam a
    // profundidade: exportar o sql.js durante uma transação ativa quebra o estado.
    if (/^\s*(begin\b|start\s+transaction)/i.test(sqlText)) {
      this.txDepth++;
      return;
    }
    if (/^\s*(commit\b|end\b)/i.test(sqlText)) {
      this.txDepth = Math.max(0, this.txDepth - 1);
      if (this.txDepth === 0) this.save();
      return;
    }
    if (/^\s*rollback/i.test(sqlText)) {
      this.txDepth = Math.max(0, this.txDepth - 1);
      return;
    }
    if (this.txDepth === 0 && isWrite(sqlText)) this.save();
  }

  private wrap(pq: PreparedQuery<any>, sqlText: string): PreparedQuery<any> {
    const wrapped = {
      run: (pv?: Record<string, unknown>) => {
        const r = pq.run(pv);
        this.maybeSave(sqlText);
        return r;
      },
      all: (pv?: Record<string, unknown>) => {
        const r = pq.all(pv);
        this.maybeSave(sqlText);
        return r;
      },
      get: (pv?: Record<string, unknown>) => {
        const r = pq.get(pv);
        this.maybeSave(sqlText);
        return r;
      },
      values: (pv?: Record<string, unknown>) => {
        const r = pq.values(pv);
        this.maybeSave(sqlText);
        return r;
      },
      execute: (pv?: Record<string, unknown>) => {
        const r = pq.execute(pv);
        this.maybeSave(sqlText);
        return r;
      },
      free: () => pq.free(),
    };
    return wrapped as unknown as PreparedQuery<any>;
  }

  override prepareQuery(
    query: Parameters<SQLJsSession<Record<string, unknown>, any>["prepareQuery"]>[0],
    fields: Parameters<SQLJsSession<Record<string, unknown>, any>["prepareQuery"]>[1],
    executeMethod: Parameters<SQLJsSession<Record<string, unknown>, any>["prepareQuery"]>[2],
    isResponseInArrayMode: Parameters<SQLJsSession<Record<string, unknown>, any>["prepareQuery"]>[3]
  ): PreparedQuery<any> {
    const pq = super.prepareQuery(query, fields, executeMethod, isResponseInArrayMode);
    return this.wrap(pq, query.sql);
  }

  override prepareOneTimeQuery(
    query: Parameters<SQLJsSession<Record<string, unknown>, any>["prepareOneTimeQuery"]>[0],
    fields: Parameters<SQLJsSession<Record<string, unknown>, any>["prepareOneTimeQuery"]>[1],
    executeMethod: Parameters<SQLJsSession<Record<string, unknown>, any>["prepareOneTimeQuery"]>[2],
    isResponseInArrayMode: Parameters<SQLJsSession<Record<string, unknown>, any>["prepareOneTimeQuery"]>[3],
    customResultMapper?: Parameters<SQLJsSession<Record<string, unknown>, any>["prepareOneTimeQuery"]>[4]
  ): PreparedQuery<any> {
    const pq = super.prepareOneTimeQuery(
      query,
      fields,
      executeMethod,
      isResponseInArrayMode,
      customResultMapper
    );
    return this.wrap(pq, query.sql);
  }

  override transaction<T>(transaction: (tx: any) => T, config?: unknown): T {
    const result = super.transaction(transaction, config as never);
    this.save();
    return result;
  }
}

// ---- Lazy init: no top-level await so the module can be loaded via
//      require() (Hostinger / CJS loaders) without triggering
//      ERR_REQUIRE_ASYNC_MODULE. Callers must await _initDb before using db. ----

export let db: SQLJsDatabase<typeof schema>;
export let saveDb: () => void;

export const _initDb = (async () => {
  const dbPath = process.env.DATABASE_PATH || "./data/klyvochat.db";
  mkdirSync(path.dirname(dbPath), { recursive: true });

  // 1. Inicializar WASM do sql.js (100% JS, sem compilação nativa)
  const SQL = await initSqlJs({
    locateFile: () =>
      path.join(
        path.dirname(require.resolve("sql.js/dist/sql-wasm.wasm")),
        "sql-wasm.wasm"
      ),
  });

  // 2. Carregar banco do disco (se existir) ou criar em memória
  const data = existsSync(dbPath) ? readFileSync(dbPath) : null;
  const sqlite: SqlJsDatabase = data
    ? new SQL.Database(data)
    : new SQL.Database();

  sqlite.exec("PRAGMA foreign_keys = ON");

  // sql.js opera em memória: persistimos no disco após cada escrita
  const saveDbLocal = () => {
    const exported = sqlite.export();
    writeFileSync(dbPath, Buffer.from(exported));
  };

  // ---- Construir o db do Drizzle com a sessão custom ----
  const tablesConfig = extractTablesRelationalConfig(
    schema,
    createTableRelationsHelpers
  );
  const schemaConfig = {
    fullSchema: schema,
    schema: tablesConfig.tables,
    tableNamesMap: tablesConfig.tableNamesMap,
  };

  const dialect = new SQLiteSyncDialect({});
  const session = new AutoSaveSession(sqlite, dialect, schemaConfig, saveDbLocal);
  const dbInstance = new BaseSQLiteDatabase(
    "sync",
    dialect,
    session as never,
    schemaConfig as never
  ) as unknown as SQLJsDatabase<typeof schema>;

  return { db: dbInstance, saveDb: saveDbLocal };
})();

_initDb.then((ctx) => {
  db = ctx.db;
  saveDb = ctx.saveDb;
});

export type DB = typeof db;
