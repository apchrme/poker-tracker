# Poker Tracker

A small web app for tracking buy-ins and cash-outs at poker home games. Live at
[poker.phoxiv.org](https://poker.phoxiv.org).

There are no accounts. Someone creates a **room**, which gets a random 4-character code, and
shares the link. Anyone with the link can add and delete players, record transactions, and set
the room's chip-to-dollar rate. Everyone with the room open sees changes within a few seconds.
Rooms are deleted 7 days after they're created.

## Stack

- **App:** [SvelteKit 3](https://svelte.dev/docs/kit) + Svelte 5 (runes), Tailwind CSS 4,
  [shadcn-svelte](https://shadcn-svelte.com) components
- **Database:** [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) via
  [Drizzle ORM](https://orm.drizzle.team)
- **Hosting:** Cloudflare Workers, via `@sveltejs/adapter-cloudflare`
- **Tooling:** [Bun](https://bun.sh) for scripts and packages, Wrangler for Cloudflare

## Getting started

Prerequisites: Bun, and a Cloudflare account if you want to deploy.

```sh
bun install
bun run db:migrate   # create the tables in the local D1 database (.wrangler/)
bun run dev          # http://localhost:5173
```

In dev, `adapter-cloudflare` uses Wrangler's platform proxy, so the `DB` binding points at a
local SQLite database under `.wrangler/` and you don't need any credentials.

## Scripts

| Script                      | What it does                                                                |
| --------------------------- | --------------------------------------------------------------------------- |
| `bun run dev`               | Vite dev server                                                             |
| `bun run build`             | Check Worker types are current, then build                                  |
| `bun run preview`           | Build and serve the real Worker locally with `wrangler dev`                 |
| `bun run deploy`            | Build and deploy to Cloudflare                                              |
| `bun run check`             | Type-check with `svelte-check`                                              |
| `bun run lint` / `format`   | Prettier + ESLint check / Prettier write                                    |
| `bun run gen`               | Regenerate `worker-configuration.d.ts` (run after editing `wrangler.jsonc`) |
| `bun run db:generate`       | Generate a SQL migration from changes to `schema.ts`                        |
| `bun run db:migrate`        | Apply pending migrations to the **local** D1 database                       |
| `bun run db:migrate-remote` | Apply pending migrations to the **production** D1 database                  |

### Changing the database schema

1. Edit [`src/lib/server/db/schema.ts`](src/lib/server/db/schema.ts).
2. `bun run db:generate` writes a new migration to `src/lib/server/db/migrations/`. Commit it.
3. `bun run db:migrate` to apply it locally, then `bun run db:migrate-remote` before (or as
   part of) deploying.

`db:push` and `db:studio` are Drizzle Kit commands that talk to D1 over HTTP. They need D1
credentials in `drizzle.config.ts` (see `.env.example`), which aren't configured yet.

## Project layout

```
src/
├── hooks.server.ts          # Creates the Drizzle client per request → event.locals.db
├── app.d.ts                 # App.Locals typing
├── lib/
│   ├── api.ts               # Client helper for reading API error messages
│   ├── currency.ts          # Chip ↔ cent conversion, amount formatting, chips/$ display cookie
│   ├── components/
│   │   ├── buttons/         # App-specific components (dark-mode toggle)
│   │   └── ui/              # shadcn-svelte primitives (generated; add with `bunx shadcn-svelte add`)
│   └── server/
│       ├── db/
│       │   ├── index.ts     # createDb() and the Db type
│       │   ├── schema.ts    # Drizzle schema: rooms, players, transactions
│       │   └── migrations/  # Generated SQL migrations (applied by Wrangler)
│       ├── http.ts          # readJsonBody(): JSON body parsing with 400s for bad input
│       └── rooms.ts         # Room TTL, getActiveRoom(), deleteExpiredRooms(), bumpRoomVersion()
└── routes/
    ├── +page.svelte         # Landing page: create or join a room
    ├── +error.svelte        # Error page (unknown/expired rooms land here)
    ├── room/[id]/           # Room page: players, balances, transaction log
    └── api/rooms/           # JSON API, see below
```

Imports use `#lib/...` (Node [subpath imports](https://nodejs.org/api/packages.html#subpath-imports),
declared in `package.json`). SvelteKit 3 replaced `$lib` with this. Include the file
extension, e.g. `#lib/server/rooms.js`, because subpath imports don't resolve extensionless
paths or directory `index` files.

Cloudflare bindings (such as `DB`) are read with `import { env } from 'cloudflare:workers'`.
The adapter provides this module in dev too. There is no `event.platform`.

## Data model

| Table          | Columns                                                                        |
| -------------- | ------------------------------------------------------------------------------ |
| `rooms`        | `id` (4-char code, PK), `rate_chips`, `rate_cents`, `version`, `created_at`    |
| `players`      | `id`, `room_id` → rooms, `name`, `balance`, `created_at`                       |
| `transactions` | `id`, `room_id` → rooms, `player_id` → players, `type`, `amount`, `created_at` |

- `type` is `buyin` or `cashout`, and `amount` is always a positive whole number of chips.
- `players.balance` is a running total (cash-outs minus buy-ins), so a negative balance means
  the player is down. It's updated in the same D1 `batch()` as the transaction insert, so the
  two can't drift apart.
- Foreign keys cascade on delete, so deleting a room removes its players and transactions, and
  deleting a player removes their transactions.
- `rooms.version` goes up by one with every change to the room's data (players, transactions,
  rate). Each endpoint bumps it with `bumpRoomVersion()` in the same `batch()` as the change.
  See [Live sync](#live-sync).
- Timestamps are Unix seconds. Drizzle maps them to `Date`.

### Chips and dollars

Everything is stored in chips. Dollars are only a way of viewing and entering amounts.

- A room's rate is `rate_chips` chips = `rate_cents` cents (e.g. 1000 chips = 2000 cents for
  "1000 chips = $20"). Storing two integers keeps conversions exact. Both are `NULL` until
  someone sets a rate in the room's settings, and dollars aren't available until then.
- Balances, stats and the transaction log are shown in the unit picked with the Chips / $
  toggle. The choice is kept in a `display-unit` cookie (not localStorage) so the server
  renders the page in that unit, and it applies to every room.
- A buy-in or cash-out entered in dollars is converted to chips in the browser before it's
  sent, rounding to the nearest whole chip. The dialog shows the chip amount that will be
  recorded and says when it was rounded. The API only accepts chips.
- Changing the rate re-values every existing amount, since transactions don't store the rate
  in force when they were recorded.

### Room lifecycle

- Codes use `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `I`/`O`/`0`/`1`). They're matched
  case-insensitively and stored uppercase.
- A room expires `ROOM_TTL_MS` (7 days) after creation. See
  [`src/lib/server/rooms.ts`](src/lib/server/rooms.ts).
- Expired rooms are deleted lazily. Any request for an expired room deletes it and returns 404,
  and every room creation first deletes all expired rooms, freeing their codes for reuse.

## API

All endpoints are JSON. Errors use SvelteKit's shape, `{ "message": "..." }`, with a 4xx/5xx
status. Like any SvelteKit app, POSTs must come from the same origin (CSRF protection).

| Method | Path                               | Body                                               | Response                      |
| ------ | ---------------------------------- | -------------------------------------------------- | ----------------------------- |
| POST   | `/api/rooms`                       | none                                               | `201 { id }`                  |
| GET    | `/api/rooms/:id`                   | none                                               | `200 { room }`                |
| PATCH  | `/api/rooms/:id`                   | `{ rateChips, rateCents }`                         | `200 { room }`                |
| POST   | `/api/rooms/:id/players`           | `{ name }` (1–50 chars after trimming)             | `201` the new player          |
| DELETE | `/api/rooms/:id/players/:playerId` | none                                               | `204`                         |
| POST   | `/api/rooms/:id/transactions`      | `{ playerId, type: "buyin" \| "cashout", amount }` | `201 { transaction, player }` |

- `room` is `{ id, rateChips, rateCents, version, createdAt, expiresAt }`.
- `PATCH` takes the rate as positive whole numbers of chips and cents, or both `null` to remove
  it.
- `DELETE` on a player also deletes their transactions. It returns `404` if the player isn't in
  this room.
- `amount` is always in chips.

Unknown or expired rooms return `404` from every room endpoint.

The room page doesn't use the API to load data. Its server `load` function
([`room/[id]/+page.server.ts`](src/routes/room/[id]/+page.server.ts)) queries D1 directly and
re-runs (`invalidateAll()`) after each change.

### Live sync

Other people's changes reach an open room page by polling, not WebSockets (which would need
Durable Objects):

- Every 3 seconds the page fetches `GET /api/rooms/:id`, a single-row read, and compares
  `room.version` with the version it last loaded. Only if it differs does it call
  `invalidateAll()` to reload players and transactions.
- Polling pauses while the tab is hidden and runs immediately when it becomes visible again.
- Failed polls (e.g. a dropped connection) are ignored and retried on the next tick. A `404`
  reloads the page, which then shows the expired-room error.
- If someone deletes a player while you have that player's buy-in/cash-out or delete dialog
  open, the dialog closes.

## Deployment

```sh
bun run db:migrate-remote   # if there are new migrations
bun run deploy
```

Worker settings, the custom domain and the D1 binding live in [`wrangler.jsonc`](wrangler.jsonc).
If you change bindings there, run `bun run gen` to regenerate `worker-configuration.d.ts`
(`build` fails if it's out of date).
