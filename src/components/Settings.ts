import { load, Store } from "@tauri-apps/plugin-store";
import { api } from "../lib/api";
import { state, setState, DEFAULT_SETTINGS, type Settings as SettingsType } from "../lib/store";
import { navigate } from "../lib/router";
import { avatarHtml, escapeHtml } from "../lib/ui";

let store: Store | null = null;

async function getStore(): Promise<Store | null> {
  if (store) return store;
  try {
    store = await load("settings.json", { autoSave: true });
    return store;
  } catch {
    return null;
  }
}

export async function loadSettings(): Promise<void> {
  const s = await getStore();
  if (!s) {
    setState({ settings: { ...DEFAULT_SETTINGS } });
    return;
  }
  try {
    const saved = (await s.get<SettingsType>("settings")) ?? DEFAULT_SETTINGS;
    setState({ settings: { ...DEFAULT_SETTINGS, ...saved } });
  } catch {
    setState({ settings: { ...DEFAULT_SETTINGS } });
  }
}

export async function saveSettings(): Promise<void> {
  const s = await getStore();
  if (!s) return;
  try {
    await s.set("settings", state.settings);
  } catch {
    /* browser dev */
  }
}

export function Settings(): string {
  const u = state.user;
  const s = state.settings;
  return `
    <div class="settings-view">
      <div class="settings-header">
        <button id="btn-settings-back" class="icon-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <h2>Configurações</h2>
      </div>
      <div class="settings-scroll">
        <section class="settings-section">
          <h3>Perfil</h3>
          <div class="settings-profile">
            <div class="settings-avatar">
              ${u ? avatarHtml(u, 64, u.status) : ""}
            </div>
            <div>
              <input id="settings-displayname" class="auth-input" value="${escapeHtml(u?.display_name || u?.username || "")}" placeholder="Nome de exibição" />
              <button id="btn-settings-upload" class="auth-btn small">Alterar avatar</button>
              <input id="settings-avatar-file" type="file" accept="image/*" style="display:none" />
            </div>
          </div>
        </section>
        <section class="settings-section">
          <h3>Notificações</h3>
          <div class="setting-row">
            <label>Notificações sonoras</label>
            <input id="toggle-sound" type="checkbox" ${s.sound ? "checked" : ""} />
          </div>
          <div class="setting-row">
            <label>Notificações do sistema</label>
            <input id="toggle-notifications" type="checkbox" ${s.notifications ? "checked" : ""} />
          </div>
        </section>
        <section class="settings-section">
          <h3>Atalho global</h3>
          <p class="settings-hint">Mostrar/ocultar janela</p>
          <input id="settings-shortcut" class="auth-input" value="${escapeHtml(s.shortcut)}" readonly />
        </section>
        <section class="settings-section">
          <h3>Sobre</h3>
          <p class="settings-hint">Klyvochat v0.1.0 — Chat e voz inspirado no Steam Chat</p>
          <p class="settings-hint">Repositório: <a href="https://github.com" target="_blank" rel="noopener">github.com</a></p>
        </section>
      </div>
      <div class="settings-footer">
        <button id="btn-settings-save" class="auth-btn">Salvar</button>
      </div>
    </div>
  `;
}

export function mountSettings() {
  document.getElementById("btn-settings-back")?.addEventListener("click", () => {
    navigate("chat");
  });

  document.getElementById("btn-settings-save")?.addEventListener("click", async () => {
    const sound = (document.getElementById("toggle-sound") as HTMLInputElement)?.checked ?? state.settings.sound;
    const notifications =
      (document.getElementById("toggle-notifications") as HTMLInputElement)?.checked ??
      state.settings.notifications;
    const displayName = (document.getElementById("settings-displayname") as HTMLInputElement)?.value.trim();

    setState({ settings: { ...state.settings, sound, notifications } });

    if (displayName && state.user && displayName !== state.user.display_name) {
      await api.put("/api/users/profile", { display_name: displayName }).catch(() => {});
      setState({
        user: { ...state.user, display_name: displayName },
      });
    }
    await saveSettings();
    navigate("chat");
  });

  document.getElementById("btn-settings-upload")?.addEventListener("click", () => {
    (document.getElementById("settings-avatar-file") as HTMLInputElement)?.click();
  });

  document.getElementById("settings-avatar-file")?.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("avatar", file);
    try {
      const res = await api.upload<{ avatar_url: string }>("/api/users/avatar", form);
      if (state.user) {
        setState({ user: { ...state.user, avatar_url: res.avatar_url } });
      }
    } catch (ex) {
      console.error(ex);
    }
  });
}