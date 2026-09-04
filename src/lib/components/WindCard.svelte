<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import AppIcon from './AppIcon.svelte';
	import { formatPercent, formatWind, windDirection } from '$lib/format';
	import { panelClass } from '$lib/platform';
	import { unitsState } from '$lib/units.svelte';
	import { weatherState } from '$lib/weather.svelte';

	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const current = $derived(weatherState.bundle?.current);
	const hour = $derived(weatherState.bundle?.hours[0]);
	const shape = $derived(
		isDesktop ? 'rounded-md p-3 ring-1 ring-border' : 'rounded-[1.25rem] p-3 bg-muted'
	);
</script>

{#if current}
	<section class="{panelClass(chromeState.chrome)} {compact ? 'p-4' : 'p-5 sm:p-6'}">
		<h2
			class="flex min-w-0 items-center gap-2 {compact
				? 'text-base'
				: 'text-xl'} font-semibold leading-snug tracking-tight"
		>
			<AppIcon name="wind" class="size-6 wx-icon-wind" /> Wind jetzt
		</h2>
		<p class="mt-2 {compact ? 'text-2xl' : 'text-3xl'} font-semibold tabular-nums">
			{formatWind(current.wind_speed_10m, unitsState.wind)}
		</p>
		<p class="mt-1 text-sm text-muted-foreground">
			aus {windDirection(current.wind_direction_10m)}
			{#if current.wind_gusts_10m != null}
				· Böen {formatWind(current.wind_gusts_10m, unitsState.wind)}
			{/if}
		</p>
		{#if !compact && hour?.cape != null}
			<p class="mt-2 text-sm leading-snug">
				CAPE {Math.round(hour.cape)} J/kg · Modell
			</p>
		{/if}

		{#if !compact}
			<dl class="mt-4 grid min-w-0 grid-cols-2 gap-2">
				{#if hour?.gusts != null}
					<div class="min-w-0 {shape}">
						<dt class="break-words text-sm text-muted-foreground">Böen (Stunde)</dt>
						<dd class="font-medium tabular-nums">{formatWind(hour.gusts, unitsState.wind)}</dd>
					</div>
				{/if}
				{#if current.relative_humidity_2m != null}
					<div class="min-w-0 {shape}">
						<dt class="break-words text-sm text-muted-foreground">Luftfeuchtigkeit</dt>
						<dd class="font-medium tabular-nums">{formatPercent(current.relative_humidity_2m)}</dd>
					</div>
				{/if}
				{#if current.pressure_msl != null}
					<div class="min-w-0 {shape}">
						<dt class="break-words text-sm text-muted-foreground">Luftdruck</dt>
						<dd class="font-medium tabular-nums">{Math.round(current.pressure_msl)} hPa</dd>
					</div>
				{/if}
				{#if current.cloud_cover != null}
					<div class="min-w-0 {shape}">
						<dt class="break-words text-sm text-muted-foreground">Bewölkung</dt>
						<dd class="font-medium tabular-nums">{Math.round(current.cloud_cover)} %</dd>
					</div>
				{/if}
			</dl>
		{/if}
	</section>
{/if}
