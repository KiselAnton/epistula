# Epistula – User Guide (current build)

This guide matches the minimal ISO build in this repository.

## Sign in

1) Open http://localhost:3000 in your browser

2) On the login page:

- Email: type `root` (or the full email `root@localhost.localdomain`)
- Password: the value you set (or that was generated) when starting the app

The “Login” button stays disabled until a valid email and password are entered and the backend is reachable.

Error cases:

- Invalid email format: the form shows “Please enter a valid email address.”
- Wrong email/password: you’ll see “Incorrect email or password”.

## Dashboard

After successful login you’ll be redirected to `/dashboard`.

What’s included today:

- A simple greeting (shows your name or email)
- Logout button
- Auto‑logout after 1 hour of inactivity
- Login state sync across browser tabs (login/logout in one tab updates the others)

If your session is missing or expires, you’ll be returned to the login page.

## Import/Export: what do the options mean?

When moving data between the temporary area and live data, you may see these choices:

- Temporary area: a safe copy for testing. Changes here don’t affect your live data until you choose to promote them.
- Replace: throw away matching items in the destination and load exactly what’s in the file.
- Merge: keep what you already have, update matching items, and add anything missing.
- Skip existing: only add new items; don’t change anything that’s already there.

Tip: If you’re unsure, try it in the temporary area first. Promote to live only after you’ve checked everything looks right.

## Tips & troubleshooting

- If the login page says the server is not reachable, ensure the backend is running on port 8000. The quick fix is to re‑run the updater:
  ```bash
  sudo ./update_epistula.sh --force
  ```
- If you recently changed frontend code and the UI still behaves like before, rebuild with the updater. Next.js embeds code at build time.
- Windows users should run scripts from WSL and keep Docker Desktop running.

## What’s not in this minimal build

- No persistent database or user management UI
- No external identity provider
- No letter composition yet – this build focuses on the system frame (auth + containerization)

For setup details and environment variables, see [README.md](README.md) and [FRONTEND.md](FRONTEND.md).
