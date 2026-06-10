import { error } from '@sveltejs/kit';
import { rooms, players, transactions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load = async ({ params, locals }) => {
	const db = locals.db;
	const { id } = params;

	const room = await db.query.rooms.findFirst({ where: (r, { eq }) => eq(r.id, id) });
	if (!room) throw error(404, 'Room not found');

	// Check expiry: rooms expire after 7 days
	const expiresAt = new Date((room.createdAt as unknown as number));
	expiresAt.setDate(expiresAt.getDate() + 7);
	if (new Date() > expiresAt) {
		await db.delete(rooms).where(eq(rooms.id, id));
		throw error(404, 'This room has expired');
	}

	const roomPlayers = await db.select().from(players).where(eq(players.roomId, id));
	const roomTransactions = await db
		.select({
			id: transactions.id,
			playerId: transactions.playerId,
			type: transactions.type,
			amount: transactions.amount,
			createdAt: transactions.createdAt,
			playerName: players.name
		})
		.from(transactions)
		.leftJoin(players, eq(transactions.playerId, players.id))
		.where(eq(transactions.roomId, id))
		.orderBy(transactions.createdAt);

	return {
		room: { ...room, expiresAt: expiresAt.toISOString() },
		players: roomPlayers,
		transactions: roomTransactions
	};
};
