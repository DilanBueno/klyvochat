import { migrate } from "drizzle-orm/sql-js/migrator";
import { _initDb } from "./index.js";

async function main() {
  const { db, saveDb } = await _initDb;
  migrate(db, { migrationsFolder: "./drizzle" });
  saveDb();
  console.log("Migrações aplicadas com sucesso");
}

main().catch((err) => {
  console.error("[klyvochat] falha ao aplicar migrações:", err);
  process.exit(1);
});
