import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { transactions, players } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const db = locals.db;
	const { id } = params;

	const room = await db.query.rooms.findFirst({ where: (r, { eq }) => eq(r.id, id) });
	if (!room) throw error(404, 'Room not found');

	const body = await request.json();
	const { playerId, type, amount } = body;

	if (!playerId || typeof playerId !== 'number') throw error(400, 'Valid playerId required');
	if (type !== 'buyin' && type !== 'cashout') throw error(400, 'Type must be buyin or cashout');
	if (!amount || typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
		throw error(400, 'Amount must be a positive integer');
	}

	const player = await db.query.players.findFirst({
		where: (p, { eq, and }) => and(eq(p.id, playerId), eq(p.roomId, id))
	});
	if (!player) throw error(404, 'Player not found in this room');

	// Insert transaction and update player balance atomically
	const balanceDelta = type === 'buyin' ? -amount : amount;

	const [tx] = await db.insert(transactions).values({ roomId: id, playerId, type, amount }).returning();

	await db
		.update(players)
		.set({ balance: sql`${players.balance} + ${balanceDelta}` })
		.where(eq(players.id, playerId));

	const updatedPlayer = await db.query.players.findFirst({
		where: (p, { eq }) => eq(p.id, playerId)
	});

	return json({ transaction: tx, player: updatedPlayer }, { status: 201 });
};
