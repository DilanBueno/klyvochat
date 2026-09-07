import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  messages,
  roomMembers,
  rooms,
  users,
  voiceChannels,
  voiceParticipants,
} from "../db/schema.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
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

function isMember(roomId: number, userId: number): boolean {
  return Boolean(
    db
      .select()
      .from(roomMembers)
      .where(
        and(
          eq(roomMembers.room_id, roomId),
          eq(roomMembers.user_id, userId)
        )
      )
      .get()
  );
}

router.post("/", authRequired, (req, res) => {
  const meId = req.user!.id;
  const { type, name, targetUserId } = req.body ?? {};

  if (type === "dm") {
    if (!targetUserId) {
      return res.status(400).json({ error: "targetUserId é obrigatório" });
    }
    const target = db
      .select()
      .from(users)
      .where(eq(users.id, Number(targetUserId)))
      .get();
    if (!target) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const myRooms = db
      .select({ room_id: roomMembers.room_id })
      .from(roomMembers)
      .where(eq(roomMembers.user_id, meId))
      .all();
    const roomIds = myRooms.map((r) => r.room_id);
    if (roomIds.length) {
      const dm = db
        .select()
        .from(rooms)
        .where(
          and(
            eq(rooms.is_group, false),
            or(...roomIds.map((id) => eq(rooms.id, id)))
          )
        )
        .all()
        .find((r) => {
          const members = db
            .select()
            .from(roomMembers)
            .where(eq(roomMembers.room_id, r.id))
            .all();
          const ids = members.map((m) => m.user_id);
          return (
            ids.includes(meId) &&
            ids.includes(target.id) &&
            ids.length === 2
          );
        });
      if (dm) {
        return res.json({ room: dm });
      }
    }

    const inserted = db
      .insert(rooms)
      .values({ name: null, is_group: false, owner_id: meId })
      .returning()
      .get();

    db.insert(roomMembers)
      .values([
        { room_id: inserted.id, user_id: meId, role: "admin" },
        { room_id: inserted.id, user_id: target.id, role: "member" },
      ])
      .run();

    db.insert(voiceChannels)
      .values({ room_id: inserted.id, name: "Voz" })
      .run();

    return res.status(201).json({ room: inserted });
  }

  if (type === "group") {
    if (!name) {
      return res.status(400).json({ error: "name é obrigatório para grupos" });
    }
    const inserted = db
      .insert(rooms)
      .values({
        name,
        is_group: true,
        owner_id: meId,
        invite_code: crypto.randomBytes(6).toString("hex"),
      })
      .returning()
      .get();

    db.insert(roomMembers)
      .values({ room_id: inserted.id, user_id: meId, role: "admin" })
      .run();

    db.insert(voiceChannels)
      .values({ room_id: inserted.id, name: "Geral" })
      .run();

    return res.status(201).json({ room: inserted });
  }

  return res.status(400).json({ error: "type deve ser 'dm' ou 'group'" });
});

router.get("/", authRequired, (req, res) => {
  const meId = req.user!.id;
  const memberships = db
    .select()
    .from(roomMembers)
    .where(eq(roomMembers.user_id, meId))
    .all();
  const roomIds = memberships.map((m) => m.room_id);

  const list = roomIds.length
    ? db
        .select()
        .from(rooms)
        .where(or(...roomIds.map((id) => eq(rooms.id, id))))
        .all()
    : [];

  const result = list.map((r) => {
    const memberRows = db
      .select()
      .from(roomMembers)
      .where(eq(roomMembers.room_id, r.id))
      .all();
    const userRows = memberRows.length
      ? db
          .select()
          .from(users)
          .where(or(...memberRows.map((m) => eq(users.id, m.user_id))))
          .all()
      : [];
    const other = userRows.filter((u) => u.id !== meId);
    const lastMessage = db
      .select()
      .from(messages)
      .where(eq(messages.room_id, r.id))
      .orderBy(desc(messages.created_at))
      .limit(1)
      .get();
    return {
      id: r.id,
      name: r.is_group ? r.name : other[0]?.display_name || other[0]?.username,
      is_group: r.is_group,
      avatar_url: r.is_group ? null : other[0]?.avatar_url,
      members: userRows.map(publicUser),
      last_message: lastMessage?.content ?? null,
      updated_at: lastMessage?.created_at ?? r.created_at,
    };
  });

  result.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
  res.json({ rooms: result });
});

router.post("/:id/join", authRequired, (req, res) => {
  const roomId = Number(req.params.id);
  const meId = req.user!.id;
  const room = db.select().from(rooms).where(eq(rooms.id, roomId)).get();
  if (!room) {
    return res.status(404).json({ error: "Sala não encontrada" });
  }
  if (!isMember(roomId, meId)) {
    db.insert(roomMembers)
      .values({ room_id: roomId, user_id: meId, role: "member" })
      .run();
  }
  res.json({ room });
});

router.post("/:id/leave", authRequired, (req, res) => {
  const roomId = Number(req.params.id);
  const meId = req.user!.id;
  db.delete(roomMembers)
    .where(
      and(
        eq(roomMembers.room_id, roomId),
        eq(roomMembers.user_id, meId)
      )
    )
    .run();
  res.json({ ok: true });
});

router.get("/invite/:code", authRequired, (req, res) => {
  const room = db
    .select()
    .from(rooms)
    .where(eq(rooms.invite_code, req.params.code))
    .get();
  if (!room) {
    return res.status(404).json({ error: "Convite inválido" });
  }
  const meId = req.user!.id;
  if (!isMember(room.id, meId)) {
    db.insert(roomMembers)
      .values({ room_id: room.id, user_id: meId, role: "member" })
      .run();
  }
  res.json({ room });
});

