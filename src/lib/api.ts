/** Build an Error from a failed API response, using SvelteKit's `{ message }` error body if present. */
export async function responseError(res: Response, fallback: string): Promise<Error> {
	const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
	return new Error(typeof body?.message === 'string' ? body.message : fallback);
}
