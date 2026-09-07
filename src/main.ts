import "./styles/index.css";
import { api, getToken, clearToken } from "./lib/api";
import { state, setState, subscribe } from "./lib/store";
import { navigate } from "./lib/router";
import {
  connectSocket,
  disconnectSocket,
} from "./lib/socket";
import { startPolling, stopPolling } from "./lib/polling";
import {
  loadFriendsAndRequests,
  loadConversations,
  mountSidebar,
  setupSidebarGlobalEvents,
  refreshSidebar,
  Sidebar,
} from "./components/Sidebar";
import { FloatingBar, mountFloatingBar } from "./components/FloatingBar";
import { ChatArea, mountChatArea } from "./components/ChatArea";
import { mountVoiceChannel } from "./components/VoiceChannel";
import { mountUserCard, UserCard } from "./components/UserCard";
import { loginViewHtml, registerViewHtml, mountLoginView, mountRegisterView } from "./components/LoginView";
import { Settings, mountSettings, loadSettings } from "./components/Settings";
import { showToast, FriendRequestToast } from "./components/FriendRequest";
import { sendOsNotification, playSound } from "./lib/notify";
import { loadPersistedState, savePersistedState } from "./lib/persist";

function renderLogin() {
  const root = document.getElementById("login-root");
  if (root) root.innerHTML = loginViewHtml();
  mountLoginView();
}

function renderRegister() {
  const root = document.getElementById("register-root");
  if (root) root.innerHTML = registerViewHtml();
  mountRegisterView();
}

function renderChat() {
  const barRoot = document.getElementById("floating-bar-root");
  if (barRoot) barRoot.innerHTML = FloatingBar();
  mountFloatingBar();

  const sidebarRoot = document.getElementById("sidebar-root");
  if (sidebarRoot) {
    sidebarRoot.innerHTML = Sidebar();
    mountSidebar();
    setupSidebarGlobalEvents();
    if (!document.getElementById("usercard-overlay")) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = UserCard();
      document.body.appendChild(wrapper.firstElementChild as HTMLElement);
    }
    mountUserCard();
  }

  const chatRoot = document.getElementById("chat-area-root");
  if (chatRoot) {
    chatRoot.innerHTML = ChatArea();
    mountChatArea();
  }

  mountVoiceChannel();
}

function renderSettings() {
  const root = document.getElementById("settings-root");
  if (!root) return;
  root.innerHTML = Settings();
  mountSettings();
}

async function bootstrapAfterAuth() {
  try {
    const res = await api.get<{ user: typeof state.user }>("/api/auth/me");
    setState({ user: res.user });
  } catch {
    clearToken();
    navigate("login");
    return;
  }

  await loadSettings();
  await loadPersistedState();
  connectSocket();
  startPolling();

  renderChat();
  navigate("chat");

  await loadFriendsAndRequests();
  await loadConversations();
}

async function startApp() {
  const token = getToken();

  renderLogin();
  renderRegister();

  if (!token) {
    navigate("login");
    return;
  }

  await bootstrapAfterAuth();
}

function setupGlobalSocketHandlers() {
  window.addEventListener("app:friend-request", async (e) => {
    const detail = (e as CustomEvent).detail;
    const requests = state.friendRequests;
    const existing = requests.some((r) => r.id === detail.id);
    if (!existing) {
      requests.unshift(detail);
      setState({ friendRequests: [...requests] });
    }
    showToast(FriendRequestToast(detail));
    playSound();
    sendOsNotification(
      "Nova solicitação de amizade",
      `${detail.user?.display_name || detail.user?.username || "Alguém"} quer ser seu amigo`
    );
  });

  window.addEventListener("app:friend-accepted", async () => {
    await loadFriendsAndRequests();
    refreshSidebar();
  });

  window.addEventListener("app:user-online", (e) => {
    const { userId } = (e as CustomEvent).detail as { userId: number; status: string };
    updateFriendStatus(userId, "online");
    refreshSidebar();
  });

  window.addEventListener("app:user-offline", (e) => {
    const { userId } = (e as CustomEvent).detail as { userId: number };
    updateFriendStatus(userId, "offline");
    refreshSidebar();
  });

  window.addEventListener("app:user-status", (e) => {
    const { userId, status } = (e as CustomEvent).detail as { userId: number; status: string };
    updateFriendStatus(userId, status);
    refreshSidebar();
  });

  window.addEventListener("app:message", async (e) => {
    const msg = (e as CustomEvent).detail;
    const conv = state.conversations.find((c) => c.id === msg.room_id);
    const senderName = msg.user?.display_name || msg.user?.username || "Alguém";
    const isActive = state.activeConversation === msg.room_id;
    const isOwn = msg.user?.id === state.user?.id;

    if (!isActive && !isOwn && conv) {
      playSound();
      sendOsNotification(
        senderName,
        msg.type === "image" ? "📷 Imagem" : msg.content
      );
    }
  });

  window.addEventListener("app:view", (e) => {
    const view = (e as CustomEvent).detail?.view;
    if (view === "settings") renderSettings();
    updateTitle();
  });

  window.addEventListener("app:unauthorized", () => {
    stopPolling();
    disconnectSocket();
    navigate("login");
  });

  window.addEventListener("app:authenticated", () => {
    bootstrapAfterAuth();
  });
}

function updateFriendStatus(userId: number, status: string) {
  const friends = state.friends.map((f) =>
    f.id === userId ? { ...f, status: status as typeof f.status } : f
  );
  setState({ friends });
  if (state.user?.id === userId && state.user) {
    setState({ user: { ...state.user, status: status as typeof state.user.status } });
  }
}

function updateTitle() {
  const total = Object.values(state.unread).reduce((a, b) => a + b, 0);
  document.title = total
    ? `(${total}) Klyvochat`
    : "Klyvochat";
}

subscribe(() => updateTitle());

window.addEventListener("DOMContentLoaded", () => {
  setupGlobalSocketHandlers();
  startApp();
});

window.addEventListener("beforeunload", () => {
  stopPolling();
  disconnectSocket();
  savePersistedState();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-overlay").forEach((m) => {
      (m as HTMLElement).style.display = "none";
    });
  }
});