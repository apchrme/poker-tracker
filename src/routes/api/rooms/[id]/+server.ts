import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rooms, players, transactions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, locals }) => {
	const db = locals.db;
	const { id } = params;

	const room = await db.query.rooms.findFirst({ where: (r, { eq }) => eq(r.id, id) });
	if (!room) throw error(404, 'Room not found');

	// Check expiry: rooms expire after 7 days
	const expiresAt = new Date(room.createdAt);
	expiresAt.setMilliseconds(expiresAt.getMilliseconds() + 7*86400*1000);
	if (new Date() > expiresAt) {
		await db.delete(rooms).where(eq(rooms.id, id));
		throw error(404, 'This room has expired');
	}

	const roomPlayers = await db.select().from(players).where(eq(players.roomId, id));
	const roomTransactions = await db
		.select()
		.from(transactions)
		.where(eq(transactions.roomId, id))
		.orderBy(transactions.createdAt);

	return json({ room, players: roomPlayers, transactions: roomTransactions });
};
