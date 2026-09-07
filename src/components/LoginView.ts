import { api, setToken } from "../lib/api";
import { navigate } from "../lib/router";

export function loginViewHtml(): string {
  return `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-logo">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="16" rx="4" fill="#66c0f4"/>
            <path d="M8 10l3 3 5-5" stroke="#1b2838" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1 class="auth-title">Klyvochat</h1>
        <p class="auth-subtitle">Entre para conversar</p>
        <form id="login-form" class="auth-form">
          <label>Usuário</label>
          <input id="login-username" class="auth-input" placeholder="seu usuario" autocomplete="username" required />
          <label>Senha</label>
          <input id="login-password" type="password" class="auth-input" placeholder="sua senha" autocomplete="current-password" required />
          <p id="login-error" class="auth-error"></p>
          <button type="submit" class="auth-btn">Entrar</button>
        </form>
        <p class="auth-switch">Não tem conta? <a href="#" id="go-register">Criar conta</a></p>
      </div>
    </div>
  `;
}

export function registerViewHtml(): string {
  return `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-logo">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="16" rx="4" fill="#66c0f4"/>
            <path d="M8 10l3 3 5-5" stroke="#1b2838" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1 class="auth-title">Criar conta</h1>
        <p class="auth-subtitle">Comece a usar o Klyvochat</p>
        <form id="register-form" class="auth-form">
          <label>Usuário</label>
          <input id="register-username" class="auth-input" placeholder="min 3 caracteres" autocomplete="username" required />
          <label>Senha</label>
          <input id="register-password" type="password" class="auth-input" placeholder="min 6 caracteres" autocomplete="new-password" required />
          <p id="register-error" class="auth-error"></p>
          <button type="submit" class="auth-btn">Criar conta</button>
        </form>
        <p class="auth-switch">Já tem conta? <a href="#" id="go-login">Entrar</a></p>
      </div>
    </div>
  `;
}

export function mountLoginView() {
  document.getElementById("go-register")?.addEventListener("click", (e) => {
    e.preventDefault();
    navigate("register");
  });

  document.getElementById("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("login-error");
    const username = (document.getElementById("login-username") as HTMLInputElement)?.value.trim();
    const password = (document.getElementById("login-password") as HTMLInputElement)?.value;
    if (err) err.textContent = "";
    try {
      const res = await api.post<{ token: string; user: unknown }>("/api/auth/login", {
        username,
        password,
      });
      setToken(res.token);
      window.dispatchEvent(new CustomEvent("app:authenticated", { detail: { user: res.user } }));
    } catch (ex) {
      if (err) err.textContent = ex instanceof Error ? ex.message : "Erro ao entrar";
    }
  });
}

export function mountRegisterView() {
  document.getElementById("go-login")?.addEventListener("click", (e) => {
    e.preventDefault();
    navigate("login");
  });

  document.getElementById("register-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("register-error");
    const username = (document.getElementById("register-username") as HTMLInputElement)?.value.trim();
    const password = (document.getElementById("register-password") as HTMLInputElement)?.value;
    if (err) err.textContent = "";
    try {
      const res = await api.post<{ token: string; user: unknown }>("/api/auth/register", {
        username,
        password,
      });
      setToken(res.token);
      window.dispatchEvent(new CustomEvent("app:authenticated", { detail: { user: res.user } }));
    } catch (ex) {
      if (err) err.textContent = ex instanceof Error ? ex.message : "Erro ao criar conta";
    }
  });
}