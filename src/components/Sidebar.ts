import { api } from "../lib/api";
import { state, subscribe, upsertConversation, setState, clearUnread, type User, type Conversation, type FriendRequestItem } from "../lib/store";
import { navigate } from "../lib/router";
import { avatarHtml, escapeHtml, hashColor } from "../lib/ui";
import { emitMessageRead, joinRoomSocket } from "../lib/socket";

function searchModalHtml(): string {
  return `
    <div class="modal-overlay" id="modal-add-friend" style="display:none">
      <div class="modal">
        <div class="modal-header">
          <h3>Adicionar amigo</h3>
          <button class="modal-close" data-action="close-modal">×</button>
        </div>
        <input id="friend-search-input" class="auth-input" placeholder="Buscar por username..." />
        <div id="friend-search-results" class="search-results"></div>
      </div>
    </div>
  `;
}

function requestsModalHtml(): string {
  return `
    <div class="modal-overlay" id="modal-requests" style="display:none">
      <div class="modal">
        <div class="modal-header">
          <h3>Solicitações</h3>
          <button class="modal-close" data-action="close-modal">×</button>
        </div>
        <div id="requests-list" class="requests-list"></div>
      </div>
    </div>
  `;
}

export function Sidebar(): string {
  return `
    <aside id="sidebar" class="sidebar">
      <div id="sidebar-profile"></div>
      <div class="sidebar-actions">
        <div class="search-box">
          <input id="sidebar-search" class="search-input" placeholder="Buscar" />
        </div>
        <button id="btn-add-friend" class="icon-btn" title="Adicionar amigo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button id="btn-requests" class="icon-btn" title="Solicitações">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M16 11a4 4 0 10-8 0" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="8" r="2.5" fill="currentColor"/><path d="M5 20c.6-3 3-4.5 7-4.5s6.4 1.5 7 4.5" stroke="currentColor" stroke-width="2"/></svg>
          <span id="requests-badge" class="badge" style="display:none">0</span>
        </button>
      </div>
      <div class="sidebar-scroll">
        <div class="section-label">Conversas</div>
        <div id="conversations-list" class="conversations-list"></div>
        <div class="section-label">Amigos</div>
        <div id="friends-list" class="friends-list"></div>
        <div id="voice-channel-section"></div>
      </div>
      ${searchModalHtml()}
      ${requestsModalHtml()}
    </aside>
  `;
}

function renderConversation(conv: Conversation): string {
  const unread = state.unread[conv.id] || 0;
  const active = state.activeConversation === conv.id;
  const avatar = conv.is_group
    ? `<div class="avatar" style="background:${hashColor(conv.name || "grupo")};width:32px;height:32px;font-size:12px"><span>${escapeHtml((conv.name || "G").slice(0, 2).toUpperCase())}</span></div>`
    : avatarHtml(conv.members.find((m) => m.id !== state.user?.id) ?? null, 32);
  return `
    <div class="conv-item ${active ? "active" : ""}" data-room-id="${conv.id}" data-action="open-conv">
      ${avatar}
      <div class="conv-info">
        <div class="conv-name">${escapeHtml(conv.name || "Conversa")}</div>
        <div class="conv-last">${escapeHtml(conv.last_message || "")}</div>
      </div>
      ${unread ? `<span class="badge unread-badge">${unread}</span>` : ""}
    </div>
  `;
}

function renderFriend(friend: User): string {
  return `
    <div class="friend-item" data-user-id="${friend.id}" data-action="open-dm">
      ${avatarHtml(friend, 32, friend.status)}
      <div class="friend-info">
        <div class="friend-name">${escapeHtml(friend.display_name || friend.username)}</div>
        <div class="friend-status-text">${friend.status === "online" ? "Online" : friend.status === "away" ? "Ausente" : "Offline"}</div>
      </div>
    </div>
  `;
}

function renderFriendRequest(req: FriendRequestItem): string {
  if (!req.user) return "";
  return `
    <div class="friend-request-card" data-req-id="${req.id}">
      ${avatarHtml(req.user, 40)}
      <div class="friend-request-info">
        <div class="friend-name">${escapeHtml(req.user.display_name || req.user.username)}</div>
        <div class="friend-status-text">@${escapeHtml(req.user.username)}</div>
      </div>
      <button class="btn-accept" data-action="accept-request" data-id="${req.id}">Aceitar</button>
      <button class="btn-reject" data-action="reject-request" data-id="${req.id}">Rejeitar</button>
    </div>
  `;
}

