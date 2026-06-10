<script lang="ts">
	import { page } from '$app/stores';
</script>

<svelte:head>
	<title>Error · Poker Tracker</title>
</svelte:head>

<main class="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
	<div class="text-6xl mb-4">♠</div>
	<h1 class="font-heading text-3xl font-bold text-foreground mb-2">
		{$page.status === 404 ? 'Room not found' : 'Something went wrong'}
	</h1>
	<p class="text-muted-foreground mb-6 max-w-sm">
		{$page.error?.message ?? 'An unexpected error occurred.'}
	</p>
	<a
		href="/"
		class="inline-flex h-10 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
	>
		Create a new room
	</a>
</main>
