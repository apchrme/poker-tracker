import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const rooms = sqliteTable('rooms', {
	id: text('id').primaryKey(), // 6-char alphanumeric
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const players = sqliteTable('players', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	roomId: text('room_id')
		.notNull()
		.references(() => rooms.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	balance: integer('balance').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const transactions = sqliteTable('transactions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	roomId: text('room_id')
		.notNull()
		.references(() => rooms.id, { onDelete: 'cascade' }),
	playerId: integer('player_id')
		.notNull()
		.references(() => players.id, { onDelete: 'cascade' }),
	type: text('type', { enum: ['buyin', 'cashout'] }).notNull(),
	amount: integer('amount').notNull(), // always positive
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export type Room = typeof rooms.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
