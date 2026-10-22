import { env } from 'cloudflare:workers';
import type { Handle } from '@sveltejs/kit/hooks';
import { createDb } from '#lib/server/db/index.js';

export const handle: Handle = async ({ event, resolve }) => {
	// Bindings come from wrangler.jsonc. adapter-cloudflare provides `cloudflare:workers` in dev too.
	if (!env.DB) throw new Error('Database unavailable');

	event.locals.db = createDb(env.DB);

	return resolve(event);
};
