/** `chips` chips are worth `cents` cents. Both are positive integers, so conversions stay exact. */
export type Rate = { chips: number; cents: number };

export type Unit = 'chips' | 'cash';

/** Remembers the viewer's chips/$ choice. A cookie rather than localStorage so SSR renders it. */
export const DISPLAY_UNIT_COOKIE = 'display-unit';

export function parseUnit(value: string | undefined): Unit {
	return value === 'cash' ? 'cash' : 'chips';
}

/** The room's conversion rate, or null if it hasn't been configured. */
export function roomRate(room: {
	rateChips: number | null;
	rateCents: number | null;
}): Rate | null {
	return room.rateChips && room.rateCents ? { chips: room.rateChips, cents: room.rateCents } : null;
}

export function chipsToCents(chips: number, rate: Rate): number {
	return Math.round((chips * rate.cents) / rate.chips);
}

/** Rounds to the nearest whole chip, since balances are stored in chips. */
export function centsToChips(cents: number, rate: Rate): number {
	return Math.round((cents * rate.chips) / rate.cents);
}

/** Format a chip count, e.g. -400 → "−400". Negative amounts use a minus sign. */
export function formatChips(chips: number): string {
	return chips < 0 ? `−${-chips}` : `${chips}`;
}

/** Format cents as dollars, e.g. 1250 → "$12.50". Negative amounts use a minus sign. */
export function formatCents(cents: number): string {
	const dollars = (Math.abs(cents) / 100).toFixed(2);
	return cents < 0 ? `−$${dollars}` : `$${dollars}`;
}

/** Parse a dollar amount typed by the user into cents, or null if it isn't one. */
export function parseDollars(value: number | null): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	const cents = Math.round(value * 100);
	return Number.isSafeInteger(cents) ? cents : null;
}
