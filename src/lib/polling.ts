import { api } from "./api";
import { state } from "./store";
import type { Message } from "./store";

let intervalId: number | null = null;
const lastSeenId: Record<number, number> = {};

export function startPolling() {
  if (intervalId !== null) return;
  intervalId = window.setInterval(async () => {
    if (!state.user) return;
    const conversations = state.conversations;
    if (!conversations.length) return;

    for (const conv of conversations) {
      try {
        const res = await api.get<{ messages: Message[] }>(
          `/api/rooms/${conv.id}/messages?limit=10`
        );
        const messages = res.messages;
        if (!messages.length) continue;

        const currentMax = lastSeenId[conv.id] ?? 0;
        const maxId = Math.max(...messages.map((m) => m.id));

        if (lastSeenId[conv.id] !== undefined) {
          for (const msg of messages) {
            if (msg.id > lastSeenId[conv.id]) {
              window.dispatchEvent(new CustomEvent("app:message", { detail: msg }));
            }
          }
        }

        lastSeenId[conv.id] = maxId || currentMax;
      } catch {
        /* skip cycle on error */
      }
    }
  }, 5000);
}

export function stopPolling() {
  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}
