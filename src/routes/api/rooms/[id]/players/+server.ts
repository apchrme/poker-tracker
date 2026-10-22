import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { players } from '#lib/server/db/schema.js';
import { readJsonBody } from '#lib/server/http.js';
import { getActiveRoom } from '#lib/server/rooms.js';

const MAX_NAME_LENGTH = 50;

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { db } = locals;
	const room = await getActiveRoom(db, params.id);

	const body = await readJsonBody(request);
	const name = typeof body.name === 'string' ? body.name.trim() : '';
	if (!name) error(400, 'Player name is required');
	if (name.length > MAX_NAME_LENGTH) error(400, 'Player name too long');

	const [player] = await db.insert(players).values({ roomId: room.id, name }).returning();

	return json(player, { status: 201 });
};
