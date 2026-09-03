<script lang="ts">
	import { onMount } from 'svelte';
	import WidgetView from '$lib/components/WidgetView.svelte';
	import { loadHomePlace, loadLastPlace } from '$lib/storage';
	import { hydrateFromCache, loadPlace, weatherState } from '$lib/weather.svelte';

	onMount(() => {
		hydrateFromCache();
		if (weatherState.bundle) return;
		const place = loadLastPlace() ?? loadHomePlace() ?? weatherState.place;
		void loadPlace(place, { recent: false });
	});
</script>

<svelte:head>
	<title>Wetter · {weatherState.place.name}</title>
</svelte:head>

<div class="wx-page min-h-dvh bg-background text-foreground">
	<main
		id="main"
		class="mx-auto w-full max-w-md px-4 py-6"
		style="padding-top: max(1.5rem, env(safe-area-inset-top, 0px));"
	>
		<WidgetView standalone />
	</main>
</div>
