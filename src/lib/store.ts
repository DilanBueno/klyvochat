export type Status = "online" | "away" | "invisible";

export interface User {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: Status;
}

export interface Message {
  id: number;
  room_id: number;
  content: string;
  type: "text" | "image" | "system";
  created_at: string;
  user: User | null;
}

export interface Conversation {
  id: number;
  name: string | null;
  is_group: boolean;
  avatar_url: string | null;
  members: User[];
  last_message: string | null;
  updated_at: string;
  unread?: number;
}

export interface FriendRequestItem {
  id: number;
  created_at: string;
  user: User | null;
}

export interface VoiceChannelItem {
  id: number;
  room_id: number;
  name: string;
  max_participants: number;
  participants: User[];
}

export interface Settings {
  theme: string;
  notifications: boolean;
  sound: boolean;
  shortcut: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  notifications: true,
  sound: true,
  shortcut: "Ctrl+Shift+C",
};

export interface State {
  user: User | null;
  conversations: Conversation[];
  activeConversation: number | null;
  friends: User[];
  friendRequests: FriendRequestItem[];
  voiceChannel: { roomId: number; channelId: number; name: string } | null;
  settings: Settings;
  unread: Record<number, number>;
}

export type Listener = (state: State) => void;

const listeners = new Set<Listener>();

export const state: State = {
  user: null,
  conversations: [],
  activeConversation: null,
  friends: [],
  friendRequests: [],
  voiceChannel: null,
  settings: { ...DEFAULT_SETTINGS },
  unread: {},
};

export function setState(partial: Partial<State>) {
  Object.assign(state, partial);
  emit();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emit() {
  for (const l of listeners) l(state);
}

export function getActiveConversation(): Conversation | undefined {
  return state.conversations.find((c) => c.id === state.activeConversation);
}

export function upsertConversation(conv: Partial<Conversation> & { id: number }) {
  const idx = state.conversations.findIndex((c) => c.id === conv.id);
  if (idx >= 0) {
    state.conversations[idx] = { ...state.conversations[idx], ...conv };
  } else {
    state.conversations.push(conv as Conversation);
  }
  emit();
}

export function clearUnread(roomId: number) {
  const unread = { ...state.unread };
  delete unread[roomId];
  setState({ unread });
}