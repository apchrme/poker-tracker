import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActiveRoom, roomExpiresAt } from '#lib/server/rooms.js';

/** Room metadata. Used by the landing page to check a code exists before navigating to it. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const room = await getActiveRoom(locals.db, params.id);

	return json({ room: { ...room, expiresAt: roomExpiresAt(room) } });
};
