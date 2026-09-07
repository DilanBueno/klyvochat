import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { and, eq, like, ne, not, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { friendships, users } from "../db/schema.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(UPLOADS_DIR, "avatars");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${file.fieldname}-${Date.now()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Apenas imagens são permitidas"));
    }
    cb(null, true);
  },
});

function publicUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
    status: u.status,
  };
}

router.get("/search", authRequired, (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) {
    return res.json({ users: [] });
  }

  const meId = req.user!.id;

  const friends = db
    .select()
    .from(friendships)
    .where(
      or(
        eq(friendships.requester_id, meId),
        eq(friendships.addressee_id, meId)
      )
    )
    .all();

  const friendIds = new Set(
    friends
      .filter((f) => f.status === "accepted")
      .map((f) =>
        f.requester_id === meId ? f.addressee_id : f.requester_id
      )
  );

  const results = db
    .select()
    .from(users)
    .where(
      and(
        like(users.username, `%${q}%`),
        ne(users.id, meId),
        not(sql`${users.id} IN (${[...friendIds].join(",") || "0"})`)
      )
    )
    .limit(20)
    .all();

  res.json({ users: results.map(publicUser) });
});

router.put("/profile", authRequired, (req, res) => {
  const { display_name } = req.body ?? {};
  const update: Partial<typeof users.$inferSelect> = {};
  if (typeof display_name === "string" && display_name.trim()) {
    update.display_name = display_name.trim();
  }
  if (Object.keys(update).length) {
    db.update(users).set(update).where(eq(users.id, req.user!.id)).run();
  }
  const me = db.select().from(users).where(eq(users.id, req.user!.id)).get();
  res.json({ user: me ? publicUser(me) : null });
});

router.put("/status", authRequired, (req, res) => {
  const { status } = req.body ?? {};
  if (!["online", "away", "invisible"].includes(status)) {
    return res.status(400).json({ error: "status inválido" });
  }
  db.update(users)
    .set({ status })
    .where(eq(users.id, req.user!.id))
    .run();

  const io = req.app.get("io");
  io?.emit("user:status", { userId: req.user!.id, status });

  res.json({ ok: true });
});

router.post(
  "/avatar",
  authRequired,
  avatarUpload.single("avatar"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    db.update(users)
      .set({ avatar_url: avatarUrl })
      .where(eq(users.id, req.user!.id))
      .run();
    res.json({ avatar_url: avatarUrl });
  }
);

export default router;