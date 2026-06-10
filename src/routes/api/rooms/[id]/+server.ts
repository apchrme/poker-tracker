import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { players, transactions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, platform }) => {
	const db = getDb(platform!.env.DB);
	const { id } = params;

	const room = await db.query.rooms.findFirst({ where: (r, { eq }) => eq(r.id, id) });
	if (!room) throw error(404, 'Room not found');

	// Check expiry: rooms expire after 7 days
	const expiresAt = new Date(room.createdAt);
	expiresAt.setDate(expiresAt.getDate() + 7);
	if (new Date() > expiresAt) throw error(404, 'Room has expired');

	const roomPlayers = await db.select().from(players).where(eq(players.roomId, id));
	const roomTransactions = await db
		.select()
		.from(transactions)
		.where(eq(transactions.roomId, id))
		.orderBy(transactions.createdAt);

	return json({ room, players: roomPlayers, transactions: roomTransactions });
};
