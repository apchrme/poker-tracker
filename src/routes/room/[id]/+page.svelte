<script lang="ts">
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button/index';
	import DarkModeButton from '$lib/components/buttons/DarkModeButton.svelte';
	import { Minus, Plus } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	const roomId = $derived($page.params.id);

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
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.message ?? 'Failed');
			}
			newPlayerName = '';
			await invalidateAll();
		} catch (e: unknown) {
			addPlayerError = e instanceof Error ? e.message : 'Could not add player.';
		} finally {
			addingPlayer = false;
		}
	}

	// ─── Transaction Modal ────────────────────────────────────────────────────
	type TxType = 'buyin' | 'cashout';
	let txModalOpen = $state(false);
	let txType = $state<TxType>('buyin');
	let txPlayerId = $state<number | null>(null);
	let txAmount = $state('');
	let txSubmitting = $state(false);
	let txError = $state('');

	function openTxModal(playerId: number, type: TxType) {
		txPlayerId = playerId;
		txType = type;
		txAmount = '';
		txError = '';
		txModalOpen = true;
	}

	function closeTxModal() {
		txModalOpen = false;
		txError = '';
	}

	async function submitTransaction() {
		const amount = parseInt(txAmount, 10);
		if (!txPlayerId || isNaN(amount) || amount <= 0) {
			txError = 'Enter a valid positive amount.';
			return;
		}
		txSubmitting = true;
		txError = '';
		try {
			const res = await fetch(`/api/rooms/${roomId}/transactions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ playerId: txPlayerId, type: txType, amount })
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.message ?? 'Failed');
			}
			txModalOpen = false;
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

	function formatDate(ts: unknown): string {
		// ts may be a Date, number (unix seconds), or string
		let d: Date;
		if (ts instanceof Date) {
			d = ts;
		} else if (typeof ts === 'number') {
			d = new Date(ts * 1000);
		} else {
			d = new Date(ts as string);
		}
		return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	let copied = $state(false);
	function copyLink() {
		navigator.clipboard.writeText(window.location.href);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	// Sort players: biggest balance first
	const sortedPlayers = $derived(
		[...data.players].sort((a, b) => b.balance - a.balance)
	);

	// Reverse-sorted transactions for the log (newest first)
	const recentTransactions = $derived(
		[...data.transactions].reverse().slice(0, 50)
	);

	const txPlayer = $derived(
		txPlayerId ? data.players.find((p) => p.id === txPlayerId) : null
	);

	// Keyboard shortcut: Escape closes modal
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && txModalOpen) closeTxModal();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Room {roomId} — Poker Tracker</title>
</svelte:head>

<!-- ─── Page ────────────────────────────────────────────────────────────────── -->
<div class="min-h-screen bg-background">
	<!-- Header -->
	<header class="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
		<div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
			<div class="flex items-center gap-3">
				<a href="/" class="text-xl">♠</a>
				<div>
					<div class="flex items-center gap-2">
						<h1 class="font-heading text-base font-semibold leading-none text-foreground">
							Room
							<span class="font-mono tracking-widest text-primary">{roomId}</span>
						</h1>
					</div>
					<p class="mt-0.5 text-xs text-muted-foreground">
						Expires {new Date(data.room.expiresAt).toLocaleDateString()}
					</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
			<button
				onclick={copyLink}
				class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
			>
				{#if copied}
					✓ Copied!
				{:else}
					Share link
				{/if}
			</button>
			<DarkModeButton />
			</div>
		</div>
	</header>

	<div class="mx-auto max-w-3xl space-y-6 px-4 py-6">
		<!-- ─── Add Player ──────────────────────────────────────────────────── -->
		<section class="rounded-xl border border-border bg-card p-4">
			<h2 class="mb-3 text-sm font-semibold text-foreground">Add Player</h2>
			<div class="flex gap-2">
				<input
					bind:value={newPlayerName}
					placeholder="Player name"
					maxlength="50"
					class="h-9 flex-1 rounded-lg border border-border bg-input/30 px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
					onkeydown={(e) => e.key === 'Enter' && addPlayer()}
					disabled={addingPlayer}
				/>
				<button
					onclick={addPlayer}
					disabled={addingPlayer || !newPlayerName.trim()}
					class="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{addingPlayer ? 'Adding…' : 'Add'}
				</button>
			</div>
			{#if addPlayerError}
				<p class="mt-2 text-xs text-destructive">{addPlayerError}</p>
			{/if}
		</section>

		<!-- ─── Players Table ──────────────────────────────────────────────── -->
		{#if data.players.length === 0}
			<div class="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
				No players yet. Add one above to get started.
			</div>
		{:else}
			<section>
				<h2 class="mb-2 text-sm font-semibold text-foreground">Players</h2>
				<div class="overflow-hidden rounded-xl border border-border bg-card">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-border text-xs font-medium uppercase tracking-wider text-muted-foreground">
								<th class="px-4 py-3 text-left">Player</th>
								<th class="px-4 py-3 text-right">Balance</th>
								<th class="px-4 py-3 text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each sortedPlayers as player (player.id)}
								<tr class="border-b border-border/50 last:border-0 transition hover:bg-muted/30">
									<td class="px-4 py-3 font-medium text-foreground">{player.name}</td>
									<td class="px-4 py-3 text-right">
										<span class="font-mono font-semibold {balanceColor(player.balance)}">
											{formatBalance(player.balance)}
										</span>
									</td>
									<td class="px-4 py-3 text-right">
										<div class="flex justify-end gap-1.5">
											<Button
												onclick={() => openTxModal(player.id, 'buyin')}
												class="bg-destructive/10 font-medium text-destructive transition hover:bg-destructive/20"
												size="icon"
											>
												<Minus />
											</Button>
											<Button
												onclick={() => openTxModal(player.id, 'cashout')}
												class="bg-emerald-500/10 font-medium text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-400"
												size="icon"
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

			<!-- ─── Stats Strip ──────────────────────────────────────────── -->
			<div class="grid grid-cols-3 gap-3">
				{#each [
					{ label: 'Players', value: data.players.length },
					{ label: 'Transactions', value: data.transactions.length },
					{ label: 'Total chips in play', value: -data.players.reduce((acc, p) => acc + p.balance, 0) }
				] as stat (stat)}
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
							<tr class="border-b border-border text-xs font-medium uppercase tracking-wider text-muted-foreground">
								<th class="px-4 py-3 text-left">Time</th>
								<th class="px-4 py-3 text-left">Player</th>
								<th class="px-4 py-3 text-left">Type</th>
								<th class="px-4 py-3 text-right">Amount</th>
							</tr>
						</thead>
						<tbody>
							{#each recentTransactions as tx (tx.id)}
								<tr class="border-b border-border/50 last:border-0 transition hover:bg-muted/30">
									<td class="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(tx.createdAt)}</td>
									<td class="px-4 py-2.5 font-medium text-foreground">{tx.playerName}</td>
									<td class="px-4 py-2.5">
										{#if tx.type === 'buyin'}
											<Badge variant="destructive">Buy In</Badge>
										{:else}
											<Badge class="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-transparent">Cash Out</Badge>
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

<!-- ─── Transaction Modal ───────────────────────────────────────────────────── -->
{#if txModalOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
		onclick={closeTxModal}
		aria-hidden="true"
	></div>

	<!-- Dialog -->

	<div
		role="dialog"
		aria-modal="true"
		aria-label="{txType === 'buyin' ? 'Buy In' : 'Cash Out'} for {txPlayer?.name}"
		class="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl"
	>
		<div class="mb-5 flex items-start justify-between">
			<div>
				<h3 class="font-heading text-lg font-semibold text-foreground">
					{txType === 'buyin' ? 'Buy In' : 'Cash Out'}
				</h3>
				<p class="text-sm text-muted-foreground">
					{txPlayer?.name} · current balance:
					<span class="font-mono font-semibold {balanceColor(txPlayer?.balance ?? 0)}">
						{formatBalance(txPlayer?.balance ?? 0)}
					</span>
				</p>
			</div>
			<Button
				onclick={closeTxModal}
				size="icon-lg"
				aria-label="Close"
				variant="outline"
			>
				✕
			</Button>
		</div>

		<div class="space-y-4">
			<!-- Toggle type -->
			<div class="flex rounded-lg border border-border p-1">
				{#each (['buyin', 'cashout'] as const) as t (t)}
					<button
						onclick={() => { txType = t; txError = ''; }}
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

			<!-- Amount input -->
			<div>
				<label for="tx-amount" class="mb-1.5 block text-xs font-medium text-muted-foreground">
					Amount (chips)
				</label>
				<input
					id="tx-amount"
					bind:value={txAmount}
					type="number"
					min="1"
					step="1"
					placeholder="e.g. 400"
					class="h-10 w-full rounded-lg border border-border bg-input/30 px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
					onkeydown={(e) => e.key === 'Enter' && submitTransaction()}
					autofocus
				/>
			</div>

			<!-- Preview -->
			{#if txAmount && parseInt(txAmount) > 0}
				{@const amt = parseInt(txAmount)}
				{@const newBal = (txPlayer?.balance ?? 0) + (txType === 'buyin' ? -amt : amt)}
				<p class="text-xs text-muted-foreground">
					New balance:
					<span class="font-mono font-semibold {balanceColor(newBal)}">
						{formatBalance(newBal)}
					</span>
				</p>
			{/if}

			{#if txError}
				<p class="text-xs text-destructive">{txError}</p>
			{/if}

			<!-- Submit -->
			<button
				onclick={submitTransaction}
				disabled={txSubmitting || !txAmount || parseInt(txAmount) <= 0}
				class="h-10 w-full rounded-lg text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50
					{txType === 'buyin'
						? 'bg-destructive text-white hover:bg-destructive/90'
						: 'bg-emerald-600 text-white hover:bg-emerald-600/90'}"
			>
				{#if txSubmitting}
					Recording…
				{:else if txType === 'buyin'}
					Record Buy In
				{:else}
					Record Cash Out
				{/if}
			</button>
		</div>
	</div>
{/if}
