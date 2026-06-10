import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { rooms } from '$lib/server/db/schema';

function generateRoomId(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // skip confusable chars
	let id = '';
	for (let i = 0; i < 6; i++) {
		id += chars[Math.floor(Math.random() * chars.length)];
	}
	return id;
}

export const POST: RequestHandler = async ({ platform }) => {
	const db = getDb(platform!.env.DB);

	// Generate a unique room ID
	let id = generateRoomId();
	let attempts = 0;
	while (attempts < 10) {
		const existing = await db.query.rooms.findFirst({ where: (r, { eq }) => eq(r.id, id) });
		if (!existing) break;
		id = generateRoomId();
		attempts++;
	}

	await db.insert(rooms).values({ id });

	return json({ id }, { status: 201 });
};
