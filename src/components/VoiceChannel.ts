import { api } from "../lib/api";
import { state, subscribe, setState, type VoiceChannelItem } from "../lib/store";
import { avatarHtml, escapeHtml } from "../lib/ui";
import { joinVoice, leaveVoice } from "../lib/livekit";
import { VoiceControls, mountVoiceControls } from "./VoiceControls";

let cached: Record<number, VoiceChannelItem[]> = {};

async function loadChannels(roomId: number) {
  try {
    const res = await api.get<{ channels: VoiceChannelItem[] }>(
      `/api/rooms/${roomId}/voice-channels`
    );
    cached[roomId] = res.channels;
    window.dispatchEvent(new CustomEvent("app:voice-channels"));
  } catch {
    /* ignore */
  }
}

export async function refreshVoiceChannels(roomId: number) {
  await loadChannels(roomId);
}

export function VoiceChannel(): string {
  return `
    <div id="voice-channel-section-inner" class="voice-section">
      <div class="section-label voice-toggle">
        <span>Canais de Voz</span>
        <span class="voice-count" id="voice-channel-count"></span>
      </div>
      <div id="voice-channels-list" class="voice-channels-list"></div>
      <div id="voice-controls-placeholder"></div>
    </div>
  `;
}

function renderChannel(c: VoiceChannelItem): string {
  const connected = state.voiceChannel?.channelId === c.id;
  return `
    <div class="voice-channel ${connected ? "connected" : ""}" data-channel-id="${c.id}">
      <div class="voice-channel-row">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z" stroke="currentColor" stroke-width="2"/><path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" stroke-width="2"/></svg>
        <span class="voice-name">${escapeHtml(c.name)}</span>
        <span class="voice-user-count">${c.participants.length}</span>
      </div>
      <div class="voice-participants">
        ${c.participants
          .map(
            (p) => `
            <div class="voice-participant" data-user-id="${p.id}">
              ${avatarHtml(p, 24, "online")}
              <span>${escapeHtml(p.display_name || p.username)}</span>
            </div>
          `
          )
          .join("")}
      </div>
      <button class="voice-join-btn" data-action="toggle-voice" data-channel-id="${c.id}" data-channel-name="${escapeHtml(c.name)}">
        ${connected ? "Sair" : "Entrar"}
      </button>
    </div>
  `;
}

let lastRoomId: number | null = null;

export function mountVoiceChannel() {
  const render = async () => {
    const section = document.getElementById("voice-channel-section");
    if (!section) return;
    section.innerHTML = VoiceChannel();

    const roomId = state.activeConversation;
    if (roomId !== lastRoomId) {
      lastRoomId = roomId;
      if (roomId) loadChannels(roomId);
    }
    if (!roomId) return;

    const channels = cached[roomId] ?? [];
    const list = document.getElementById("voice-channels-list");
    const count = document.getElementById("voice-channel-count");
    if (list) {
      list.innerHTML = channels.length
        ? channels.map(renderChannel).join("")
        : `<div class="empty-hint">Sem canais de voz</div>`;
    }
    if (count) count.textContent = channels.length ? `(${channels.length})` : "";

    if (state.voiceChannel && state.voiceChannel.roomId === roomId) {
      const placeholder = document.getElementById("voice-controls-placeholder");
      if (placeholder) {
        placeholder.innerHTML = VoiceControls();
        mountVoiceControls();
      }
    }
  };

  render();
  subscribe(() => render());

  window.addEventListener("app:voice-channels", render);
  window.addEventListener("app:voice-join", () => {
    if (state.activeConversation) loadChannels(state.activeConversation);
  });
  window.addEventListener("app:voice-leave", () => {
    if (state.activeConversation) loadChannels(state.activeConversation);
  });
  window.addEventListener("app:voice-disconnected", () => {
    setState({ voiceChannel: null });
  });

  document.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest("[data-action='toggle-voice']") as HTMLElement | null;
    if (!btn) return;
    const channelId = Number(btn.dataset.channelId);
    const name = btn.dataset.channelName || "Canal";
    const roomId = state.activeConversation;
    if (!roomId) return;

    const isConnected = state.voiceChannel?.channelId === channelId;
    if (isConnected) {
      await leaveVoice();
      await api.post(`/api/rooms/voice-channels/${channelId}/leave`);
      setState({ voiceChannel: null });
      if (roomId) loadChannels(roomId);
    } else {
      await api.post(`/api/rooms/voice-channels/${channelId}/join`);
      try {
        await joinVoice(roomId, channelId);
        setState({ voiceChannel: { roomId, channelId, name } });
      } catch {
        await api.post(`/api/rooms/voice-channels/${channelId}/leave`);
        console.error("Falha ao entrar no canal de voz");
      }
      loadChannels(roomId);
    }
  });
}

export function reloadVoiceChannel() {
  if (state.activeConversation) loadChannels(state.activeConversation);
}