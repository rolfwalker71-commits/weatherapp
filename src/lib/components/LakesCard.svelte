<script lang="ts">
	import Waves from '@lucide/svelte/icons/waves';
	import { chromeState } from '$lib/chrome.svelte';
	import { panelClass } from '$lib/platform';
	import { weatherState } from '$lib/weather.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const lakes = $derived(weatherState.bundle?.lakes ?? []);
	const shape = $derived(isDesktop ? 'rounded-md p-3 ring-1 ring-border' : 'rounded-[1.25rem] p-3 bg-muted');
</script>

<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
	<h2 class="flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
		<Waves class="size-5 wx-icon-rain" /> Seen & Sicht
	</h2>
	{#if lakes.length}
		<div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
			{#each lakes as lake (lake.id)}
				<div class="{shape}">
					<p class="font-medium leading-snug">{lake.name}</p>
					<p class="text-sm text-muted-foreground">{Math.round(lake.distanceKm)} km entfernt</p>
					<p class="mt-2 text-sm">
						Wassertemp. {lake.waterTemp == null ? '–' : `${lake.waterTemp.toFixed(1)}°`}
						· Wellen {lake.waveHeight == null ? '–' : `${lake.waveHeight.toFixed(1)} m`}
					</p>
					<p class="mt-1 text-sm leading-snug {lake.fogRisk ? 'font-medium' : 'text-muted-foreground'}">
						{lake.fogLabel}
					</p>
				</div>
			{/each}
		</div>
	{:else}
		<p class="mt-2 text-sm text-muted-foreground">Kein grosser CH-See in der Nähe oder Marinedaten fehlen.</p>
	{/if}
</section>
