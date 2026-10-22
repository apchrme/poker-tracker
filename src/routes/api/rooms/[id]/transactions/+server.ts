import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, eq, sql } from 'drizzle-orm';
import { players, transactions } from '#lib/server/db/schema.js';
import { readJsonBody } from '#lib/server/http.js';
import { getActiveRoom } from '#lib/server/rooms.js';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { db } = locals;
	const room = await getActiveRoom(db, params.id);

	const { playerId, type, amount } = await readJsonBody(request);
	if (typeof playerId !== 'number' || !Number.isInteger(playerId)) {
		error(400, 'Valid playerId required');
	}
	if (type !== 'buyin' && type !== 'cashout') error(400, 'Type must be buyin or cashout');
	if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
		error(400, 'Amount must be a positive integer');
	}

	const player = await db.query.players.findFirst({
		where: and(eq(players.id, playerId), eq(players.roomId, room.id))
	});
	if (!player) error(404, 'Player not found in this room');

	// Buy-ins put the player down, cash-outs bring them back up.
	const balanceDelta = type === 'buyin' ? -amount : amount;

	// D1 has no interactive transactions; batch() runs both statements atomically.
	const [[transaction], [updatedPlayer]] = await db.batch([
		db.insert(transactions).values({ roomId: room.id, playerId, type, amount }).returning(),
		db
			.update(players)
			.set({ balance: sql`${players.balance} + ${balanceDelta}` })
			.where(eq(players.id, playerId))
			.returning()
	]);

	return json({ transaction, player: updatedPlayer }, { status: 201 });
};
