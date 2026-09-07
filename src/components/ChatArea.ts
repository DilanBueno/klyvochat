import { api } from "../lib/api";
import { state, clearUnread, upsertConversation, setState, subscribe, type Message } from "../lib/store";
import { escapeHtml, avatarHtml } from "../lib/ui";
import { MessageBubble } from "./MessageBubble";
import { emitMessageRead, emitTyping, leaveRoomSocket } from "../lib/socket";

const messagesCache: Record<number, Message[]> = {};
const typingUsers = new Set<number>();

const EMOJIS = ["😀","😂","😍","🤔","👍","👎","🎉","🔥","❤️","😢","😡","👋","💯","🤝","🕹️","🎮"];

export function ChatArea(): string {
  return `
    <section id="chat-area" class="chat-area">
      <div id="chat-header"></div>
      <div id="chat-messages" class="chat-messages"></div>
      <div id="chat-typing" class="chat-typing" style="display:none"></div>
      <div id="chat-input" class="chat-input">
        <div id="emoji-picker" class="emoji-picker" style="display:none">
          ${EMOJIS.map((e) => `<button class="emoji-btn">${e}</button>`).join("")}
        </div>
        <div class="input-row">
          <button id="btn-emoji" class="input-btn" title="Emoji">🙂</button>
          <button id="btn-attach" class="input-btn" title="Anexar imagem">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15v3a3 3 0 01-3 3H6a3 3 0 01-3-3v-3M12 3v13M8 7l4-4 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <input id="attach-file" type="file" accept="image/*" style="display:none" />
          <textarea id="chat-textarea" rows="1" placeholder="Escreva uma mensagem..."></textarea>
          <button id="btn-send" class="send-btn" title="Enviar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
    </section>
  `;
}

