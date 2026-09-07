import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { authRequired, signToken } from "../middleware/auth.js";

const router = Router();

function publicUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
    status: u.status,
    created_at: u.created_at,
  };
}

router.post("/register", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "username e password são obrigatórios" });
  }
  if (typeof username !== "string" || username.length < 3) {
    return res
      .status(400)
      .json({ error: "username deve ter pelo menos 3 caracteres" });
  }
  if (typeof password !== "string" || password.length < 6) {
    return res
      .status(400)
      .json({ error: "password deve ter pelo menos 6 caracteres" });
  }

  const existing = db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = ${username.toLowerCase()}`)
    .get();
  if (existing) {
    return res.status(409).json({ error: "Username já em uso" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const inserted = db
    .insert(users)
    .values({
      username,
      password_hash: passwordHash,
      display_name: username,
    })
    .returning()
    .get();

  const token = signToken({ id: inserted.id, username: inserted.username });
  res.status(201).json({ token, user: publicUser(inserted) });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "username e password são obrigatórios" });
  }

  const user = db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();
  if (!user) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  const token = signToken({ id: user.id, username: user.username });
  res.json({ token, user: publicUser(user) });
});

router.get("/me", authRequired, (req, res) => {
  const user = db
    .select()
    .from(users)
    .where(eq(users.id, req.user!.id))
    .get();
  if (!user) {
    return res.status(404).json({ error: "Usuário não encontrado" });
  }
  res.json({ user: publicUser(user) });
});

export default router;