# Poker Tracker

This is a app used to track buy-ins and cash-outs in poker home games.

## Stack
- Frontend/Backend: Svelte and SvelteKit
- Database ORM: Drizzle ORM, connected to Cloudflare D1
Deployment is to Cloudflare Workers

## User flow
When a user visits the landing page, they can either create a new room with a randomly generated 4-character ID, or join an existing room. All rooms expire 7 days after they are created.

Once the user has entered the room, anyone with the room link can buy in or cash out.

# Routes
- `api/`: API endpoints
  - `rooms/`
    - `+server.ts`: API endpoint for creating a new room
    - `[id]/`
      - `players/`
        - `+server.ts`: API endpoint for adding a new player
      - `transactions/`
        - `+server.ts`: API endpoint for adding a new transaction
- `room/`
  - `[id]/`: page for each room