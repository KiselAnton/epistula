# Frontend (current build)

This Next.js 14 app provides a minimal login + dashboard. It’s packaged to run in Docker via `start_epistula.sh`, but you can also run it in dev mode.

## Tech

- Next.js 14 + React 18 + TypeScript
- CSS Modules
- Fetch API for backend calls

## Structure

```
frontend/
├─ pages/
│  ├─ _app.tsx
│  ├─ index.tsx        # login
│  └─ dashboard.tsx    # post‑login view, auto‑logout
├─ styles/
│  ├─ globals.css
│  └─ Login.module.css
├─ next.config.js
├─ package.json
└─ tsconfig.json
```

## How the frontend finds the backend

- In the browser, the app calls the backend at `http(s)://<current-host>:8000`.
- During SSR, a safe fallback is used. In Docker, SSR can reach the host via `host.docker.internal` (configured at build time), but all user actions are called from the browser, so the browser rule dominates.

This design works the same on localhost, LAN hostnames, WSL, and VMs.

## Login

POST ` /api/v1/users/login ` with body:

```json
{ "email": "<string>", "password": "<string>" }
```

UI behavior:

- Health check runs on page load to avoid slow login timeouts
- Email validation allows `root` alias (mapped to `root@localhost.localdomain`)
- On success, token + user are stored in `localStorage`; redirect to `/dashboard`
- Tabs are synchronized via the Storage event

## Dashboard

- Greets the user, provides a logout button
- Auto‑logout after 1 hour of inactivity (mouse/keyboard/scroll/touch)

## Rebuilds matter (Next.js)

Next.js embeds code at build time. If you change frontend code, you must rebuild the image:

```bash
sudo ./update_epistula.sh --force   # rebuilds and restarts containers
```

If the UI still behaves like an older version (e.g., hitting a stale endpoint), rebuild with the command above.

## Dev mode (optional)

```bash
cd epistula/frontend
npm install
npm run dev
# open http://localhost:3000
```

You’ll also need the backend running (see `epistula/backend`).

## Common issues

- “Server not reachable” banner on login page: ensure the backend is up on port 8000.
- CORS: the backend allows all origins with no credentials, so browsers can reach it from a different port/host locally.
- Windows: prefer running with Docker + WSL; ensure Docker Desktop is running.
