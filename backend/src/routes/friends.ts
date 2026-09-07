import { Router } from "express";
import { and, eq, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { friendships, users } from "../db/schema.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

function publicUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
    status: u.status,
  };
}

router.get("/", authRequired, (req, res) => {
  const meId = req.user!.id;
  const rows = db
    .select()
    .from(friendships)
    .where(
      and(
        or(
          eq(friendships.requester_id, meId),
          eq(friendships.addressee_id, meId)
        ),
        eq(friendships.status, "accepted")
      )
    )
    .all();

  const otherIds = rows.map((f) =>
    f.requester_id === meId ? f.addressee_id : f.requester_id
  );

  const friendUsers = otherIds.length
    ? db
        .select()
        .from(users)
        .where(
          or(...otherIds.map((id) => eq(users.id, id)))
        )
        .all()
    : [];

  res.json({ friends: friendUsers.map(publicUser) });
});

router.get("/requests", authRequired, (req, res) => {
  const meId = req.user!.id;
  const rows = db
    .select()
    .from(friendships)
    .where(
      and(
        eq(friendships.addressee_id, meId),
        eq(friendships.status, "pending")
      )
    )
    .all();

  const requesterIds = rows.map((r) => r.requester_id);
  const requesterUsers = requesterIds.length
    ? db
        .select()
        .from(users)
        .where(or(...requesterIds.map((id) => eq(users.id, id))))
        .all()
    : [];

  const requests = rows.map((r) => {
    const u = requesterUsers.find((x) => x.id === r.requester_id);
    return {
      id: r.id,
      created_at: r.created_at,
      user: u ? publicUser(u) : null,
    };
  });

  res.json({ requests });
});

router.post("/request", authRequired, (req, res) => {
  const { username } = req.body ?? {};
  if (!username) {
    return res.status(400).json({ error: "username é obrigatório" });
  }
  const meId = req.user!.id;

  const target = db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();
  if (!target) {
    return res.status(404).json({ error: "Usuário não encontrado" });
  }
  if (target.id === meId) {
    return res.status(400).json({ error: "Você não pode adicionar a si mesmo" });
  }

  const existing = db
    .select()
    .from(friendships)
    .where(
      or(
        and(
          eq(friendships.requester_id, meId),
          eq(friendships.addressee_id, target.id)
        ),
        and(
          eq(friendships.requester_id, target.id),
          eq(friendships.addressee_id, meId)
        )
      )
    )
    .get();

  if (existing) {
    if (existing.status === "accepted") {
      return res.status(409).json({ error: "Vocês já são amigos" });
    }
    if (existing.status === "pending") {
      return res.status(409).json({ error: "Pedido de amizade já enviado" });
    }
    db.update(friendships)
      .set({ status: "pending" })
      .where(eq(friendships.id, existing.id))
      .run();
    const io = req.app.get("io");
    io?.to(`me:${target.id}`).emit("friend:request", {
      id: existing.id,
      user: publicUser(db.select().from(users).where(eq(users.id, meId)).get()!),
    });
    return res.json({ ok: true });
  }

  const inserted = db
    .insert(friendships)
    .values({
      requester_id: meId,
      addressee_id: target.id,
      status: "pending",
    })
    .returning()
    .get();

  const io = req.app.get("io");
  const me = db.select().from(users).where(eq(users.id, meId)).get();
  io?.to(`me:${target.id}`).emit("friend:request", {
    id: inserted.id,
    user: me ? publicUser(me) : null,
  });

  res.status(201).json({ ok: true });
});

router.post("/accept/:id", authRequired, (req, res) => {
  const meId = req.user!.id;
  const friendship = db
    .select()
    .from(friendships)
    .where(
      and(
        eq(friendships.id, Number(req.params.id)),
        eq(friendships.addressee_id, meId),
        eq(friendships.status, "pending")
      )
    )
    .get();

  if (!friendship) {
    return res.status(404).json({ error: "Pedido não encontrado" });
  }

  db.update(friendships)
    .set({ status: "accepted" })
    .where(eq(friendships.id, friendship.id))
    .run();

  const io = req.app.get("io");
  const me = db.select().from(users).where(eq(users.id, meId)).get();
  io?.to(`me:${friendship.requester_id}`).emit("friend:accepted", {
    user: me ? publicUser(me) : null,
  });

  res.json({ ok: true });
});

router.post("/reject/:id", authRequired, (req, res) => {
  const meId = req.user!.id;
  const friendship = db
    .select()
    .from(friendships)
    .where(
      and(
        eq(friendships.id, Number(req.params.id)),
        eq(friendships.addressee_id, meId),
        eq(friendships.status, "pending")
      )
    )
    .get();

  if (!friendship) {
    return res.status(404).json({ error: "Pedido não encontrado" });
  }

  db.update(friendships)
    .set({ status: "rejected" })
    .where(eq(friendships.id, friendship.id))
    .run();

  res.json({ ok: true });
});

router.delete("/:id", authRequired, (req, res) => {
  const meId = req.user!.id;
  const friendship = db
    .select()
    .from(friendships)
    .where(
      and(
        eq(friendships.id, Number(req.params.id)),
        or(
          eq(friendships.requester_id, meId),
          eq(friendships.addressee_id, meId)
        )
      )
    )
    .get();

  if (!friendship) {
    return res.status(404).json({ error: "Amizade não encontrada" });
  }

  db.delete(friendships).where(eq(friendships.id, friendship.id)).run();
  res.json({ ok: true });
});

export default router;