import type { Handle } from '@sveltejs/kit';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './lib/server/db/schema';

export const handle: Handle = async ({ event, resolve }) => {
	if (!event.platform?.env.DB) throw new Error('Database unavailable');

	const db = drizzle(event.platform.env.DB, { schema });
	event.locals.db = db;

	return resolve(event);
};
