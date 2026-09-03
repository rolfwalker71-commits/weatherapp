<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import { fetchAvalanche } from '$lib/push-client';
	import { panelClass } from '$lib/platform';
	import type { AvalancheBulletin } from '$lib/types';
	import { weatherState } from '$lib/weather.svelte';
	import AppIcon from './AppIcon.svelte';

	let bulletin = $state<AvalancheBulletin | null>(null);

	$effect(() => {
		const place = weatherState.place;
		void load(place.latitude, place.longitude);
	});

	async function load(lat: number, lon: number) {
		const next = await fetchAvalanche(lat, lon);
		bulletin = next.available && next.level != null ? next : null;
	}

	const visible = $derived(bulletin != null);
</script>

{#if visible && bulletin}
	<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
		<h2 class="flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
			<AppIcon name="snow" class="size-6 wx-icon-snow" /> Schneebericht
		</h2>
		<p class="mt-2 text-sm text-muted-foreground">{bulletin.source}</p>
		<p class="mt-1 font-medium leading-snug">{bulletin.label}</p>
		{#if bulletin.note}
			<p class="mt-1 text-sm leading-snug text-muted-foreground">{bulletin.note}</p>
		{/if}
	</section>
{/if}
