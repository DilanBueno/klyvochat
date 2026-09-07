import type { Message } from "../lib/store";
import { fullUrl } from "../lib/api";
import { escapeHtml, avatarHtml, timeLabel } from "../lib/ui";

export function formatContent(content: string): string {
  let html = escapeHtml(content);

  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  html = html.replace(
    /((?:https?:\/\/|www\.)[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener">$1</a>'
  );

  html = html.replace(
    /(@[a-zA-Z0-9_]+)/g,
    '<span class="mention">$1</span>'
  );

  return html;
}

export function MessageBubble(msg: Message, isOwn: boolean): string {
  if (msg.type === "system") {
    return `
      <div class="system-message">${formatContent(msg.content)}</div>
    `;
  }

  const sender = msg.user;
  const isImage = msg.type === "image" || /^\/uploads\//.test(msg.content);

  const body = isImage
    ? `<a href="${fullUrl(msg.content)}" target="_blank"><img class="message-image" src="${fullUrl(msg.content)}" /></a>`
    : `<div class="message-text">${formatContent(msg.content)}</div>`;

  return `
    <div class="message-row ${isOwn ? "own" : ""}">
      ${isOwn ? "" : avatarHtml(sender, 32)}
      <div class="message-col">
        <div class="message-meta">
          <span class="message-sender">${escapeHtml(sender?.display_name || sender?.username || "Desconhecido")}</span>
          <span class="message-time" title="${new Date(msg.created_at).toLocaleString()}">${timeLabel(msg.created_at)}</span>
        </div>
        ${body}
      </div>
    </div>
  `;
}