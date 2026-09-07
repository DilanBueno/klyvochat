export type View = "login" | "register" | "chat" | "settings";

let currentView: View = "chat";

const viewEls = {
  login: () => document.getElementById("view-login"),
  register: () => document.getElementById("view-register"),
  chat: () => document.getElementById("view-chat"),
  settings: () => document.getElementById("view-settings"),
};

export function navigate(view: View) {
  currentView = view;
  (Object.keys(viewEls) as View[]).forEach((v) => {
    const el = viewEls[v]();
    if (el) el.style.display = v === view ? "flex" : "none";
  });
  window.dispatchEvent(new CustomEvent("app:view", { detail: { view } }));
}

export function getCurrentView(): View {
  return currentView;
}