let renderSidebar: (() => void) | null = null;

export function mountSidebar() {
  renderSidebar = () => {
    const profile = document.getElementById("sidebar-profile");
    if (profile && state.user) {
      profile.innerHTML = `
        <div class="profile-row">
          ${avatarHtml(state.user, 40, state.user.status)}
          <div class="profile-info">
            <div class="profile-name">${escapeHtml(state.user.display_name || state.user.username)}</div>
            <div class="profile-status">${state.user.status === "online" ? "Online" : state.user.status === "away" ? "Ausente" : "Invisível"}</div>
          </div>
          <button class="icon-btn" data-action="open-settings" title="Configurações">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 01-4 0v-.1a1.6 1.6 0 00-2.7-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 004 15H4a2 2 0 010-4h.1A1.6 1.6 0 005 8.3l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010.5 4H10a2 2 0 014 0h.1a1.6 1.6 0 001.6 1.5h.1A1.6 1.6 0 0017.3 3l.1-.1a2 2 0 112.8 2.8l-.1.1A1.6 1.6 0 0019.4 8.5V8a2 2 0 010 4v.5a1.6 1.6 0 000 .3z" stroke="currentColor" stroke-width="1.5"/></svg>
          </button>
        </div>
        <div class="status-menu" style="display:none">
          <button data-action="set-status" data-status="online">Online</button>
          <button data-action="set-status" data-status="away">Ausente</button>
          <button data-action="set-status" data-status="invisible">Invisível</button>
        </div>
      `;
    }

    const convList = document.getElementById("conversations-list");
    if (convList) {
      convList.innerHTML = state.conversations.length
        ? state.conversations.map(renderConversation).join("")
        : `<div class="empty-hint">Nenhuma conversa ainda</div>`;
    }

    const friendsList = document.getElementById("friends-list");
    if (friendsList) {
      const groups: Record<string, User[]> = {
        online: [],
        away: [],
        offline: [],
      };
      state.friends.forEach((f) => {
        const key = f.status === "invisible" ? "offline" : f.status;
        (groups[key] || groups.offline).push(f);
      });
      const filter = (
        document.getElementById("sidebar-search") as HTMLInputElement
      )?.value.toLowerCase();
      const html = [
        ["online", "Online"],
        ["away", "Ausente"],
        ["offline", "Offline"],
      ]
        .map(([key, label]) => {
          const list = groups[key as keyof typeof groups].filter(
            (f) => !filter || (f.username + (f.display_name || "")).toLowerCase().includes(filter)
          );
          if (!list.length) return "";
          return `<div class="group-label">${label} — ${list.length}</div>${list.map(renderFriend).join("")}`;
        })
        .join("");
      friendsList.innerHTML = html || `<div class="empty-hint">Nenhum amigo encontrado</div>`;
    }

    const badge = document.getElementById("requests-badge");
    if (badge) {
      const n = state.friendRequests.length;
      badge.textContent = String(n);
      badge.style.display = n ? "flex" : "none";
    }

    const requestsList = document.getElementById("requests-list");
    if (requestsList) {
      requestsList.innerHTML = state.friendRequests.length
        ? state.friendRequests.map(renderFriendRequest).join("")
        : `<div class="empty-hint">Nenhuma solicitação pendente</div>`;
    }
  };

  renderSidebar();
  subscribe(renderSidebar);
}

export async function loadFriendsAndRequests() {
  try {
    const [f, r] = await Promise.all([
      api.get<{ friends: User[] }>("/api/friends"),
      api.get<{ requests: FriendRequestItem[] }>("/api/friends/requests"),
    ]);
    setState({ friends: f.friends, friendRequests: r.requests });
  } catch {
    /* backend offline */
  }
}

export async function loadConversations() {
  try {
    const res = await api.get<{ rooms: Conversation[] }>("/api/rooms");
    setState({ conversations: res.rooms });
  } catch {
    /* backend offline */
  }
}

