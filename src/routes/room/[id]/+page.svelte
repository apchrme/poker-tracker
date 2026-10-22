<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import { responseError } from '#lib/api.js';
	import {
		centsToChips,
		chipsToCents,
		DISPLAY_UNIT_COOKIE,
		formatCents,
		formatChips,
		parseDollars,
		roomRate,
		type Unit
	} from '#lib/currency.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import DarkModeButton from '#lib/components/buttons/DarkModeButton.svelte';
	import { Minus, Plus, Copy, Check, Settings, Trash2 } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	// Canonical (uppercase) code, even if the URL was typed in lowercase.
	const roomId = $derived(data.room.id);

	// ─── Display Unit ─────────────────────────────────────────────────────────
	// Balances are stored in chips; dollars are only a view, available once a rate is set.
	const rate = $derived(roomRate(data.room));
	// Starts from the remembered choice (read server-side from a cookie); writable on toggle.
	let displayUnit = $derived<Unit>(data.displayUnit);
	const displayRate = $derived(displayUnit === 'cash' ? rate : null);

	function selectDisplayUnit(unit: Unit) {
		displayUnit = unit;
		document.cookie = `${DISPLAY_UNIT_COOKIE}=${unit}; path=/; max-age=31536000; samesite=lax`;
		// Picking dollars before a rate exists: ask for one. Dollars show once it's saved.
		if (unit === 'cash' && !rate) openSettings();
	}

	// ─── Room Settings ────────────────────────────────────────────────────────
	let settingsOpen = $state(false);
	let settingsChips = $state<number | null>(null);
	let settingsDollars = $state<number | null>(null);
	let settingsSaving = $state(false);
	let settingsError = $state('');

	const settingsCents = $derived(parseDollars(settingsDollars));
	const settingsValid = $derived(
		typeof settingsChips === 'number' &&
			Number.isSafeInteger(settingsChips) &&
			settingsChips > 0 &&
			settingsCents !== null &&
			settingsCents > 0
	);

	function openSettings() {
		settingsChips = rate?.chips ?? null;
		settingsDollars = rate ? rate.cents / 100 : null;
		settingsError = '';
		settingsOpen = true;
	}

	async function saveRate(clear = false) {
		if (settingsSaving) return;
		if (!clear && !settingsValid) {
			settingsError = 'Enter a whole number of chips and a dollar amount greater than 0.';
			return;
		}
		settingsSaving = true;
		settingsError = '';
		try {
			const res = await fetch(`/api/rooms/${roomId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(
					clear
						? { rateChips: null, rateCents: null }
						: { rateChips: settingsChips, rateCents: settingsCents }
				)
			});
			if (!res.ok) throw await responseError(res, 'Could not save settings.');
			settingsOpen = false;
			await invalidateAll();
		} catch (e: unknown) {
			settingsError = e instanceof Error ? e.message : 'Could not save settings.';
		} finally {
			settingsSaving = false;
		}
	}

	// ─── Delete Player ────────────────────────────────────────────────────────
	let deleteDialogOpen = $state(false);
	let deletePlayerId = $state<number | null>(null);
	let deleting = $state(false);
	let deleteError = $state('');

	function openDeleteDialog(playerId: number) {
		deletePlayerId = playerId;
		deleteError = '';
		deleteDialogOpen = true;
	}

	async function deletePlayer() {
		if (deleting || !deletePlayerId) return;
		deleting = true;
		deleteError = '';
		try {
			const res = await fetch(`/api/rooms/${roomId}/players/${deletePlayerId}`, {
				method: 'DELETE'
			});
			if (!res.ok) throw await responseError(res, 'Could not delete player.');
			deleteDialogOpen = false;
			await invalidateAll();
		} catch (e: unknown) {
			deleteError = e instanceof Error ? e.message : 'Could not delete player.';
		} finally {
			deleting = false;
		}
	}

	// ─── Add Player ───────────────────────────────────────────────────────────
	let newPlayerName = $state('');
	let addingPlayer = $state(false);
	let addPlayerError = $state('');

	async function addPlayer() {
		const name = newPlayerName.trim();
		if (!name) return;
		addingPlayer = true;
		addPlayerError = '';
		try {
			const res = await fetch(`/api/rooms/${roomId}/players`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});
			if (!res.ok) throw await responseError(res, 'Could not add player.');
			newPlayerName = '';
			await invalidateAll();
		} catch (e: unknown) {
			addPlayerError = e instanceof Error ? e.message : 'Could not add player.';
		} finally {
			addingPlayer = false;
		}
	}

	// ─── Transaction Dialog ───────────────────────────────────────────────────
	type TxType = 'buyin' | 'cashout';
	let txDialogOpen = $state(false);
	let txType = $state<TxType>('buyin');
	let txPlayerId = $state<number | null>(null);
	let txUnit = $state<Unit>('chips');
	// bind:value on a number input yields a number, or null when empty.
	// In chips when txUnit is 'chips', otherwise in dollars.
	let txAmount = $state<number | null>(null);
	let txSubmitting = $state(false);
	let txError = $state('');

	const txCents = $derived(txUnit === 'cash' ? parseDollars(txAmount) : null);
	// The whole number of chips that will be recorded, or null if the input isn't valid.
	const txChips = $derived.by(() => {
		if (txUnit === 'cash') {
			if (!rate || txCents === null || txCents <= 0) return null;
			const chips = centsToChips(txCents, rate);
			return Number.isSafeInteger(chips) && chips > 0 ? chips : null;
		}
		// Whole chips only: previously "1.5" was silently recorded as 1.
		return typeof txAmount === 'number' && Number.isSafeInteger(txAmount) && txAmount > 0
			? txAmount
			: null;
	});
	const txAmountValid = $derived(txChips !== null);
	// Dollar amounts that don't map to a whole number of chips are rounded; say so in the preview.
	const txRounded = $derived(
		rate !== null && txCents !== null && (txCents * rate.chips) % rate.cents !== 0
	);

	function openTxDialog(playerId: number, type: TxType) {
		txPlayerId = playerId;
		txType = type;
		txUnit = displayRate ? 'cash' : 'chips';
		txAmount = null;
		txError = '';
		txDialogOpen = true;
	}

	/** Switch the input unit, converting whatever has been typed so far. */
	function selectTxUnit(unit: Unit) {
		if (unit === txUnit) return;
		const chips = txChips;
		txUnit = unit;
		txError = '';
		if (chips === null || !rate) txAmount = null;
		else txAmount = unit === 'cash' ? chipsToCents(chips, rate) / 100 : chips;
	}

	async function submitTransaction() {
		if (txSubmitting) return;
		if (!txPlayerId || txChips === null) {
			txError =
				txUnit === 'cash'
					? 'Enter a dollar amount worth at least 1 chip.'
					: 'Enter a whole number of chips greater than 0.';
			return;
		}
		txSubmitting = true;
		txError = '';
		try {
			const res = await fetch(`/api/rooms/${roomId}/transactions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ playerId: txPlayerId, type: txType, amount: txChips })
			});
			if (!res.ok) throw await responseError(res, 'Could not record transaction.');
			txDialogOpen = false;
			await invalidateAll();
		} catch (e: unknown) {
			txError = e instanceof Error ? e.message : 'Could not record transaction.';
		} finally {
			txSubmitting = false;
		}
	}

	// ─── Live Sync ────────────────────────────────────────────────────────────
	// Poll the room's version and reload the page data when another viewer changes something.
	const SYNC_INTERVAL_MS = 3000;
	let syncing = false;

	async function sync() {
		if (syncing || document.visibilityState !== 'visible') return;
		syncing = true;
		try {
			const res = await fetch(`/api/rooms/${roomId}`);
			if (res.ok) {
				const { room }: { room: { version: number } } = await res.json();
				if (room.version === data.room.version) return;
			} else if (res.status !== 404) {
				return; // Transient server error; try again next tick.
			}
			// Changed, or the room expired (the reload then shows the error page).
			await invalidateAll();
			// Close any dialog whose player someone else just deleted.
			if (txDialogOpen && !txPlayer) txDialogOpen = false;
			if (deleteDialogOpen && !deleteTarget) deleteDialogOpen = false;
		} catch {
			// Offline; try again next tick.
		} finally {
			syncing = false;
		}
	}

	$effect(() => {
		const interval = setInterval(sync, SYNC_INTERVAL_MS);
		return () => clearInterval(interval);
	});

	// ─── Helpers ──────────────────────────────────────────────────────────────
	/** A chip amount in the current display unit. */
	function formatAmount(chips: number): string {
		return displayRate ? formatCents(chipsToCents(chips, displayRate)) : formatChips(chips);
	}

	function formatBalance(bal: number): string {
		return bal >= 0 ? `+${formatAmount(bal)}` : formatAmount(bal);
	}

	function balanceColor(bal: number): string {
		if (bal > 0) return 'text-emerald-600 dark:text-emerald-400';
		if (bal < 0) return 'text-destructive';
		return 'text-muted-foreground';
	}

	// SvelteKit serialises Dates from the load function, so these arrive as Date objects.
	function formatDate(d: Date): string {
		return d.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	let copied = $state(false);
	async function copyLink() {
		try {
			await navigator.clipboard.writeText(window.location.href);
		} catch {
			return; // Clipboard unavailable (e.g. insecure context); don't claim success.
		}
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	// Players arrive sorted by balance and transactions newest-first from the server.
	const recentTransactions = $derived(data.transactions.slice(0, 50));
	const stats = $derived([
		{ label: 'Players', value: data.players.length },
		{ label: 'Transactions', value: data.transactions.length },
		{
			label: displayRate ? 'Total in play' : 'Total chips in play',
			value: formatAmount(-data.players.reduce((acc, p) => acc + p.balance, 0))
		}
	]);
	const txPlayer = $derived(txPlayerId ? data.players.find((p) => p.id === txPlayerId) : null);
	const txNewBalance = $derived(
		txChips !== null ? (txPlayer?.balance ?? 0) + (txType === 'buyin' ? -txChips : txChips) : null
	);
	const deleteTarget = $derived(
		deletePlayerId ? data.players.find((p) => p.id === deletePlayerId) : null
	);
	const deleteTxCount = $derived(
		data.transactions.filter((tx) => tx.playerId === deletePlayerId).length
	);
</script>

<!-- Catch up straight away when returning to the tab (polling pauses while it's hidden). -->
<svelte:document onvisibilitychange={sync} />

<svelte:head>
	<title>Room {roomId} · Poker Tracker</title>
</svelte:head>

{#snippet unitToggle(current: Unit, select: (unit: Unit) => void)}
	<div class="flex rounded-lg border border-border p-0.5 text-xs" role="group" aria-label="Unit">
		{#each [['chips', 'Chips'], ['cash', '$']] as const as [unit, label] (unit)}
			<button
				type="button"
				aria-pressed={current === unit}
				onclick={() => select(unit)}
				class={[
					'min-w-10 rounded-md px-2 py-0.5 font-medium transition',
					current === unit
						? 'bg-muted text-foreground'
						: 'text-muted-foreground hover:text-foreground'
				]}
			>
				{label}
			</button>
		{/each}
	</div>
{/snippet}

<div class="min-h-screen bg-background">
	<!-- ─── Header ─────────────────────────────────────────────────────────── -->
	<header class="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
		<div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
			<div class="flex items-center gap-3">
				<a href={resolve('/')} class="text-xl">♠</a>
				<div>
					<h1 class="font-heading text-base leading-none font-semibold text-foreground">
						Room <span class="font-mono tracking-widest text-primary">{roomId}</span>
					</h1>
					<p class="mt-0.5 text-xs text-muted-foreground">
						Expires {data.room.expiresAt.toLocaleDateString()}
					</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<Button variant="outline" size="sm" onclick={copyLink}>
					{#if copied}
						<Check />
						Copied!
					{:else}
						<Copy />
						Share link
					{/if}
				</Button>
				<Button variant="outline" size="icon" onclick={openSettings}>
					<Settings />
					<span class="sr-only">Room settings</span>
				</Button>
				<DarkModeButton />
			</div>
		</div>
	</header>

	<div class="mx-auto max-w-3xl space-y-6 px-4 py-6">
		<!-- ─── Add Player ──────────────────────────────────────────────────── -->
		<section class="rounded-xl border border-border bg-card p-4">
			<h2 class="mb-3 text-sm font-semibold text-foreground">Add Player</h2>
			<div class="flex gap-2">
				<Input
					bind:value={newPlayerName}
					placeholder="Player name"
					maxlength={50}
					class="flex-1"
					onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && addPlayer()}
					disabled={addingPlayer}
				/>
				<Button onclick={addPlayer} disabled={addingPlayer || !newPlayerName.trim()}>
					{addingPlayer ? 'Adding…' : 'Add'}
				</Button>
			</div>
			{#if addPlayerError}
				<p class="mt-2 text-xs text-destructive">{addPlayerError}</p>
			{/if}
		</section>

		<!-- ─── Players Table ──────────────────────────────────────────────── -->
		{#if data.players.length === 0}
			<div
				class="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground"
			>
				No players yet. Add one above to get started.
			</div>
		{:else}
			<section>
				<div class="mb-2 flex items-center justify-between">
					<h2 class="text-sm font-semibold text-foreground">Players</h2>
					{@render unitToggle(displayRate ? 'cash' : 'chips', selectDisplayUnit)}
				</div>
				<div class="overflow-hidden rounded-xl border border-border bg-card">
					<table class="w-full text-sm">
						<thead>
							<tr
								class="border-b border-border text-xs font-medium tracking-wider text-muted-foreground uppercase"
							>
								<th class="px-4 py-3 text-left">Player</th>
								<th class="px-4 py-3 text-right">Balance</th>
								<th class="px-4 py-3 text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each data.players as player (player.id)}
								<tr class="border-b border-border/50 transition last:border-0 hover:bg-muted/30">
									<td class="px-4 py-3 font-medium text-foreground">{player.name}</td>
									<td
										class="px-4 py-3 text-right font-mono font-semibold {balanceColor(
											player.balance
										)}"
									>
										{formatBalance(player.balance)}
									</td>
									<td class="px-4 py-3 text-right">
										<div class="flex justify-end gap-1.5">
											<Button
												variant="destructive"
												size="icon-sm"
												onclick={() => openTxDialog(player.id, 'buyin')}
											>
												<Minus />
											</Button>
											<Button
												size="icon-sm"
												class="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
												onclick={() => openTxDialog(player.id, 'cashout')}
											>
												<Plus />
											</Button>
											<Button
												variant="ghost"
												size="icon-sm"
												class="text-muted-foreground"
												onclick={() => openDeleteDialog(player.id)}
											>
												<Trash2 />
												<span class="sr-only">Delete {player.name}</span>
											</Button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>

			<!-- ─── Stats ────────────────────────────────────────────────── -->
			<div class="grid grid-cols-3 gap-3">
				{#each stats as stat (stat.label)}
					<div class="rounded-xl border border-border bg-card p-3 text-center">
						<div class="font-mono text-xl font-bold text-foreground">{stat.value}</div>
						<div class="mt-0.5 text-xs text-muted-foreground">{stat.label}</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- ─── Transaction Log ────────────────────────────────────────────── -->
		{#if data.transactions.length > 0}
			<section>
				<h2 class="mb-2 text-sm font-semibold text-foreground">Transaction Log</h2>
				<div class="overflow-hidden rounded-xl border border-border bg-card">
					<table class="w-full text-sm">
						<thead>
							<tr
								class="border-b border-border text-xs font-medium tracking-wider text-muted-foreground uppercase"
							>
								<th class="px-4 py-3 text-left">Time</th>
								<th class="px-4 py-3 text-left">Player</th>
								<th class="px-4 py-3 text-left">Type</th>
								<th class="px-4 py-3 text-right">Amount</th>
							</tr>
						</thead>
						<tbody>
							{#each recentTransactions as tx (tx.id)}
								<tr class="border-b border-border/50 transition last:border-0 hover:bg-muted/30">
									<td class="px-4 py-2.5 text-xs text-muted-foreground"
										>{formatDate(tx.createdAt)}</td
									>
									<td class="px-4 py-2.5 font-medium text-foreground">{tx.playerName}</td>
									<td class="px-4 py-2.5">
										{#if tx.type === 'buyin'}
											<Badge variant="destructive">Buy In</Badge>
										{:else}
											<Badge
												class="border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
												>Cash Out</Badge
											>
										{/if}
									</td>
									<td class="px-4 py-2.5 text-right font-mono font-semibold">
										{#if tx.type === 'buyin'}
											<span class="text-destructive">−{formatAmount(tx.amount)}</span>
										{:else}
											<span class="text-emerald-600 dark:text-emerald-400"
												>+{formatAmount(tx.amount)}</span
											>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/if}
	</div>
</div>

<!-- ─── Transaction Dialog ──────────────────────────────────────────────────── -->
<Dialog.Root bind:open={txDialogOpen}>
	<Dialog.Content class="sm:max-w-sm" showCloseButton={false}>
		<Dialog.Header>
			<Dialog.Title>
				{txType === 'buyin' ? 'Buy In' : 'Cash Out'}
			</Dialog.Title>
			<Dialog.Description>
				{txPlayer?.name} · current balance:
				<span class="font-mono font-semibold {balanceColor(txPlayer?.balance ?? 0)}">
					{formatBalance(txPlayer?.balance ?? 0)}
				</span>
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			<!-- Type toggle -->
			<div class="flex rounded-lg border border-border p-1">
				{#each ['buyin', 'cashout'] as const as t (t)}
					<button
						onclick={() => {
							txType = t;
							txError = '';
						}}
						class="flex-1 rounded-md py-1.5 text-sm font-medium transition {txType === t
							? t === 'buyin'
								? 'bg-destructive/10 text-destructive'
								: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						{t === 'buyin' ? 'Buy In' : 'Cash Out'}
					</button>
				{/each}
			</div>

			<!-- Amount -->
			<div class="space-y-1.5">
				<div class="flex items-center justify-between">
					<label for="tx-amount" class="text-xs font-medium text-muted-foreground">
						Amount ({txUnit === 'cash' ? 'dollars' : 'chips'})
					</label>
					{#if rate}
						{@render unitToggle(txUnit, selectTxUnit)}
					{/if}
				</div>
				<Input
					id="tx-amount"
					bind:value={txAmount}
					type="number"
					min={txUnit === 'cash' ? '0.01' : '1'}
					step={txUnit === 'cash' ? '0.01' : '1'}
					placeholder={txUnit === 'cash' ? 'e.g. 20.00' : 'e.g. 400'}
					onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && submitTransaction()}
					autofocus
				/>
			</div>

			<!-- Balance preview -->
			{#if txUnit === 'cash' && txChips !== null}
				<p class="text-xs text-muted-foreground">
					Records
					<span class="font-mono font-semibold text-foreground">{txChips}</span>
					chips{txRounded ? ' (rounded to the nearest chip)' : ''}
				</p>
			{/if}
			{#if txNewBalance !== null}
				<p class="text-xs text-muted-foreground">
					New balance:
					<span class="font-mono font-semibold {balanceColor(txNewBalance)}">
						{formatBalance(txNewBalance)}
					</span>
				</p>
			{/if}

			{#if txError}
				<p class="text-xs text-destructive">{txError}</p>
			{/if}
		</div>

		<Dialog.Footer>
			<Dialog.Close>
				{#snippet child({ props })}
					<Button variant="outline" {...props}>Cancel</Button>
				{/snippet}
			</Dialog.Close>
			<Button
				onclick={submitTransaction}
				disabled={txSubmitting || !txAmountValid}
				class={txType === 'buyin'
					? 'bg-destructive text-white hover:bg-destructive/90'
					: 'bg-emerald-600 text-white hover:bg-emerald-600/90'}
			>
				{#if txSubmitting}
					Recording…
				{:else if txType === 'buyin'}
					Record Buy In
				{:else}
					Record Cash Out
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- ─── Settings Dialog ─────────────────────────────────────────────────────── -->
<Dialog.Root bind:open={settingsOpen}>
	<Dialog.Content class="sm:max-w-sm" showCloseButton={false}>
		<Dialog.Header>
			<Dialog.Title>Room Settings</Dialog.Title>
			<Dialog.Description>
				Set what chips are worth to view balances and enter amounts in dollars. Balances are always
				recorded in chips.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			<div class="space-y-1.5">
				<span class="text-xs font-medium text-muted-foreground">Conversion rate</span>
				<div class="flex items-center gap-2">
					<Input
						bind:value={settingsChips}
						type="number"
						min="1"
						step="1"
						placeholder="1000"
						aria-label="Chips"
						class="flex-1"
						onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && saveRate()}
					/>
					<span class="shrink-0 text-sm text-muted-foreground">chips = $</span>
					<Input
						bind:value={settingsDollars}
						type="number"
						min="0.01"
						step="0.01"
						placeholder="20.00"
						aria-label="Dollars"
						class="flex-1"
						onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && saveRate()}
					/>
				</div>
			</div>

			{#if settingsError}
				<p class="text-xs text-destructive">{settingsError}</p>
			{/if}
		</div>

		<Dialog.Footer>
			{#if rate}
				<Button
					variant="ghost"
					class="text-destructive sm:mr-auto"
					onclick={() => saveRate(true)}
					disabled={settingsSaving}
				>
					Remove rate
				</Button>
			{/if}
			<Dialog.Close>
				{#snippet child({ props })}
					<Button variant="outline" {...props}>Cancel</Button>
				{/snippet}
			</Dialog.Close>
			<Button onclick={() => saveRate()} disabled={settingsSaving || !settingsValid}>
				{settingsSaving ? 'Saving…' : 'Save'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- ─── Delete Player Dialog ────────────────────────────────────────────────── -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content class="sm:max-w-sm" showCloseButton={false}>
		<Dialog.Header>
			<Dialog.Title>Delete {deleteTarget?.name}?</Dialog.Title>
			<Dialog.Description>
				{#if deleteTxCount > 0}
					Their {deleteTxCount}
					{deleteTxCount === 1 ? 'transaction' : 'transactions'} will also be deleted, which changes the
					total in play.
				{/if}
				This can't be undone.
			</Dialog.Description>
		</Dialog.Header>

		{#if deleteError}
			<p class="text-xs text-destructive">{deleteError}</p>
		{/if}

		<Dialog.Footer>
			<Dialog.Close>
				{#snippet child({ props })}
					<Button variant="outline" {...props}>Cancel</Button>
				{/snippet}
			</Dialog.Close>
			<Button
				onclick={deletePlayer}
				disabled={deleting}
				class="bg-destructive text-white hover:bg-destructive/90"
			>
				{deleting ? 'Deleting…' : 'Delete Player'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
