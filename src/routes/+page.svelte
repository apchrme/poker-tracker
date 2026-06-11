<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';

	// ── Create room ──────────────────────────────────────────────────────────
	let creating = $state(false);
	let createError = $state('');

	async function createRoom() {
		creating = true;
		createError = '';
		try {
			const res = await fetch('/api/rooms', { method: 'POST' });
			if (!res.ok) throw new Error('Failed to create room');
			const { id }: {id: string} = await res.json();
			await goto(resolve(`/room/${id}`));
		} catch {
			createError = 'Could not create room. Please try again.';
			creating = false;
		}
	}

	// ── Join room ────────────────────────────────────────────────────────────
	let joinCode = $state('');
	let joining = $state(false);
	let joinError = $state('');

	async function joinRoom() {
		const code = joinCode.trim().toUpperCase();
		if (!code) return;
		joining = true;
		joinError = '';
		try {
			const res = await fetch(`/api/rooms/${code}`);
			if (res.status === 404) throw new Error('Room not found or has expired.');
			if (!res.ok) throw new Error('Could not join room.');
			await goto(resolve(`/room/${code}`));
		} catch (e: unknown) {
			joinError = e instanceof Error ? e.message : 'Could not join room.';
			joining = false;
		}
	}
</script>

<svelte:head>
	<title>Poker Tracker</title>
</svelte:head>

<main class="flex min-h-screen flex-col items-center justify-center bg-background px-4">
	<div class="flex max-w-md w-full flex-col items-center gap-8 text-center">
		<!-- Logo / Icon -->
		<div class="flex flex-col items-center gap-3">
			<div class="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-4xl shadow-inner">
				♠
			</div>
			<div>
				<h1 class="font-heading text-4xl font-bold tracking-tight text-foreground">Poker Tracker</h1>
				<p class="mt-1 text-base text-muted-foreground">
					Track buy-ins, cash-outs, and balances for your poker night.
				</p>
			</div>
		</div>

		<!-- CTAs -->
		<div class="flex w-full flex-col items-center gap-4">
			<!-- Create -->
			<Button
				onclick={createRoom}
				disabled={creating}
				size="lg"
				class="w-full max-w-xs"
			>
				{#if creating}
					<span class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></span>
					Creating room…
				{:else}
					Create New Room
				{/if}
			</Button>

			{#if createError}
				<p class="text-sm text-destructive">{createError}</p>
			{/if}

			<!-- Divider -->
			<div class="flex w-full max-w-xs items-center gap-3">
				<div class="h-px flex-1 bg-border"></div>
				<span class="text-xs text-muted-foreground">or join an existing room</span>
				<div class="h-px flex-1 bg-border"></div>
			</div>

			<!-- Join -->
			<div class="flex w-full max-w-xs gap-2">
				<Input
					bind:value={joinCode}
					placeholder="Room code"
					maxlength={4}
					class="text-center font-mono text-lg font-semibold uppercase tracking-widest"
					onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && joinRoom()}
					disabled={joining}
				/>
				<Button
					onclick={joinRoom}
					disabled={joining || !joinCode.trim()}
					variant="outline"
				>
					{joining ? 'Joining…' : 'Join'}
				</Button>
			</div>

			{#if joinError}
				<p class="text-sm text-destructive">{joinError}</p>
			{/if}
		</div>

		<!-- How it works -->
		<div class="w-full rounded-xl border border-border bg-card p-5 text-left">
			<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">How it works</h2>
			<ol class="space-y-2 text-sm text-foreground">
				<li class="flex gap-2">
					<span class="text-primary font-bold">1.</span>
					<span>Create a room — share the link or 4-letter code with your players.</span>
				</li>
				<li class="flex gap-2">
					<span class="text-primary font-bold">2.</span>
					<span>Add players to the room. Everyone starts at 0.</span>
				</li>
				<li class="flex gap-2">
					<span class="text-primary font-bold">3.</span>
					<span>Log buy-ins (chips out) and cash-outs (chips in) as they happen.</span>
				</li>
				<li class="flex gap-2">
					<span class="text-primary font-bold">4.</span>
					<span>See who's up, who's down — at a glance.</span>
				</li>
			</ol>
		</div>

		<p class="text-xs text-muted-foreground">Rooms are automatically deleted after 7 days.</p>
	</div>
</main>