<script lang="ts">
	import { goto } from '$app/navigation';

	let creating = $state(false);
	let errorMsg = $state('');

	async function createRoom() {
		creating = true;
		errorMsg = '';
		try {
			const res = await fetch('/api/rooms', { method: 'POST' });
			if (!res.ok) throw new Error('Failed to create room');
			const { id } = await res.json();
			await goto(`/room/${id}`);
		} catch {
			errorMsg = 'Could not create room. Please try again.';
			creating = false;
		}
	}
</script>

<svelte:head>
	<title>Poker Tracker</title>
</svelte:head>

<main class="flex min-h-screen flex-col items-center justify-center bg-background px-4">
	<div class="flex max-w-md flex-col items-center gap-8 text-center">
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

		<!-- CTA -->
		<div class="flex w-full flex-col items-center gap-3">
			<button
				onclick={createRoom}
				disabled={creating}
				class="inline-flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
			>
				{#if creating}
					<span class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></span>
					Creating room…
				{:else}
					Create New Room
				{/if}
			</button>

			{#if errorMsg}
				<p class="text-sm text-destructive">{errorMsg}</p>
			{/if}
		</div>

		<!-- How it works -->
		<div class="w-full rounded-xl border border-border bg-card p-5 text-left">
			<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">How it works</h2>
			<ol class="space-y-2 text-sm text-foreground">
				<li class="flex gap-2">
					<span class="text-primary font-bold">1.</span>
					<span>Create a room — share the link with your players.</span>
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
