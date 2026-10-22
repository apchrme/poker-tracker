<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import { responseError } from '#lib/api.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import DarkModeButton from '#lib/components/buttons/DarkModeButton.svelte';
	import { Minus, Plus, Copy, Check } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	// Canonical (uppercase) code, even if the URL was typed in lowercase.
	const roomId = $derived(data.room.id);

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
	// bind:value on a number input yields a number, or null when empty.
	let txAmount = $state<number | null>(null);
	let txSubmitting = $state(false);
	let txError = $state('');

	// Whole chips only: previously "1.5" was silently recorded as 1.
	const txAmountValid = $derived(
		typeof txAmount === 'number' && Number.isSafeInteger(txAmount) && txAmount > 0
	);

	function openTxDialog(playerId: number, type: TxType) {
		txPlayerId = playerId;
		txType = type;
		txAmount = null;
		txError = '';
		txDialogOpen = true;
	}

	async function submitTransaction() {
		if (txSubmitting) return;
		if (!txPlayerId || !txAmountValid) {
			txError = 'Enter a whole number of chips greater than 0.';
			return;
		}
		txSubmitting = true;
		txError = '';
		try {
			const res = await fetch(`/api/rooms/${roomId}/transactions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ playerId: txPlayerId, type: txType, amount: txAmount })
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

	// ─── Helpers ──────────────────────────────────────────────────────────────
	function formatBalance(bal: number): string {
		return bal >= 0 ? `+${bal}` : `${bal}`;
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
		{ label: 'Total chips in play', value: -data.players.reduce((acc, p) => acc + p.balance, 0) }
	]);
	const txPlayer = $derived(txPlayerId ? data.players.find((p) => p.id === txPlayerId) : null);
	const txNewBalance = $derived(
		txAmountValid && txAmount !== null
			? (txPlayer?.balance ?? 0) + (txType === 'buyin' ? -txAmount : txAmount)
			: null
	);
</script>

<svelte:head>
	<title>Room {roomId} · Poker Tracker</title>
</svelte:head>

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
				<h2 class="mb-2 text-sm font-semibold text-foreground">Players</h2>
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
											<span class="text-destructive">−{tx.amount}</span>
										{:else}
											<span class="text-emerald-600 dark:text-emerald-400">+{tx.amount}</span>
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
				<label for="tx-amount" class="text-xs font-medium text-muted-foreground">
					Amount (chips)
				</label>
				<Input
					id="tx-amount"
					bind:value={txAmount}
					type="number"
					min="1"
					step="1"
					placeholder="e.g. 400"
					onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && submitTransaction()}
					autofocus
				/>
			</div>

			<!-- Balance preview -->
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
