import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { players } from '#lib/server/db/schema.js';
import { bumpRoomVersion, getActiveRoom } from '#lib/server/rooms.js';

/** Delete a player (e.g. one added by mistake). Their transactions cascade. */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { db } = locals;
	const room = await getActiveRoom(db, params.id);

	const playerId = Number(params.playerId);
	if (!Number.isSafeInteger(playerId)) error(400, 'Valid playerId required');

	const [[deleted]] = await db.batch([
		db
			.delete(players)
			.where(and(eq(players.id, playerId), eq(players.roomId, room.id)))
			.returning({ id: players.id }),
		bumpRoomVersion(db, room.id)
	]);
	if (!deleted) error(404, 'Player not found in this room');

	return new Response(null, { status: 204 });
};
