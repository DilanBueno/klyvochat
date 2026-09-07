import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { state } from "./store";

let audioCtx: AudioContext | null = null;

export function playSound() {
  if (!state.settings.sound) return;
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AC();
    }
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    /* sem áudio */
  }
}

let notifPerm: boolean | null = null;

export async function ensureNotifPermission(): Promise<boolean> {
  try {
    if (notifPerm === null) {
      notifPerm = await isPermissionGranted();
      if (!notifPerm) {
        notifPerm = (await requestPermission()) === "granted";
      }
    }
    return notifPerm;
  } catch {
    return false;
  }
}

export function sendOsNotification(title: string, body: string) {
  if (!state.settings.notifications) return;
  try {
    void ensureNotifPermission().then((ok) => {
      if (ok) sendNotification({ title, body });
    });
  } catch {
    /* browser dev */
  }
}