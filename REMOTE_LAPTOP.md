# Working on another machine (laptop / remote)

This repo is the **lead-platform** (monorepo: Nest API + Next.js web). You do **not** need a custom `Dockerfile` for the app: Postgres and Redis run via **`docker-compose.yml`** using official images.

## What to copy (not in Git)

| Item | Purpose |
|------|--------|
| `apps/api/.env` | API: `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, Redis, Stripe keys, `APP_BASE_URL`, Stripe Price IDs, etc. |
| `apps/web/.env` | Web: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| Optional: Stripe CLI / webhook secrets | If you test webhooks locally |

Keep secrets out of chat and out of commits. Use a password manager or encrypted USB—not a public gist.

## What Git gives you

- Source code, migrations, `pnpm-lock.yaml` (after you commit it once), `docker-compose.yml`, `apps/*/README.md`, `.env.example` templates.

## On the laptop (first time)

1. **Install** [Node.js](https://nodejs.org/) LTS and [pnpm](https://pnpm.io/installation) (`npm i -g pnpm`).
2. **Install Docker Desktop** (or Docker Engine + Compose) if you want Postgres/Redis in containers.
3. **Clone** and enter the repo:
   ```bash
   git clone https://github.com/HarisMemoon/leads-platform.git
   cd leads-platform
   ```
4. **Restore env files** from your backup (copy `apps/api/.env` and `apps/web/.env`).
5. **Start databases** (from repo root):
   ```bash
   docker compose up -d
   ```
   This uses Postgres on `5432` and Redis on `6379` as in a typical `DATABASE_URL` / `REDIS_URL`.
6. **Install dependencies** (from repo root):
   ```bash
   pnpm install
   ```
7. **API** (`apps/api`):
   ```bash
   cd apps/api
   pnpm run migration:run
   pnpm run start:dev
   ```
   Default API URL: `http://localhost:5000` (see `PORT` in `main.ts`).
8. **Web** (`apps/web`) in another terminal:
   ```bash
   cd apps/web
   pnpm dev
   ```
   Ensure `NEXT_PUBLIC_API_URL` in `apps/web/.env` matches the API (e.g. `http://localhost:5000`).

## Dockerfile?

- **No** application `Dockerfile` is required for day-to-day dev.
- **`docker-compose.yml`** is enough: it only runs **Postgres** and **Redis** images.
- You would add a Dockerfile only if you want to **containerize the API/web** for deployment—optional.

## Seashore (other project)

Not in this repo. Same idea: clone that repo, copy its `.env` / env files, install per its README (`pnpm`/`npm`/`yarn`), run DB via its compose or local install, then dev script.

## Pushing from your main PC before you leave

```bash
git add -A
git status   # confirm no .env files
git commit -m "Describe your changes"
git push origin <your-branch>
```

On the laptop: `git pull` and follow the steps above.
