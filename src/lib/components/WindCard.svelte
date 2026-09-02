<script lang="ts">
	import Wind from '@lucide/svelte/icons/wind';
	import { chromeState } from '$lib/chrome.svelte';
	import { formatKmH, formatPercent, windDirection } from '$lib/format';
	import { panelClass } from '$lib/platform';
	import { weatherState } from '$lib/weather.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const current = $derived(weatherState.bundle?.current);
	const hour = $derived(weatherState.bundle?.hours[0]);
	const shape = $derived(isDesktop ? 'rounded-md p-3 ring-1 ring-border' : 'rounded-[1.25rem] p-3 bg-muted');
</script>

{#if current}
	<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
		<h2 class="flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
			<Wind class="size-6 wx-icon-wind" /> Wind
		</h2>
		<p class="mt-2 text-3xl font-semibold tabular-nums">{formatKmH(current.wind_speed_10m)}</p>
		<p class="mt-1 text-sm text-muted-foreground">
			aus {windDirection(current.wind_direction_10m)}
			{#if current.wind_gusts_10m != null}
				· Böen {formatKmH(current.wind_gusts_10m)}
			{/if}
		</p>
		<dl class="mt-4 grid grid-cols-2 gap-2">
			{#if hour?.gusts != null}
				<div class="{shape}">
					<dt class="text-sm text-muted-foreground">Böen (Stunde)</dt>
					<dd class="font-medium tabular-nums">{formatKmH(hour.gusts)}</dd>
				</div>
			{/if}
			{#if current.relative_humidity_2m != null}
				<div class="{shape}">
					<dt class="text-sm text-muted-foreground">Luftfeuchtigkeit</dt>
					<dd class="font-medium tabular-nums">{formatPercent(current.relative_humidity_2m)}</dd>
				</div>
			{/if}
			{#if current.pressure_msl != null}
				<div class="{shape}">
					<dt class="text-sm text-muted-foreground">Luftdruck</dt>
					<dd class="font-medium tabular-nums">{Math.round(current.pressure_msl)} hPa</dd>
				</div>
			{/if}
			{#if current.cloud_cover != null}
				<div class="{shape}">
					<dt class="text-sm text-muted-foreground">Bewölkung</dt>
					<dd class="font-medium tabular-nums">{Math.round(current.cloud_cover)} %</dd>
				</div>
			{/if}
		</dl>
	</section>
{/if}
