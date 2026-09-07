import {
  sqliteTable,
  text,
  integer,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  display_name: text("display_name"),
  avatar_url: text("avatar_url"),
  status: text("status", {
    enum: ["online", "away", "invisible"],
  })
    .notNull()
    .default("online"),
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .defaultNow(),
});

export const friendships = sqliteTable("friendships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requester_id: integer("requester_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  addressee_id: integer("addressee_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status", {
    enum: ["pending", "accepted", "rejected"],
  })
    .notNull()
    .default("pending"),
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .defaultNow(),
});

export const rooms = sqliteTable("rooms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
  is_group: integer("is_group", { mode: "boolean" }).notNull().default(false),
  owner_id: integer("owner_id").references(() => users.id, {
    onDelete: "set null",
  }),
  invite_code: text("invite_code").unique(),
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .defaultNow(),
});

export const roomMembers = sqliteTable("room_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  room_id: integer("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["admin", "moderator", "member"] })
    .notNull()
    .default("member"),
  joined_at: integer("joined_at", { mode: "timestamp_ms" })
    .notNull()
    .defaultNow(),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  room_id: integer("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  user_id: integer("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  content: text("content").notNull(),
  type: text("type", { enum: ["text", "image", "system"] })
    .notNull()
    .default("text"),
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .defaultNow(),
});

export const voiceChannels = sqliteTable("voice_channels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  room_id: integer("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  max_participants: integer("max_participants").notNull().default(10),
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .defaultNow(),
});

export const voiceParticipants = sqliteTable("voice_participants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channel_id: integer("channel_id")
    .notNull()
    .references(() => voiceChannels.id, { onDelete: "cascade" }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  joined_at: integer("joined_at", { mode: "timestamp_ms" })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type FriendShip = typeof friendships.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type RoomMember = typeof roomMembers.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type VoiceChannel = typeof voiceChannels.$inferSelect;
export type VoiceParticipant = typeof voiceParticipants.$inferSelect;