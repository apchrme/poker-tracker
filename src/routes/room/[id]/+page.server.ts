import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { players, transactions } from '#lib/server/db/schema.js';
import { getActiveRoom, roomExpiresAt } from '#lib/server/rooms.js';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { db } = locals;
	const room = await getActiveRoom(db, params.id);

	// One round trip to D1 for both queries.
	const [roomPlayers, roomTransactions] = await db.batch([
		db.select().from(players).where(eq(players.roomId, room.id)).orderBy(desc(players.balance)),
		db
			.select({
				id: transactions.id,
				playerId: transactions.playerId,
				type: transactions.type,
				amount: transactions.amount,
				createdAt: transactions.createdAt,
				playerName: players.name
			})
			.from(transactions)
			.innerJoin(players, eq(transactions.playerId, players.id))
			.where(eq(transactions.roomId, room.id))
			// Newest first. `id` rather than `createdAt`, which only has 1-second resolution.
			.orderBy(desc(transactions.id))
	]);

	return {
		room: { ...room, expiresAt: roomExpiresAt(room) },
		players: roomPlayers,
		transactions: roomTransactions
	};
};