router.get("/:id/messages", authRequired, (req, res) => {
  const roomId = Number(req.params.id);
  const meId = req.user!.id;
  if (!isMember(roomId, meId)) {
    return res.status(403).json({ error: "Você não é membro desta sala" });
  }
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const before = Number(req.query.before) || undefined;

  const rows = before
    ? db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.room_id, roomId),
            lt(messages.id, before)
          )
        )
        .orderBy(desc(messages.id))
        .limit(limit)
        .all()
    : db
        .select()
        .from(messages)
        .where(eq(messages.room_id, roomId))
        .orderBy(desc(messages.id))
        .limit(limit)
        .all();

  const userIds = [...new Set(rows.map((m) => m.user_id).filter(Boolean))] as number[];
  const userRows = userIds.length
    ? db
        .select()
        .from(users)
        .where(or(...userIds.map((id) => eq(users.id, id))))
        .all()
    : [];

  const result = rows
    .reverse()
    .map((m) => {
      const u = m.user_id
        ? userRows.find((x) => x.id === m.user_id)
        : undefined;
      return {
        id: m.id,
        room_id: m.room_id,
        content: m.content,
        type: m.type,
        created_at: m.created_at,
        user: u ? publicUser(u) : null,
      };
    });

  res.json({ messages: result });
});

router.post("/:id/messages", authRequired, (req, res) => {
  const roomId = Number(req.params.id);
  const meId = req.user!.id;
  const { content, type } = req.body ?? {};
  if (!isMember(roomId, meId)) {
    return res.status(403).json({ error: "Você não é membro desta sala" });
  }
  if (typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "content é obrigatório" });
  }

  const inserted = db
    .insert(messages)
    .values({
      room_id: roomId,
      user_id: meId,
      content: content.trim(),
      type: type === "system" ? "system" : type === "image" ? "image" : "text",
    })
    .returning()
    .get();

  const me = db.select().from(users).where(eq(users.id, meId)).get();
  const msg = {
    id: inserted.id,
    room_id: inserted.room_id,
    content: inserted.content,
    type: inserted.type,
    created_at: inserted.created_at,
    user: me ? publicUser(me) : null,
  };

  const io = req.app.get("io");
  io?.to(`room:${roomId}`).emit("message:new", msg);

  res.status(201).json({ message: msg });
});

router.post(
  "/:id/messages/upload",
  authRequired,
  imageUpload.single("image"),
  (req, res) => {
    const roomId = Number(req.params.id);
    const meId = req.user!.id;
    if (!isMember(roomId, meId)) {
      return res.status(403).json({ error: "Você não é membro desta sala" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Nenhuma imagem enviada" });
    }
    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({ url });
  }
);

router.get("/:id/voice-channels", authRequired, (req, res) => {
  const roomId = Number(req.params.id);
  const meId = req.user!.id;
  if (!isMember(roomId, meId)) {
    return res.status(403).json({ error: "Você não é membro desta sala" });
  }
  const channels = db
    .select()
    .from(voiceChannels)
    .where(eq(voiceChannels.room_id, roomId))
    .all();

  const result = channels.map((c) => {
    const participants = db
      .select()
      .from(voiceParticipants)
      .where(eq(voiceParticipants.channel_id, c.id))
      .all();
    const userIds = participants.map((p) => p.user_id);
    const userRows = userIds.length
      ? db
          .select()
          .from(users)
          .where(or(...userIds.map((id) => eq(users.id, id))))
          .all()
      : [];
    return {
      id: c.id,
      room_id: c.room_id,
      name: c.name,
      max_participants: c.max_participants,
      participants: userRows.map(publicUser),
    };
  });

  res.json({ channels: result });
});

router.post("/:id/voice-channels", authRequired, (req, res) => {
  const roomId = Number(req.params.id);
  const meId = req.user!.id;
  const { name, max_participants } = req.body ?? {};
  if (!isMember(roomId, meId)) {
    return res.status(403).json({ error: "Você não é membro desta sala" });
  }
  if (!name) {
    return res.status(400).json({ error: "name é obrigatório" });
  }
  const inserted = db
    .insert(voiceChannels)
    .values({
      room_id: roomId,
      name,
      max_participants: max_participants || 10,
    })
    .returning()
    .get();
  res.status(201).json({ channel: inserted });
});

router.post("/voice-channels/:id/join", authRequired, (req, res) => {
  const channelId = Number(req.params.id);
  const meId = req.user!.id;
  const channel = db
    .select()
    .from(voiceChannels)
    .where(eq(voiceChannels.id, channelId))
    .get();
  if (!channel) {
    return res.status(404).json({ error: "Canal de voz não encontrado" });
  }

  db.delete(voiceParticipants)
    .where(eq(voiceParticipants.user_id, meId))
    .run();

  const inserted = db
    .insert(voiceParticipants)
    .values({ channel_id: channelId, user_id: meId })
    .returning()
    .get();

  const io = req.app.get("io");
  io?.emit("voice:join", { channelId, userId: meId });

  res.status(201).json({ participant: inserted });
});

router.post("/voice-channels/:id/leave", authRequired, (req, res) => {
  const channelId = Number(req.params.id);
  const meId = req.user!.id;
  db.delete(voiceParticipants)
    .where(
      and(
        eq(voiceParticipants.channel_id, channelId),
        eq(voiceParticipants.user_id, meId)
      )
    )
    .run();

  const io = req.app.get("io");
  io?.emit("voice:leave", { channelId, userId: meId });

  res.json({ ok: true });
});

export default router;