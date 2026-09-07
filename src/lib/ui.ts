import { fullUrl } from "./api";
import type { User } from "./store";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const colors = [
    "#57cbde",
    "#66c0f4",
    "#7fb8c4",
    "#8bb8d4",
    "#6ec6e0",
    "#5b7a8f",
  ];
  return colors[Math.abs(hash) % colors.length];
}

export function avatarUrl(user: Pick<User, "avatar_url"> | null): string | null {
  if (!user?.avatar_url) return null;
  return fullUrl(user.avatar_url);
}

export function avatarHtml(
  user: Pick<User, "id" | "username" | "display_name" | "avatar_url"> | null,
  size = 32,
  status?: string | null
): string {
  const url = avatarUrl(user);
  const name = user?.display_name || user?.username || "?";
  const color = hashColor(user?.username || "?");
  const inner = url
    ? `<img src="${url}" alt="" />`
    : `<span>${escapeHtml(name.slice(0, 2).toUpperCase())}</span>`;
  const statusDot = status
    ? `<span class="status-dot" data-status="${status}"></span>`
    : "";
  return `<div class="avatar" style="width:${size}px;height:${size}px;background:${color};font-size:${Math.max(10, size * 0.36)}px" data-username="${escapeHtml(user?.username ?? "")}">${inner}${statusDot}</div>`;
}

export function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function dateLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return "Hoje";
  return d.toLocaleDateString();
}