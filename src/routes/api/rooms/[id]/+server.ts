import { error, json } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { rooms } from '#lib/server/db/schema.js';
import { readJsonBody } from '#lib/server/http.js';
import { getActiveRoom, roomExpiresAt } from '#lib/server/rooms.js';

/**
 * Room metadata. Used by the landing page to check a code exists before navigating to it,
 * and polled by the room page, which re-syncs when `version` changes.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const room = await getActiveRoom(locals.db, params.id);

	return json({ room: { ...room, expiresAt: roomExpiresAt(room) } });
};

function isPositiveInt(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** Update room settings: the chip conversion rate. Send both as null to clear it. */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const { db } = locals;
	const room = await getActiveRoom(db, params.id);

	const { rateChips, rateCents } = await readJsonBody(request);
	let rate: { rateChips: number | null; rateCents: number | null };
	if (rateChips === null && rateCents === null) {
		rate = { rateChips, rateCents };
	} else if (isPositiveInt(rateChips) && isPositiveInt(rateCents)) {
		rate = { rateChips, rateCents };
	} else {
		error(400, 'Rate must be a positive whole number of chips and cents, or both null');
	}

	const [updated] = await db
		.update(rooms)
		.set({ ...rate, version: sql`${rooms.version} + 1` })
		.where(eq(rooms.id, room.id))
		.returning();

	return json({ room: { ...updated, expiresAt: roomExpiresAt(updated) } });
};
