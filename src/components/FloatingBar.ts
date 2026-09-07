import { getCurrentWindow } from "@tauri-apps/api/window";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function FloatingBar(): string {
  return `
    <div id="floating-bar" class="floating-bar" data-tauri-drag-region>
      <div class="bar-left" data-tauri-drag-region>
        <svg class="bar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="3" fill="#66c0f4"/>
          <path d="M8 10l3 3 5-5" stroke="#1b2838" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="bar-title" data-tauri-drag-region>Klyvochat</span>
      </div>
      <div class="bar-buttons">
        <button id="btn-minimize" class="bar-btn" title="Minimizar (tray)">
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
        <button id="btn-close" class="bar-btn bar-btn-close" title="Fechar">
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>
  `;
}

export function mountFloatingBar() {
  if (!isTauri()) return;
  const win = getCurrentWindow();

  document.getElementById("btn-minimize")?.addEventListener("click", () => {
    win.minimize();
  });

  document.getElementById("btn-close")?.addEventListener("click", () => {
    win.hide();
  });
}