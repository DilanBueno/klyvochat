import { state, setState } from "../lib/store";
import { setMicEnabled, setDeafened, leaveVoice, isMicEnabled } from "../lib/livekit";
import { api } from "../lib/api";
import { escapeHtml } from "../lib/ui";

let muted = false;
let deafened = false;
let timer: ReturnType<typeof setInterval> | null = null;
let seconds = 0;

export function VoiceControls(): string {
  const channel = state.voiceChannel;
  if (!channel) return "";
  return `
    <div class="voice-controls">
      <div class="voice-controls-header">
        <span class="voice-connected-dot"></span>
        <span>${escapeHtml(channel.name)}</span>
        <span class="voice-timer" id="voice-timer">00:00</span>
      </div>
      <div class="voice-controls-buttons">
        <button id="btn-mute" class="vc-btn ${muted ? "active" : ""}" title="${muted ? "Desmutar" : "Mutar mic"}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z" stroke="currentColor" stroke-width="2"/><path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" stroke-width="2"/></svg>
        </button>
        <button id="btn-deafen" class="vc-btn ${deafened ? "active" : ""}" title="${deafened ? "Undeafen" : "Deafen"}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M11 4a6 6 0 00-6 6v5H3v5h4v-5H6v-5a5 5 0 0110 0v5h-1v5h4v-5h-2v-5a6 6 0 00-6-6z" stroke="currentColor" stroke-width="2"/></svg>
        </button>
        <button id="btn-disconnect" class="vc-btn vc-disconnect" title="Desconectar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6.2 17.8a8 8 0 010-11.6M9.5 14.5a3.5 3.5 0 010-5M14.5 14.5a3.5 3.5 0 000-5M17.8 17.8a8 8 0 000-11.6M12 12l9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="voice-level" id="voice-level">
        <span></span><span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span><span></span><span></span>
      </div>
    </div>
  `;
}

export function mountVoiceControls() {
  muted = !isMicEnabled();
  const channel = state.voiceChannel;

  const toggleMute = async () => {
    muted = !muted;
    await setMicEnabled(!muted);
    document.getElementById("btn-mute")?.classList.toggle("active", muted);
  };

  const toggleDeafen = async () => {
    deafened = !deafened;
    await setDeafened(deafened);
    document.getElementById("btn-deafen")?.classList.toggle("active", deafened);
    if (deafened) {
      document.getElementById("btn-mute")?.classList.add("active");
      muted = true;
    }
  };

  const disconnect = async () => {
    await leaveVoice();
    if (channel) {
      await api.post(`/api/rooms/voice-channels/${channel.channelId}/leave`);
    }
    setState({ voiceChannel: null });
    seconds = 0;
    if (timer) clearInterval(timer);
    timer = null;
  };

  document.getElementById("btn-mute")?.addEventListener("click", toggleMute);
  document.getElementById("btn-deafen")?.addEventListener("click", toggleDeafen);
  document.getElementById("btn-disconnect")?.addEventListener("click", disconnect);

  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    seconds++;
    const el = document.getElementById("voice-timer");
    if (el) {
      const m = Math.floor(seconds / 60).toString().padStart(2, "0");
      const s = (seconds % 60).toString().padStart(2, "0");
      el.textContent = `${m}:${s}`;
    }
  }, 1000);

  let idx = 0;
  setInterval(() => {
    const level = document.getElementById("voice-level");
    if (!level) return;
    const bars = level.children;
    idx = (idx + 1) % 3;
    for (let i = 0; i < bars.length; i++) {
      const active = i < Math.floor(bars.length * 0.7) && idx === Math.floor(i / 4);
      (bars[i] as HTMLElement).style.opacity = active ? "1" : "0.25";
    }
  }, 250);
}