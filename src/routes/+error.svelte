<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Error · Poker Tracker</title>
</svelte:head>

<main class="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
	<div class="mb-4 text-6xl">♠</div>
	<h1 class="mb-2 font-heading text-3xl font-bold text-foreground">
		{page.status === 404 ? 'Room not found' : 'Something went wrong'}
	</h1>
	<p class="mb-6 max-w-sm text-muted-foreground">
		{page.error?.message ?? 'An unexpected error occurred.'}
	</p>
	<a
		href={resolve('/')}
		class="inline-flex h-10 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
	>
		Create a new room
	</a>
</main>
