<script lang="ts">
	import Mountain from '@lucide/svelte/icons/mountain';
	import { chromeState } from '$lib/chrome.svelte';
	import { formatKmH, formatTemp, windDirection } from '$lib/format';
	import { snowFrost } from '$lib/insights';
	import { panelClass } from '$lib/platform';
	import { namedWind } from '$lib/wind-situation';
	import { weatherState } from '$lib/weather.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const bundle = $derived(weatherState.bundle);
	const wind = $derived(bundle ? namedWind(weatherState.place, bundle) : null);
	const frost = $derived(bundle ? snowFrost(bundle) : null);
	const shape = $derived(isDesktop ? 'rounded-md p-3 ring-1 ring-border' : 'rounded-[1.25rem] p-3 bg-muted');
</script>

{#if bundle && wind && frost}
	<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
		<h2 class="flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
			<Mountain class="size-5 wx-icon-snow" /> Lage & Höhen
		</h2>
		<p class="mt-2 text-lg font-medium leading-snug">{wind.name}</p>
		<p class="text-sm leading-snug text-muted-foreground">
			{wind.detail}{wind.uncertain ? ' · unsicher' : ''}
		</p>
		<p class="mt-3 text-sm leading-snug">{frost.snowLabel} · {frost.frostLabel}</p>

		{#if bundle.elevations.length}
			<div class="mt-4 grid grid-cols-3 gap-2">
				{#each bundle.elevations as band (band.elevation)}
					<div class="{shape}">
						<p class="text-sm opacity-75">{band.elevation} m</p>
						<p class="text-lg font-semibold tabular-nums">
							{band.temperature == null ? '–' : formatTemp(band.temperature)}
						</p>
						<p class="text-sm text-muted-foreground">
							{band.wind == null ? '–' : formatKmH(band.wind)}
							{#if band.windDir != null}
								{windDirection(band.windDir)}
							{/if}
						</p>
					</div>
				{/each}
			</div>
			<p class="mt-2 text-sm text-muted-foreground">Berg vs. Tal über Open-Meteo-Höhen, nicht Stationsmessung.</p>
		{/if}
	</section>
{/if}
