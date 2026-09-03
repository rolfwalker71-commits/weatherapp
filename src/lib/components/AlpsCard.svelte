<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import AppIcon from './AppIcon.svelte';
	import { formatTemp, formatWind, windDirection } from '$lib/format';
	import { snowFrost } from '$lib/insights';
	import { panelClass } from '$lib/platform';
	import { unitsState } from '$lib/units.svelte';
	import { weatherState } from '$lib/weather.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const bundle = $derived(weatherState.bundle);
	const frost = $derived(bundle ? snowFrost(bundle) : null);
	const bands = $derived((bundle?.elevations ?? []).filter((band) => band.temperature != null || band.wind != null));
	const shape = $derived(isDesktop ? 'rounded-md p-3 ring-1 ring-border' : 'rounded-[1.25rem] p-3 bg-muted');
	const visible = $derived(bands.length > 0 || frost?.snowLabel);
</script>

{#if bundle && visible}
	<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
		<h2 class="flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
			<AppIcon name="snow" class="size-6 wx-icon-snow" /> Höhen
		</h2>
		{#if frost?.snowLabel}
			<p class="mt-2 text-sm leading-snug">{frost.snowLabel}</p>
		{/if}

		{#if bands.length}
			<div class="mt-4 grid grid-cols-3 gap-2">
				{#each bands as band (band.elevation)}
					<div class="{shape}">
						<p class="text-sm opacity-75">{band.elevation} m</p>
						{#if band.temperature != null}
							<p class="text-lg font-semibold tabular-nums">{formatTemp(band.temperature)}</p>
						{/if}
						{#if band.wind != null}
							<p class="text-sm text-muted-foreground">
								{formatWind(band.wind, unitsState.wind)}
								{#if band.windDir != null}
									{windDirection(band.windDir)}
								{/if}
							</p>
						{/if}
					</div>
				{/each}
			</div>
			<p class="mt-2 text-sm text-muted-foreground">Open-Meteo für diese Höhen, nicht Stationsmessung.</p>
		{/if}
	</section>
{/if}