export function mountChatArea() {
  const messagesEl = () => document.getElementById("chat-messages");
  const typingEl = () => document.getElementById("chat-typing");

  const renderHeader = () => {
    const header = document.getElementById("chat-header");
    const conv = state.conversations.find((c) => c.id === state.activeConversation);
    if (!header) return;
    if (!conv) {
      header.innerHTML = "";
      return;
    }
    header.innerHTML = `
      <div class="chat-header-inner">
        ${conv.is_group
          ? `<div class="avatar" style="width:28px;height:28px;background:#2a475e;font-size:11px"><span>${escapeHtml((conv.name || "G").slice(0, 2).toUpperCase())}</span></div>`
          : avatarHtml(conv.members.find((m) => m.id !== state.user?.id) ?? null, 28)}
        <span class="chat-header-name">${escapeHtml(conv.name || "Conversa")}</span>
      </div>
      <div class="chat-header-actions">
        <button id="btn-header-voice" class="icon-btn" title="Canais de voz">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z" stroke="currentColor" stroke-width="2"/><path d="M5 11a7 7 0 0014 0" stroke="currentColor" stroke-width="2"/></svg>
        </button>
      </div>
    `;
  };

  const renderTyping = () => {
    const el = typingEl();
    if (!el) return;
    if (typingUsers.size) {
      const names: string[] = [];
      typingUsers.forEach((id) => {
        const conv = state.conversations.find((c) => c.id === state.activeConversation);
        const user = conv?.members.find((m) => m.id === id);
        names.push(user?.display_name || user?.username || "Alguém");
      });
      el.textContent = `${names.join(", ")} ${names.length > 1 ? "estão" : "está"} digitando...`;
      el.style.display = "block";
    } else {
      el.style.display = "none";
    }
  };

  const scrollToBottom = () => {
    const el = messagesEl();
    if (el) el.scrollTop = el.scrollHeight;
  };

  const renderMessages = (roomId: number) => {
    const el = messagesEl();
    if (!el) return;
    const msgs = messagesCache[roomId] ?? [];
    el.innerHTML = msgs.length
      ? msgs.map((m) => MessageBubble(m, m.user?.id === state.user?.id)).join("")
      : `<div class="empty-chat">Nenhuma mensagem ainda.<br/>Envie a primeira!</div>`;
    scrollToBottom();
  };

  const loadMessages = async (roomId: number) => {
    try {
      const res = await api.get<{ messages: Message[] }>(
        `/api/rooms/${roomId}/messages?limit=50`
      );
      messagesCache[roomId] = res.messages;
    } catch {
      messagesCache[roomId] = [];
    }
    renderMessages(roomId);
    clearUnread(roomId);
    emitMessageRead(roomId);
  };

  const switchRoom = (roomId: number) => {
    renderHeader();
    typingUsers.clear();
    renderTyping();
    if (messagesCache[roomId]) {
      renderMessages(roomId);
    } else {
      loadMessages(roomId);
    }
  };

  const currentRoomId = () => state.activeConversation;

  const sendMessage = async () => {
    const textarea = document.getElementById("chat-textarea") as HTMLTextAreaElement;
    const roomId = currentRoomId();
    const content = textarea?.value.trim();
    if (!roomId || !content) return;
    textarea.value = "";
    textarea.style.height = "auto";
    emitTyping(roomId, false);
    try {
      const res = await api.post<{ message: Message }>(
        `/api/rooms/${roomId}/messages`,
        { content, type: "text" }
      );
      appendMessage(res.message, true);
    } catch (ex) {
      console.error(ex);
    }
  };

  const appendMessage = (msg: Message, own = false) => {
    const roomId = msg.room_id;
    if (roomId === currentRoomId()) {
      if (!messagesCache[roomId]) messagesCache[roomId] = [];
      if (!messagesCache[roomId].some((m) => m.id === msg.id)) {
        messagesCache[roomId].push(msg);
      }
      renderMessages(roomId);
    } else {
      const unread = { ...state.unread };
      unread[roomId] = (unread[roomId] || 0) + 1;
      setState({ unread });
    }
    upsertConversation({
      id: msg.room_id,
      last_message: msg.type === "image" ? "📷 Imagem" : msg.content,
      updated_at: msg.created_at,
    });
    if (own) clearUnread(roomId);
  };

  renderHeader();

  // Mudança de conversa
  const onView = () => {
    const roomId = state.activeConversation;
    renderHeader();
    if (roomId) switchRoom(roomId);
    else {
      const el = messagesEl();
      if (el) el.innerHTML = `<div class="empty-chat">Selecione uma conversa<br/>para começar</div>`;
    }
  };
  let lastConv: number | null = null;
  const onStoreChange = () => {
    if (state.activeConversation !== lastConv) {
      lastConv = state.activeConversation;
      onView();
    }
  };
  onStoreChange();
  const unsubscribe = subscribe(onStoreChange);
  window.addEventListener("app:view", (e) => {
    if ((e as CustomEvent).detail?.view === "chat") onStoreChange();
  });

  window.addEventListener("app:message", (e) => {
    appendMessage((e as CustomEvent).detail as Message);
  });

  window.addEventListener("app:typing", (e) => {
    const d = e as CustomEvent;
    const data = d.detail as { userId: number; roomId: number; isTyping: boolean };
    if (data.roomId !== currentRoomId() || data.userId === state.user?.id) return;
    if (data.isTyping) typingUsers.add(data.userId);
    else typingUsers.delete(data.userId);
    renderTyping();
  });

  // Input
  const textarea = document.getElementById("chat-textarea") as HTMLTextAreaElement;
  if (textarea) {
    textarea.addEventListener("input", () => {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
      const roomId = currentRoomId();
      if (roomId) emitTyping(roomId, textarea.value.trim().length > 0);
    });

    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  document.getElementById("btn-send")?.addEventListener("click", sendMessage);

  document.getElementById("btn-emoji")?.addEventListener("click", () => {
    const picker = document.getElementById("emoji-picker");
    if (picker) picker.style.display = picker.style.display === "none" ? "flex" : "none";
  });

  document.querySelectorAll(".emoji-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ta = document.getElementById("chat-textarea") as HTMLTextAreaElement;
      if (ta) {
        ta.value += (btn as HTMLButtonElement).textContent;
        ta.dispatchEvent(new Event("input"));
        ta.focus();
      }
    });
  });

  document.getElementById("btn-attach")?.addEventListener("click", () => {
    (document.getElementById("attach-file") as HTMLInputElement)?.click();
  });

  document.getElementById("attach-file")?.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    const roomId = currentRoomId();
    if (!file || !roomId) return;
    const form = new FormData();
    form.append("image", file);
    try {
      const res = await api.upload<{ url: string }>(
        `/api/rooms/${roomId}/messages/upload`,
        form
      );
      const msgRes = await api.post<{ message: Message }>(
        `/api/rooms/${roomId}/messages`,
        { content: res.url, type: "image" }
      );
      appendMessage(msgRes.message, true);
    } catch (ex) {
      console.error(ex);
    }
    (e.target as HTMLInputElement).value = "";
  });

  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target.matches("#btn-header-voice")) return;
    const section = document.getElementById("voice-channel-section");
    if (section) section.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  // limpar ao trocar de janela
  window.addEventListener("beforeunload", () => {
    leaveRoomSocket(currentRoomId() ?? 0);
  });

  window.addEventListener("unsubscribe-chat", () => unsubscribe());
}