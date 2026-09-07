import { io, Socket } from "socket.io-client";
import { API_URL, getToken } from "./api";
import { setState } from "./store";

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket) return socket;

  const token = getToken();
  socket = io(API_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
  });

  socket.on("connect", () => {
    setState({});
    window.dispatchEvent(new CustomEvent("app:connection", { detail: { connected: true } }));
  });

  socket.on("disconnect", () => {
    window.dispatchEvent(new CustomEvent("app:connection", { detail: { connected: false } }));
  });

  socket.on("message:new", (msg) => {
    window.dispatchEvent(new CustomEvent("app:message", { detail: msg }));
  });

  socket.on("user:typing", (data) => {
    window.dispatchEvent(
      new CustomEvent("app:typing", { detail: data })
    );
  });

  socket.on("user:online", (data) => {
    window.dispatchEvent(new CustomEvent("app:user-online", { detail: data }));
  });

  socket.on("user:offline", (data) => {
    window.dispatchEvent(new CustomEvent("app:user-offline", { detail: data }));
  });

  socket.on("user:status", (data) => {
    window.dispatchEvent(new CustomEvent("app:user-status", { detail: data }));
  });

  socket.on("friend:request", (data) => {
    window.dispatchEvent(new CustomEvent("app:friend-request", { detail: data }));
  });

  socket.on("friend:accepted", (data) => {
    window.dispatchEvent(new CustomEvent("app:friend-accepted", { detail: data }));
  });

  socket.on("voice:join", (data) => {
    window.dispatchEvent(new CustomEvent("app:voice-join", { detail: data }));
  });

  socket.on("voice:leave", (data) => {
    window.dispatchEvent(new CustomEvent("app:voice-leave", { detail: data }));
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function emitTyping(roomId: number, isTyping: boolean) {
  socket?.emit("user:typing", { roomId, isTyping });
}

export function emitMessageRead(roomId: number) {
  socket?.emit("message:read", { roomId });
}

export function joinRoomSocket(roomId: number) {
  socket?.emit("join-room", roomId);
}

export function leaveRoomSocket(roomId: number) {
  socket?.emit("leave-room", roomId);
}