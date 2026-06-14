import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { rooms } from '$lib/server/db/schema';

const ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateRoomId(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // skip confusable chars
	let id = '';
	for (let i = 0; i < 4; i++) {
		id += chars[Math.floor(Math.random() * chars.length)];
	}
	return id;
}

export const POST: RequestHandler = async ({ platform, locals }) => {
	const db = locals.db;

	// Find a usable room ID — either one that doesn't exist yet, or one whose
	// room has expired (in which case we delete the old data and reuse the code).
	let id = generateRoomId();
	let found = false;
	let attempts = 0;

	while (attempts < 10) {
		const existing = await db.query.rooms.findFirst({ where: (r, { eq }) => eq(r.id, id) });

		if (!existing) {
			found = true;
			break;
		}

		if (existing.createdAt.getTime() + ROOM_TTL_MS <= Date.now()) {
			// Expired room — cascade delete removes its players and transactions too
			await db.delete(rooms).where(eq(rooms.id, id));
			found = true;
			break;
		}

		id = generateRoomId();
		attempts++;
	}

	if (!found) {
		return json({ error: 'Could not generate a unique room ID. Please try again.' }, { status: 503 });
	}

	await db.insert(rooms).values({ id });

	return json({ id }, { status: 201 });
};