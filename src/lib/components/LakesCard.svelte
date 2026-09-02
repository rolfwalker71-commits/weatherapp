<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import AppIcon from './AppIcon.svelte';
	import { panelClass } from '$lib/platform';
	import { weatherState } from '$lib/weather.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const lakes = $derived(
		(weatherState.bundle?.lakes ?? []).filter((lake) => lake.waterTemp != null || lake.waveHeight != null)
	);
	const shape = $derived(isDesktop ? 'rounded-md p-3 ring-1 ring-border' : 'rounded-[1.25rem] p-3 bg-muted');
</script>

{#if lakes.length}
	<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
		<h2 class="flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
			<AppIcon name="seen" class="size-6 wx-icon-rain" /> Seen
		</h2>
		<div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
			{#each lakes as lake (lake.id)}
				<div class="{shape}">
					<p class="font-medium leading-snug">{lake.name}</p>
					<p class="text-sm text-muted-foreground">{Math.round(lake.distanceKm)} km entfernt</p>
					{#if lake.waterTemp != null}
						<p class="mt-2 text-sm leading-snug">Wassertemp. {lake.waterTemp.toFixed(1)}°</p>
						{#if lake.tempSource}
							<p class="text-sm leading-snug text-muted-foreground">{lake.tempSource}</p>
						{/if}
					{/if}
					{#if lake.waveHeight != null}
						<p class="mt-2 text-sm leading-snug">Wellen {lake.waveHeight.toFixed(1)} m</p>
					{/if}
				</div>
			{/each}
		</div>
	</section>
{/if}
