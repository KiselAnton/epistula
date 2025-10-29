# Epistula – ISO App (Docs for current state)

This repository contains a minimal, containerized Epistula build intended for turnkey classroom/lab installs and local demos. It provides a small FastAPI backend and a Next.js frontend, both packaged with helper scripts for build/run/update.

If you're looking for how to use the app (login, dashboard, etc.), see the updated [USER_GUIDE.md](USER_GUIDE.md). For a 2‑minute setup, see [QUICKSTART.md](QUICKSTART.md).

## What’s in this build

- Backend: FastAPI with in‑memory users and a bootstrapped Root account
- Frontend: Next.js 14 (TypeScript) with a simple login and dashboard
- ISO helper tooling: optional scripts to assemble an ISO that auto‑starts containers
- Docker scripts: one‑command start/stop/restart/update

This build intentionally avoids external dependencies (no DB, no Keycloak). It’s perfect for offline or constrained environments.

## Repository layout

```
epistula/
├─ backend/            # FastAPI app (auth, health, version)
├─ frontend/           # Next.js app (login + dashboard)
├─ isos/               # Place Ubuntu ISOs here (optional)
└─ …
```

Top‑level scripts:

- `start_epistula.sh` – build and run containers (also stop/restart/status/logs)
- `update_epistula.sh` – pull latest code and rebuild/restart containers
- `setup_epistula_iso.sh` – optional ISO tooling

## Requirements

- Docker (Docker Desktop on Windows; dockerd on Linux)
- Bash shell (on Windows, use WSL Ubuntu)

Windows tip: run the scripts from WSL in the repo directory (e.g., `/mnt/d/epistula/epistula`) and ensure Docker Desktop is running.

## Quick start

See the full quick guide in [QUICKSTART.md](QUICKSTART.md). The short version:

```bash
cd /path/to/epistula
sudo ./start_epistula.sh            # first run builds & starts containers
# or
sudo ./update_epistula.sh --force   # pull, rebuild, restart
```

Open the app at:

- Frontend: http://localhost:3000
- Backend:  http://localhost:8000

## Authentication model (current)

- A Root user is created on startup with:
  - email: `root@localhost.localdomain` (UI allows typing just `root`)
  - password: provided at first start (or auto‑generated) via `start_epistula.sh`
  - local‑only login: Root can log in only from allowed IPs (`127.0.0.1`, `::1`, `172.17.0.1` by default)
- Users are stored in memory for this minimal build (no persistent DB).

Environment variables the backend honors (forwarded by `start_epistula.sh`):

- `EPISTULA_ROOT_EMAIL` (default: `root@localhost.localdomain`)
- `EPISTULA_ROOT_NAME` (default: `root`)
- `EPISTULA_ROOT_PASSWORD` (prompted/generated if empty)
- `EPISTULA_ROOT_ALLOWED_IPS` (comma‑separated list)
- `EPISTULA_CORS_ORIGINS` (comma‑separated list of allowed origins; default `*` for local use. In production, set explicit origins.)

## Frontend behavior

- Health probe on page load to avoid slow login timeouts
- Login form validation; accepts `root` alias and standard emails
- On success: token saved in `localStorage`, redirect to `/dashboard`
- Cross‑tab sync: login/logout is synchronized across browser tabs
- Auto‑redirect from login if already authenticated
- Dashboard auto‑logout after 1 hour of inactivity

Backend CORS is open (`allow_origins=["*"]` and no cookies) so the browser can call the API from a different port/host during local use.

## Update flow

Run the updater from the repo root:

```bash
sudo ./update_epistula.sh --force           # optional: --branch <name>
```

It will pull the branch, rebuild images, and restart both containers. This also fixes issues caused by stale frontend builds (Next.js embeds code at build time).

## Troubleshooting

- Windows: If PowerShell says Docker isn’t running, try the same command from WSL; Docker Desktop exposes a Linux engine accessible from WSL.
- “No such file or directory” when running scripts: ensure you’re in the repo root and use `./update_epistula.sh` (note the underscore). Grant exec permission with `chmod +x *.sh` if needed.
- Login shows 422 on bad email: the UI will show a validation message. Wrong credentials return “Incorrect email or password”.
- Frontend calls the wrong endpoint after an update: rebuild using the updater; Next.js requires a new build to pick up code changes.

## License

MIT – see [LICENSE](LICENSE).

## Contributing

Lightweight contributions are welcome. Please follow [CODESTYLE.md](CODESTYLE.md). For now, keep changes small and focused on this minimal build.
