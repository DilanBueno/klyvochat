import type { Server } from "socket.io";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";

const onlineUsers = new Map<number, string>();

export function setupSocket(io: Server) {
  io.on("connection", async (socket) => {
    const user = socket.data.user as { id: number; username: string };
    const userId = user.id;

    socket.join(`user:${userId}`);
    socket.join(`me:${userId}`);

    onlineUsers.set(userId, socket.id);

    const u = db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();

    io.emit("user:online", {
      userId,
      status: u?.status ?? "online",
    });

    socket.on("user:typing", (data: { roomId: number; isTyping: boolean }) => {
      if (!data?.roomId) return;
      socket
        .to(`room:${data.roomId}`)
        .emit("user:typing", {
          userId,
          roomId: data.roomId,
          isTyping: Boolean(data.isTyping),
        });
    });

    socket.on("message:read", (data: { roomId: number; messageId?: number }) => {
      if (!data?.roomId) return;
      socket
        .to(`room:${data.roomId}`)
        .emit("message:read", { userId, roomId: data.roomId, messageId: data.messageId });
    });

    socket.on("join-room", (roomId: number) => {
      if (!roomId) return;
      socket.join(`room:${roomId}`);
    });

    socket.on("leave-room", (roomId: number) => {
      if (!roomId) return;
      socket.leave(`room:${roomId}`);
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(userId);
      io.emit("user:offline", { userId });
    });
  });
}

export function isUserOnline(userId: number): boolean {
  return onlineUsers.has(userId);
}