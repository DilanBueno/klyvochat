import { state } from "../lib/store";
import { avatarHtml, escapeHtml } from "../lib/ui";
import { api } from "../lib/api";
import { navigate } from "../lib/router";

export function UserCard(): string {
  const u = state.user;
  if (!u) return "";
  return `
    <div class="usercard-overlay" id="usercard-overlay" style="display:none">
      <div class="usercard" id="usercard">
        <div class="usercard-top">
          ${avatarHtml(u, 64, u.status)}
          <div class="usercard-names">
            <div class="usercard-name">${escapeHtml(u.display_name || u.username)}</div>
            <div class="usercard-username">@${escapeHtml(u.username)}</div>
          </div>
        </div>
        <div class="usercard-status">
          <label>Status</label>
          <select id="usercard-status-select">
            <option value="online" ${u.status === "online" ? "selected" : ""}>Online</option>
            <option value="away" ${u.status === "away" ? "selected" : ""}>Ausente</option>
            <option value="invisible" ${u.status === "invisible" ? "selected" : ""}>Invisível</option>
          </select>
        </div>
        <div class="usercard-actions">
          <button id="btn-usercard-settings" class="vc-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 01-4 0v-.1a1.6 1.6 0 00-2.7-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 004 15H4a2 2 0 010-4h.1A1.6 1.6 0 005 8.3l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010.5 4H10a2 2 0 014 0h.1a1.6 1.6 0 001.6 1.5h.1A1.6 1.6 0 0017.3 3l.1-.1a2 2 0 112.8 2.8l-.1.1A1.6 1.6 0 0019.4 8.5V8a2 2 0 010 4v.5a1.6 1.6 0 000 .3z" stroke="currentColor" stroke-width="1.5"/></svg>
            <span>Configurações</span>
          </button>
          <button id="btn-usercard-mute" class="vc-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z" stroke="currentColor" stroke-width="2"/><path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" stroke-width="2"/></svg>
            <span>Mute</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

export function mountUserCard() {
  document.getElementById("sidebar-profile")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-action='open-settings']")) return;
    const overlay = document.getElementById("usercard-overlay");
    if (overlay) {
      overlay.style.display = overlay.style.display === "flex" ? "none" : "flex";
    }
  });

  document.getElementById("usercard-overlay")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id === "usercard-overlay") {
      (e.target as HTMLElement).style.display = "none";
    }
  });

  document.getElementById("usercard-status-select")?.addEventListener("change", async (e) => {
    const status = (e.target as HTMLSelectElement).value;
    await api.put("/api/users/status", { status });
  });

  document.getElementById("btn-usercard-settings")?.addEventListener("click", () => {
    const overlay = document.getElementById("usercard-overlay");
    if (overlay) overlay.style.display = "none";
    navigate("settings");
  });
}