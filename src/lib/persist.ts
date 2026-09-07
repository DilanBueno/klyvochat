import { load, type Store } from "@tauri-apps/plugin-store";
import { getCurrentWindow, LogicalSize, LogicalPosition } from "@tauri-apps/api/window";
import { state, setState } from "./store";

let store: Store | null = null;

async function getStore(): Promise<Store | null> {
  if (store) return store;
  try {
    store = await load("persist.json", { autoSave: true });
    return store;
  } catch {
    return null;
  }
}

export async function savePersistedState(): Promise<void> {
  const s = await getStore();
  if (!s) return;
  try {
    await s.set("activeConversation", state.activeConversation);
    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    const size = await win.outerSize();
    await s.set("window", { x: pos.x, y: pos.y, w: size.width, h: size.height });
  } catch {
    /* browser dev */
  }
}

export async function loadPersistedState(): Promise<void> {
  const s = await getStore();
  if (!s) return;
  try {
    const activeConversation = await s.get<number | null>("activeConversation");
    if (activeConversation) setState({ activeConversation });

    const win = getCurrentWindow();
    const saved = await s.get<{ x: number; y: number; w: number; h: number } | null>("window");
    if (saved?.w && saved?.h) {
      try {
        await win.setSize(new LogicalSize(saved.w, saved.h));
        if (typeof saved.x === "number" && typeof saved.y === "number") {
          await win.setPosition(new LogicalPosition(saved.x, saved.y));
        }
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}