export async function openDm(targetUserId: number) {
  const res = await api.post<{ room: Conversation }>("/api/rooms", {
    type: "dm",
    targetUserId,
  });
  upsertConversation(res.room);
  setState({ activeConversation: res.room.id });
  clearUnread(res.room.id);
  emitMessageRead(res.room.id);
  joinRoomSocket(res.room.id);
}

export async function openConversation(roomId: number) {
  setState({ activeConversation: roomId });
  clearUnread(roomId);
  emitMessageRead(roomId);
  joinRoomSocket(roomId);
  const conv = state.conversations.find((c) => c.id === roomId);
  if (conv && !conv.is_group && conv.members.length) {
    await loadFriendsAndRequests();
  }
}

export function setupSidebarGlobalEvents() {
  document.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const actionEl = target.closest("[data-action]") as HTMLElement | null;
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    switch (action) {
      case "open-settings":
        navigate("settings");
        break;
      case "set-status": {
        const status = actionEl.dataset.status;
        await api.put("/api/users/status", { status });
        if (state.user) setState({ user: { ...state.user, status: status as User["status"] } });
        break;
      }
      case "open-dm": {
        const userId = Number(actionEl.dataset.userId);
        await openDm(userId);
        break;
      }
      case "open-conv": {
        const roomId = Number(actionEl.dataset.roomId);
        await openConversation(roomId);
        break;
      }
      case "accept-request": {
        await api.post(`/api/friends/accept/${actionEl.dataset.id}`);
        await loadFriendsAndRequests();
        break;
      }
      case "reject-request": {
        await api.post(`/api/friends/reject/${actionEl.dataset.id}`);
        await loadFriendsAndRequests();
        break;
      }
      case "close-modal": {
        document.querySelectorAll(".modal-overlay").forEach((m) => {
          (m as HTMLElement).style.display = "none";
        });
        break;
      }
    }
  });

  document.getElementById("btn-add-friend")?.addEventListener("click", () => {
    const modal = document.getElementById("modal-add-friend");
    if (modal) modal.style.display = "flex";
  });

  document.getElementById("btn-requests")?.addEventListener("click", () => {
    const modal = document.getElementById("modal-requests");
    if (modal) modal.style.display = "flex";
  });

  document.getElementById("friend-search-input")?.addEventListener("input", async (e) => {
    const q = (e.target as HTMLInputElement).value.trim();
    const results = document.getElementById("friend-search-results");
    if (!results) return;
    if (q.length < 2) {
      results.innerHTML = "";
      return;
    }
    try {
      const res = await api.get<{ users: User[] }>(`/api/users/search?q=${encodeURIComponent(q)}`);
      if (!res.users.length) {
        results.innerHTML = `<div class="empty-hint">Nenhum usuário encontrado</div>`;
        return;
      }
      results.innerHTML = res.users
        .map(
          (u) => `
            <div class="search-result" data-username="${escapeHtml(u.username)}">
              ${avatarHtml(u, 32)}
              <div class="friend-info">
                <div class="friend-name">${escapeHtml(u.display_name || u.username)}</div>
                <div class="friend-status-text">@${escapeHtml(u.username)}</div>
              </div>
              <button class="btn-add" data-action="send-request">Adicionar</button>
            </div>
          `
        )
        .join("");
    } catch {
      results.innerHTML = `<div class="empty-hint">Erro ao buscar</div>`;
    }
  });

  document.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    if (!target.matches("[data-action='send-request']")) return;
    const row = target.closest(".search-result") as HTMLElement | null;
    if (!row) return;
    const username = row.dataset.username;
    if (!username) return;
    try {
      await api.post("/api/friends/request", { username });
      row.innerHTML = `<span class="sent-hint">Pedido enviado ✓</span>`;
    } catch (ex) {
      row.innerHTML = `<span class="sent-hint error">${escapeHtml(ex instanceof Error ? ex.message : "Erro")}</span>`;
    }
  });

  document.getElementById("sidebar-search")?.addEventListener("input", () => {
    renderSidebar?.();
  });
}

export function refreshSidebar() {
  renderSidebar?.();
}