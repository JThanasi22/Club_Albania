# AGENTS.md

## Cursor Cloud specific instructions

### Product

**Club Albania Manager** — Next.js 16 full-stack admin app (players, payments, attendance, teams). Dev server runs on **port 4000** (`bun run dev`), not 3000.

### Required services

| Service | Notes |
|---------|--------|
| **MongoDB** | Prisma uses `mongodb` provider. `DATABASE_URL` must start with `mongo` (see `src/lib/db.ts`). |
| **Next.js** | `bun run dev` after MongoDB is up. |

MongoDB must run as a **replica set** (even single-node) or Prisma writes (e.g. `POST /api/auth/seed`, login) fail with `P2031`.

Start MongoDB (if not already running):

```bash
sudo mkdir -p /data/db && sudo chown mongodb:mongodb /data/db
sudo -u mongodb mongod --replSet rs0 --dbpath /data/db --bind_ip 127.0.0.1 --port 27017 --fork --logpath /var/log/mongodb/mongod.log
mongosh --quiet --eval 'try { rs.status() } catch(e) { rs.initiate({_id:"rs0", members:[{_id:0, host:"127.0.0.1:27017"}]}) }'
```

Copy `.env.example` to `.env` and set `DATABASE_URL=mongodb://127.0.0.1:27017/club_albania` (the example SQLite URL is legacy and does not match the schema).

### Common commands

See `package.json` scripts:

- **Install:** `bun install` (Bun is the project package manager; install via https://bun.sh if missing)
- **DB schema:** `bun run db:push` (after MongoDB + `.env`)
- **Dev:** `bun run dev` → http://localhost:4000
- **Lint:** `bun run lint`
- **Build:** `bun run build` (runs `prisma generate` then `next build`)
- **Prod:** `bun start` (standalone server; default port 3000)

### First-time admin

```bash
curl -X POST http://localhost:4000/api/auth/seed
```

Default credentials: `admin` / `admin123` (only if no admin exists).

### Optional integrations

Cloudinary (uploads), `GOOGLE_API_KEY` (admin AI chat). Core CRUD works without them.

### Gotchas

- `.env.example` still lists SQLite; use MongoDB only.
- No `docker-compose` or automated test script in `package.json`.
- Long-running dev server: use tmux (see environment setup docs).
