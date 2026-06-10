import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { players } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ params, request, platform }) => {
	const db = getDb(platform!.env.DB);
	const { id } = params;

	const room = await db.query.rooms.findFirst({ where: (r, { eq }) => eq(r.id, id) });
	if (!room) throw error(404, 'Room not found');

	const body = await request.json();
	const name = (body.name ?? '').trim();
	if (!name) throw error(400, 'Player name is required');
	if (name.length > 50) throw error(400, 'Player name too long');

	const [player] = await db.insert(players).values({ roomId: id, name }).returning();

	return json(player, { status: 201 });
};
