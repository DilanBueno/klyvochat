import { Room, RoomEvent, type Track } from "livekit-client";
import { api, getToken, LIVEKIT_URL } from "./api";

let room: Room | null = null;

export async function joinVoice(
  roomId: number,
  channelId: number
): Promise<Room> {
  await leaveVoice();

  const res = await api.post<{ token: string; url?: string }>("/api/livekit/token", {
    roomId,
    channelId,
  });
  if (!getToken()) throw new Error("Não autenticado");

  const r = new Room({
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  room = r;

  r.on(RoomEvent.TrackSubscribed, (track: Track) => {
    if (track.kind === "audio") {
      const el = track.attach();
      el.autoplay = true;
      document.body.appendChild(el);
    }
  });

  r.on(RoomEvent.TrackUnsubscribed, (track: Track) => {
    if (track.kind === "audio") {
      track.detach().forEach((el) => el.remove());
    }
  });

  r.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
    window.dispatchEvent(
      new CustomEvent("app:speakers", { detail: speakers })
    );
  });

  r.on(RoomEvent.Disconnected, () => {
    room = null;
    window.dispatchEvent(new CustomEvent("app:voice-disconnected"));
  });

  r.on(RoomEvent.Reconnecting, () => {
    window.dispatchEvent(new CustomEvent("app:voice-reconnecting"));
  });

  await r.connect(res.url || LIVEKIT_URL, res.token);
  await r.localParticipant.setMicrophoneEnabled(true);
  return r;
}

export async function setMicEnabled(enabled: boolean) {
  await room?.localParticipant.setMicrophoneEnabled(enabled);
}

export async function setDeafened(deafened: boolean) {
  if (!room) return;
  if (deafened) {
    await room.localParticipant.setMicrophoneEnabled(false);
    room.remoteParticipants.forEach((p) => p.setVolume(0));
  } else {
    await room.localParticipant.setMicrophoneEnabled(true);
    room.remoteParticipants.forEach((p) => p.setVolume(1));
  }
}

export async function leaveVoice() {
  if (room) {
    room.disconnect();
    room = null;
  }
}

export function getVoiceRoom(): Room | null {
  return room;
}

export function isMicEnabled(): boolean {
  return room?.localParticipant.isMicrophoneEnabled ?? false;
}