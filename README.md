# Klyvochat

[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri)](https://tauri.app/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io)](https://socket.io/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)](https://www.sqlite.org/)

Aplicativo desktop de chat e conversa por voz inspirado no design do Steam Chat. Janela flutuante, sempre no topo, com tray, atalho global e chat em tempo real.

## Stack

- **Desktop**: Tauri 2.0
- **Frontend**: HTML + Tailwind CSS v4 + TypeScript + Vite
- **Backend**: Node.js + Express + Socket.io
- **Voz/Dados**: LiveKit (client-sdk-js v2 + server-sdk)
- **Banco**: SQLite + Drizzle ORM

## Estrutura

```
├── src/            # Frontend (Vite + Tailwind + componentes)
├── src-tauri/      # Configuração Tauri (janela flutuante, tray, atalho global)
├── backend/        # API Express + Socket.io + LiveKit + SQLite
└── README.md       # Este arquivo
```

## Variáveis de ambiente

Copie os arquivos de exemplo e ajuste conforme necessário:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

### `.env` (raiz)
Usado pelo frontend via Vite:
- `VITE_API_URL`: URL do backend (dev local: `http://localhost:3001`)
- `VITE_LIVEKIT_URL`: URL do servidor LiveKit

### `backend/.env`
Usado pelo backend:
- `PORT`: porta do servidor (padrão: 3001)
- `JWT_SECRET`: segredo para assinar JWTs (mude em produção)
- `DATABASE_PATH`: caminho do banco SQLite
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_URL`: credenciais LiveKit

## Como rodar

1. Instale as dependências:
    ```bash
    pnpm install
    cd backend && pnpm install && cd ..
    ```

2. Inicie o backend (porta 3001):
    ```bash
    cd backend
    pnpm db:migrate   # primeira vez (cria o banco SQLite)
    pnpm dev
    ```

3. Inicie o frontend + Tauri:
    ```bash
    pnpm tauri dev
    ```
    (ou apenas `pnpm dev` para testar no navegador em http://localhost:1420)

### Voz (LiveKit)

Para voz funcionar, é necessário um servidor LiveKit:

- **Local (dev)**: `docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp livekit/livekit-server:latest --dev`
- **Cloud**: defina `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` e `LIVEKIT_URL` no `backend/.env`.

O secret padrão do modo `--dev` é `devkey:secret` (já configurado em `backend/.env`).

## Configuração

Copie `backend/.env` e ajuste `JWT_SECRET` e as credenciais do LiveKit conforme necessário.

## Build

```bash
pnpm tauri build   # gera .deb e .AppImage no Linux / .msi e .exe no Windows
```

O build deve ser feito na plataforma alvo (Linux no Linux, Windows no Windows).