# Quick Start

The fastest way to run the current Epistula ISO app locally.

## 0) Prerequisites

- Docker installed (Docker Desktop on Windows)
- Bash shell

Windows users: open WSL Ubuntu, navigate to this repo under `/mnt/...` and run the commands below. Ensure Docker Desktop is running.

## 1) Start or update

From the repository root:

```bash
# First start (builds and runs)
sudo ./start_epistula.sh

# Or update to latest, rebuild, and restart
sudo ./update_epistula.sh --force            # optional: --branch frontend-login-page
```

When finished you’ll see:

- Frontend: http://localhost:3000
- Backend:  http://localhost:8000

## 2) Log in

On the login page:

- Email: type `root` (alias) or `root@localhost.localdomain`
- Password: what you set at first start, or the generated one shown by the script

Notes:

- Wrong credentials return “Incorrect email or password”.
- If the email format is invalid, the UI shows “Please enter a valid email address.”

## 3) What you get

- Automatic redirect to `/dashboard` after login
- Session saved in localStorage; tabs stay in sync
- Auto‑logout after 1 hour of inactivity

## Useful script commands

```bash
./start_epistula.sh --status    # Show container status
./start_epistula.sh --logs      # Tail backend + frontend logs
./start_epistula.sh --restart   # Restart both containers
./start_epistula.sh --stop      # Stop containers
./start_epistula.sh --clean     # Remove containers/images (prompts)
```

## Troubleshooting

- “No such file or directory” when running scripts: make sure you’re in the repo root and use `./update_epistula.sh` (with underscore).
- PowerShell shows Docker errors: try the same commands from WSL.
- Frontend still shows old behavior after a code change: re‑run the updater; Next.js needs a rebuild to pick up changes.
