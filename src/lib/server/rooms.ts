import { error } from '@sveltejs/kit';
import { eq, lte, sql } from 'drizzle-orm';
import type { Db } from './db';
import { rooms, type Room } from './db/schema';

/** Rooms are deleted this long after creation (players and transactions cascade). */
export const ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function roomExpiresAt(room: Room): Date {
	return new Date(room.createdAt.getTime() + ROOM_TTL_MS);
}

/**
 * Look up a room by its code (case-insensitive). Throws a 404 if the room doesn't
 * exist or has expired; expired rooms are deleted on the way out.
 */
export async function getActiveRoom(db: Db, code: string): Promise<Room> {
	const id = code.toUpperCase();
	const room = await db.query.rooms.findFirst({ where: eq(rooms.id, id) });
	if (!room) error(404, 'Room not found');

	if (roomExpiresAt(room).getTime() <= Date.now()) {
		await db.delete(rooms).where(eq(rooms.id, id));
		error(404, 'This room has expired');
	}

	return room;
}

/**
 * Statement that marks a room as changed so other viewers re-sync. Run it in the same
 * db.batch() as the change itself so the two are atomic.
 */
export function bumpRoomVersion(db: Db, roomId: string) {
	return db
		.update(rooms)
		.set({ version: sql`${rooms.version} + 1` })
		.where(eq(rooms.id, roomId));
}

/** Delete every expired room, freeing its code for reuse. */
export async function deleteExpiredRooms(db: Db): Promise<void> {
	const cutoff = new Date(Date.now() - ROOM_TTL_MS);
	await db.delete(rooms).where(lte(rooms.createdAt, cutoff));
}
