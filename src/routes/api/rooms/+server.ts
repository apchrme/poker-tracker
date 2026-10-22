import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rooms } from '#lib/server/db/schema.js';
import { deleteExpiredRooms } from '#lib/server/rooms.js';

const ROOM_ID_LENGTH = 4;
const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // skips confusable chars (I, O, 0, 1)

function generateRoomId(): string {
	// 256 is a multiple of 32, so `byte % 32` is unbiased.
	const bytes = crypto.getRandomValues(new Uint8Array(ROOM_ID_LENGTH));
	return Array.from(bytes, (b) => ROOM_ID_CHARS[b % ROOM_ID_CHARS.length]).join('');
}

export const POST: RequestHandler = async ({ locals }) => {
	const { db } = locals;

	// Opportunistic cleanup: frees storage and the codes held by expired rooms.
	await deleteExpiredRooms(db);

	// Insert-or-retry avoids the race between "check the code is free" and "insert it".
	for (let attempt = 0; attempt < 10; attempt++) {
		const [room] = await db
			.insert(rooms)
			.values({ id: generateRoomId() })
			.onConflictDoNothing()
			.returning();
		if (room) return json({ id: room.id }, { status: 201 });
	}

	error(503, 'Could not generate a unique room ID. Please try again.');
};
