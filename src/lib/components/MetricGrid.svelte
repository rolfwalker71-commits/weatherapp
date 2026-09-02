<script lang="ts">
	import { europeanAqi, uvLevel } from '$lib/aqi';
	import AppIcon from './AppIcon.svelte';
	import { chromeState } from '$lib/chrome.svelte';
	import { scaleFillClass, scaleIconClass } from '$lib/colors';
	import { formatHpa, formatPercent, formatTime } from '$lib/format';
	import { weatherState } from '$lib/weather.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const current = $derived(weatherState.bundle?.current);
	const today = $derived(weatherState.bundle?.days[0]);
	const hour = $derived(weatherState.bundle?.hours[0]);
	const aqiValue = $derived(weatherState.bundle?.air?.european_aqi ?? null);
	const aqi = $derived(europeanAqi(aqiValue));
	const uvValue = $derived(hour?.uv ?? weatherState.bundle?.air?.uv_index ?? today?.uvMax ?? null);
	const uv = $derived(uvLevel(uvValue));
	const shape = $derived(isDesktop ? 'rounded-md ring-1 ring-border p-4' : 'rounded-3xl p-4');
</script>

{#if current && today}
	<section class="grid grid-cols-2 gap-3 xl:grid-cols-3" aria-label="Kennzahlen">
		{#if uvValue != null}
			<div class="{shape} {scaleFillClass(uv.tone)}">
				<p class="flex items-center gap-2 text-sm opacity-80"><AppIcon name="sun" class="size-4 {scaleIconClass(uv.tone)}" /> UV-Index</p>
				<p class="mt-2 text-2xl font-semibold tabular-nums">{uvValue.toFixed(1)}</p>
				<p class="mt-1 text-sm leading-snug opacity-80">{uv.label}</p>
			</div>
		{/if}
		{#if aqiValue != null}
			<div class="{shape} {scaleFillClass(aqi.tone)}">
				<p class="flex items-center gap-2 text-sm opacity-80"><AppIcon name="gauge" class="size-4 {scaleIconClass(aqi.tone)}" /> Luftqualität</p>
				<p class="mt-2 text-2xl font-semibold tabular-nums">{aqiValue}</p>
				<p class="mt-1 text-sm leading-snug opacity-80">{aqi.label}</p>
			</div>
		{/if}
		{#if today.sunrise && today.sunset}
			<div class="{shape} wx-chip-clear">
				<p class="flex items-center gap-2 text-sm opacity-80"><AppIcon name="sunrise" class="size-4 wx-icon-sun" /> Sonnenaufgang</p>
				<p class="mt-2 text-2xl font-semibold tabular-nums">{formatTime(today.sunrise)}</p>
				<p class="mt-1 flex items-center gap-2 text-sm opacity-80">
					<AppIcon name="sunset" class="size-4 wx-icon-thermo" /> Untergang {formatTime(today.sunset)}
				</p>
			</div>
		{/if}
		{#if today.precipProb != null}
			<div class="{shape} wx-chip-rain">
				<p class="flex items-center gap-2 text-sm opacity-80"><AppIcon name="drop" class="size-4 wx-icon-drop" /> Regenrisiko</p>
				<p class="mt-2 text-2xl font-semibold tabular-nums">{formatPercent(today.precipProb)}</p>
				<p class="mt-1 text-sm opacity-80">{today.precipMm.toFixed(1)} mm heute</p>
			</div>
		{:else if today.precipMm != null}
			<div class="{shape} wx-chip-rain">
				<p class="flex items-center gap-2 text-sm opacity-80"><AppIcon name="drop" class="size-4 wx-icon-drop" /> Niederschlag</p>
				<p class="mt-2 text-2xl font-semibold tabular-nums">{today.precipMm.toFixed(1)} mm</p>
			</div>
		{/if}
		{#if current.pressure_msl != null}
			<div class="{shape} wx-chip-fog col-span-2 xl:col-span-1">
				<p class="flex items-center gap-2 text-sm opacity-80"><AppIcon name="eye" class="size-4 wx-icon-cloud" /> Druck & Feuchte</p>
				<p class="mt-2 text-2xl font-semibold tabular-nums">{formatHpa(current.pressure_msl)}</p>
				{#if current.relative_humidity_2m != null}
					<p class="mt-1 text-sm opacity-80">{formatPercent(current.relative_humidity_2m)} relative Feuchte</p>
				{/if}
			</div>
		{/if}
	</section>
{/if}
