import { error } from '@sveltejs/kit';

/** Parse a JSON object request body, responding 400 instead of 500 when it's malformed. */
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
	const body: unknown = await request.json().catch(() => null);
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		error(400, 'Request body must be a JSON object');
	}
	return body as Record<string, unknown>;
}
