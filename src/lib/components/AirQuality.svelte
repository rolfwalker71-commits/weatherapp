<script lang="ts">
	import Flower2 from '@lucide/svelte/icons/flower-2';
	import Wind from '@lucide/svelte/icons/wind';
	import { europeanAqi, pollenLevel } from '$lib/aqi';
	import { chromeState } from '$lib/chrome.svelte';
	import { scaleBarClass, scaleFillClass, scaleIconClass } from '$lib/colors';
	import { panelClass } from '$lib/platform';
	import { windowAdvice } from '$lib/lifestyle';
	import { weatherState } from '$lib/weather.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const air = $derived(weatherState.bundle?.air);
	const aqi = $derived(europeanAqi(air?.european_aqi));
	const alder = $derived(pollenLevel(weatherState.bundle?.pollen.alder));
	const birch = $derived(pollenLevel(weatherState.bundle?.pollen.birch));
	const grass = $derived(pollenLevel(weatherState.bundle?.pollen.grass));
	const windowHint = $derived(weatherState.bundle ? windowAdvice(weatherState.bundle) : null);
	const trend = $derived(weatherState.bundle?.airTrend ?? []);
	const maxPm = $derived(Math.max(8, ...trend.map((point) => point.pm25 ?? 0)));

	const shape = $derived(isDesktop ? 'rounded-md p-3' : 'rounded-[1.25rem] p-3');
</script>

<section id="luft" class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
	<h2 class="text-xl font-semibold leading-snug tracking-tight">Luft & Pollen</h2>
	<p class="mb-4 text-sm text-muted-foreground">Europäischer AQI und aktueller Pollenflug</p>

	<div class="mb-5 {shape} {scaleFillClass(aqi.tone)}">
		<div class="mb-2 flex items-center justify-between gap-3">
			<p class="flex items-center gap-2 font-medium">
				<Wind class="size-4 {scaleIconClass(aqi.tone)}" /> Luftqualität
			</p>
			<p class="tabular-nums">{air?.european_aqi ?? '–'} · {aqi.label}</p>
		</div>
		<div class="h-2 bg-background/40 {isDesktop ? 'rounded-sm' : 'rounded-full'}">
			<div
				class="h-2 {scaleBarClass(aqi.tone)} {isDesktop ? 'rounded-sm' : 'rounded-full'}"
				style="width: {Math.max(6, aqi.ratio * 100)}%;"
			></div>
		</div>
		<p class="mt-2 text-sm leading-snug opacity-80">{aqi.hint}</p>
		{#if air}
			<p class="mt-2 text-sm opacity-80">
				PM2.5 {air.pm2_5?.toFixed(1) ?? '–'} µg/m³ · PM10 {air.pm10?.toFixed(1) ?? '–'} µg/m³
			</p>
		{/if}
		{#if windowHint}
			<p class="mt-2 text-sm font-medium leading-snug">{windowHint.label}</p>
		{/if}
	</div>

	{#if trend.length}
		<div class="mb-5">
			<p class="mb-2 font-medium">Feinstaub-Trend</p>
			<div class="flex items-end gap-1" aria-label="PM2.5 Verlauf">
				{#each trend as point (point.time)}
					<div class="flex h-12 min-w-0 flex-1 items-end">
						<div
							class="w-full {isDesktop ? 'rounded-sm' : 'rounded-full'} {windowHint?.close
								? 'wx-bar-warn'
								: 'wx-bar-good'}"
							style="height: {Math.max(10, ((point.pm25 ?? 0) / maxPm) * 100)}%;"
							title="PM2.5 {point.pm25?.toFixed(1) ?? '–'}"
						></div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div>
		<p class="mb-3 flex items-center gap-2 font-medium"><Flower2 class="size-4 wx-icon-flower" /> Pollen</p>
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
			<div class="{shape} {scaleFillClass(alder.tone)}">
				<p class="text-sm opacity-75">Erle</p>
				<p class="font-medium">{alder.label}</p>
			</div>
			<div class="{shape} {scaleFillClass(birch.tone)}">
				<p class="text-sm opacity-75">Birke</p>
				<p class="font-medium">{birch.label}</p>
			</div>
			<div class="{shape} {scaleFillClass(grass.tone)}">
				<p class="text-sm opacity-75">Gräser</p>
				<p class="font-medium">{grass.label}</p>
			</div>
		</div>
	</div>
</section>
