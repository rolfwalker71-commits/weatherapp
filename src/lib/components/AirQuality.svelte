<script lang="ts">
	import { europeanAqi, pollenLevel } from '$lib/aqi';
	import { chromeState } from '$lib/chrome.svelte';
	import { scaleBarClass, scaleFillClass, scaleIconClass } from '$lib/colors';
	import { panelClass } from '$lib/platform';
	import { weatherState } from '$lib/weather.svelte';
	import AppIcon from './AppIcon.svelte';

	interface Props {
		page?: boolean;
	}

	let { page = false }: Props = $props();

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const air = $derived(weatherState.bundle?.air);
	const aqiValue = $derived(air?.european_aqi ?? null);
	const aqi = $derived(europeanAqi(aqiValue));
	const pollen = $derived(weatherState.bundle?.pollen);
	const alder = $derived(pollen?.alder);
	const birch = $derived(pollen?.birch);
	const grass = $derived(pollen?.grass);
	const trend = $derived((weatherState.bundle?.airTrend ?? []).filter((point) => point.pm25 != null));
	const maxPm = $derived(Math.max(8, ...trend.map((point) => point.pm25 ?? 0)));
	const hasPollen = $derived(alder != null || birch != null || grass != null);
	const cape = $derived(weatherState.bundle?.hours[0]?.cape ?? null);
	const visible = $derived(aqiValue != null || hasPollen || trend.length > 0 || cape != null);
	const shape = $derived(isDesktop ? 'rounded-md p-3' : 'rounded-[1.25rem] p-3');
	const split = $derived(page && (aqiValue != null || trend.length > 0) && hasPollen);
</script>

{#if visible}
	<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
		<h2 class="text-xl font-semibold leading-snug tracking-tight">Luft & Pollen</h2>
		<div class={split ? 'mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2' : 'mt-4'}>
			{#if aqiValue != null || trend.length}
				<div>
					{#if aqiValue != null}
						<div class="mb-5 {shape} {scaleFillClass(aqi.tone)}">
							<div class="mb-2 flex items-center justify-between gap-3">
								<p class="flex items-center gap-2 font-medium">
									<AppIcon name="wind" class="size-4 {scaleIconClass(aqi.tone)}" /> Luftqualität
								</p>
								<p class="tabular-nums">{aqiValue} · {aqi.label}</p>
							</div>
							<div class="h-2 bg-background/40 {isDesktop ? 'rounded-sm' : 'rounded-full'}">
								<div
									class="h-2 {scaleBarClass(aqi.tone)} {isDesktop ? 'rounded-sm' : 'rounded-full'}"
									style="width: {Math.max(6, aqi.ratio * 100)}%;"
								></div>
							</div>
							{#if air?.pm2_5 != null || air?.pm10 != null}
								<p class="mt-2 text-sm opacity-80">
									{#if air?.pm2_5 != null}
										PM2.5 {air.pm2_5.toFixed(1)} µg/m³
									{/if}
									{#if air?.pm2_5 != null && air?.pm10 != null}
										·
									{/if}
									{#if air?.pm10 != null}
										PM10 {air.pm10.toFixed(1)} µg/m³
									{/if}
								</p>
							{/if}
						</div>
					{/if}

					{#if trend.length}
						<div>
							<p class="mb-2 font-medium">Feinstaub-Trend</p>
							<div class="flex items-end gap-1" aria-label="PM2.5 Verlauf">
								{#each trend as point (point.time)}
									<div class="flex h-12 min-w-0 flex-1 items-end">
										<div
											class="w-full {isDesktop ? 'rounded-sm' : 'rounded-full'} wx-bar-good"
											style="height: {Math.max(10, ((point.pm25 ?? 0) / maxPm) * 100)}%;"
											title="PM2.5 {point.pm25?.toFixed(1)}"
										></div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			{#if hasPollen}
				<div>
					<p class="mb-3 flex items-center gap-2 font-medium">
						<AppIcon name="flower" class="size-6 wx-icon-flower" /> Pollen
					</p>
					<div class="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
						{#if alder != null}
							{@const level = pollenLevel(alder)}
							<div class="{shape} {scaleFillClass(level.tone)}">
								<p class="text-sm opacity-75">Erle</p>
								<p class="font-medium">{level.label}</p>
							</div>
						{/if}
						{#if birch != null}
							{@const level = pollenLevel(birch)}
							<div class="{shape} {scaleFillClass(level.tone)}">
								<p class="text-sm opacity-75">Birke</p>
								<p class="font-medium">{level.label}</p>
							</div>
						{/if}
						{#if grass != null}
							{@const level = pollenLevel(grass)}
							<div class="{shape} {scaleFillClass(level.tone)}">
								<p class="text-sm opacity-75">Gräser</p>
								<p class="font-medium">{level.label}</p>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
		{#if cape != null}
			<p class="mt-4 text-sm leading-snug">
				CAPE {Math.round(cape)} J/kg · Modell Open-Meteo
			</p>
		{/if}
	</section>
{:else if page}
	<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
		<h2 class="text-xl font-semibold leading-snug tracking-tight">Luft & Pollen</h2>
		<p class="mt-2 text-sm leading-snug text-muted-foreground">
			Keine Luft- oder Pollendaten für diesen Ort.
		</p>
	</section>
{/if}
