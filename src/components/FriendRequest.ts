import { api } from "../lib/api";
import type { FriendRequestItem } from "../lib/store";
import { avatarHtml, escapeHtml } from "../lib/ui";

export function FriendRequestToast(req: FriendRequestItem): string {
  if (!req.user) return "";
  return `
    <div class="toast friend-request-toast" data-req-id="${req.id}">
      ${avatarHtml(req.user, 40)}
      <div class="toast-info">
        <div class="toast-title">Solicitação de amizade</div>
        <div class="toast-name">${escapeHtml(req.user.display_name || req.user.username)}</div>
      </div>
      <div class="toast-actions">
        <button class="btn-accept" data-action="toast-accept" data-id="${req.id}">Aceitar</button>
        <button class="btn-reject" data-action="toast-reject" data-id="${req.id}">Rejeitar</button>
      </div>
    </div>
  `;
}

export function showToast(html: string) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  const first = div.firstElementChild as HTMLElement;
  container.appendChild(first);
  setTimeout(() => first?.remove(), 8000);

  const close = (el: HTMLElement) => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  };

  first?.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    if (target.matches("[data-action='toast-accept']")) {
      await api.post(`/api/friends/accept/${target.dataset.id}`);
      close(first);
    } else if (target.matches("[data-action='toast-reject']")) {
      await api.post(`/api/friends/reject/${target.dataset.id}`);
      close(first);
    }
  });
}