import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { createServer } from "node:http";
import { Server } from "socket.io";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import friendRoutes from "./routes/friends.js";
import roomRoutes from "./routes/rooms.js";
import { generateToken } from "./services/livekit.js";
import { setupSocket } from "./services/websocket.js";
import { authSocket } from "./middleware/auth.js";
import { _initDb } from "./db/index.js";
import { migrate } from "drizzle-orm/sql-js/migrator";

async function main() {
  const { db, saveDb } = await _initDb;

  // Migração automática (idempotente) — aplica apenas migrações pendentes.
  // Necessário para deploy em hospedagem compartilhada sem acesso CLI.
  try {
    migrate(db, { migrationsFolder: "./drizzle" });
    saveDb();
    console.log("[klyvochat] migrações automáticas aplicadas");
  } catch (err) {
    console.warn("[klyvochat] aviso: migração automática falhou (backend/drizzle ausente?)", err);
  }

  const app = express();
  const httpServer = createServer(app);

  const PORT = Number(process.env.PORT) || 3001;

  const ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "tauri://localhost",
    "http://tauri.localhost",
  ];

  function isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) return true;
    return ALLOWED_ORIGINS.some((o) => origin.startsWith(o));
  }

  app.use(
    cors({
      origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
      credentials: true,
    })
  );
  app.use(express.json());

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/livekit/token", async (req, res) => {
    const { roomId, channelId } = req.body ?? {};
    if (!roomId || !channelId) {
      return res.status(400).json({ error: "roomId e channelId são obrigatórios" });
    }
    const identity = req.user?.id
      ? String(req.user.id)
      : `anonymous-${Date.now()}`;
    const token = await generateToken(identity, `${roomId}-${channelId}`);
    res.json({ token, url: process.env.LIVEKIT_URL || "ws://localhost:7880" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/friends", friendRoutes);
  app.use("/api/rooms", roomRoutes);

  const io = new Server(httpServer, {
    cors: {
      origin: isOriginAllowed,
      credentials: true,
    },
  });

  io.use(authSocket);
  setupSocket(io);
  app.set("io", io);

  httpServer.listen(PORT, () => {
    console.log(`[klyvochat] backend rodando em http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("[klyvochat] falha fatal ao iniciar:", err);
  process.exit(1);
});