<script lang="ts">
	import Droplets from '@lucide/svelte/icons/droplets';
	import Eye from '@lucide/svelte/icons/eye';
	import Gauge from '@lucide/svelte/icons/gauge';
	import Sun from '@lucide/svelte/icons/sun';
	import Sunrise from '@lucide/svelte/icons/sunrise';
	import Sunset from '@lucide/svelte/icons/sunset';
	import { europeanAqi, uvLevel } from '$lib/aqi';
	import { chromeState } from '$lib/chrome.svelte';
	import { scaleFillClass, scaleIconClass } from '$lib/colors';
	import { formatHpa, formatPercent, formatTime } from '$lib/format';
	import { weatherState } from '$lib/weather.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const current = $derived(weatherState.bundle?.current);
	const today = $derived(weatherState.bundle?.days[0]);
	const hour = $derived(weatherState.bundle?.hours[0]);
	const aqi = $derived(europeanAqi(weatherState.bundle?.air?.european_aqi));
	const uv = $derived(uvLevel(hour?.uv ?? weatherState.bundle?.air?.uv_index ?? today?.uvMax));

	const shape = $derived(isDesktop ? 'rounded-md ring-1 ring-border p-4' : 'rounded-3xl p-4');
</script>

{#if current && today}
	<section class="grid grid-cols-2 gap-3 xl:grid-cols-3" aria-label="Kennzahlen">
		<div class="{shape} {scaleFillClass(uv.tone)}">
			<p class="flex items-center gap-2 text-sm opacity-80"><Sun class="size-4 {scaleIconClass(uv.tone)}" /> UV-Index</p>
			<p class="mt-2 text-2xl font-semibold tabular-nums">{hour?.uv?.toFixed(1) ?? today.uvMax?.toFixed(1) ?? '–'}</p>
			<p class="mt-1 text-sm leading-snug opacity-80">{uv.label}{uv.hint ? ` · ${uv.hint}` : ''}</p>
		</div>
		<div class="{shape} {scaleFillClass(aqi.tone)}">
			<p class="flex items-center gap-2 text-sm opacity-80"><Gauge class="size-4 {scaleIconClass(aqi.tone)}" /> Luftqualität</p>
			<p class="mt-2 text-2xl font-semibold tabular-nums">
				{weatherState.bundle?.air?.european_aqi ?? '–'}
			</p>
			<p class="mt-1 text-sm leading-snug opacity-80">{aqi.label}</p>
		</div>
		<div class="{shape} wx-chip-clear">
			<p class="flex items-center gap-2 text-sm opacity-80"><Sunrise class="size-4 wx-icon-sun" /> Sonnenaufgang</p>
			<p class="mt-2 text-2xl font-semibold tabular-nums">{formatTime(today.sunrise)}</p>
			<p class="mt-1 flex items-center gap-2 text-sm opacity-80">
				<Sunset class="size-4 wx-icon-thermo" /> Untergang {formatTime(today.sunset)}
			</p>
		</div>
		<div class="{shape} wx-chip-rain">
			<p class="flex items-center gap-2 text-sm opacity-80"><Droplets class="size-4 wx-icon-drop" /> Regenrisiko</p>
			<p class="mt-2 text-2xl font-semibold tabular-nums">{formatPercent(today.precipProb)}</p>
			<p class="mt-1 text-sm opacity-80">{today.precipMm.toFixed(1)} mm heute</p>
		</div>
		<div class="{shape} wx-chip-fog col-span-2 xl:col-span-1">
			<p class="flex items-center gap-2 text-sm opacity-80"><Eye class="size-4 wx-icon-cloud" /> Druck & Feuchte</p>
			<p class="mt-2 text-2xl font-semibold tabular-nums">{formatHpa(current.pressure_msl)}</p>
			<p class="mt-1 text-sm opacity-80">{formatPercent(current.relative_humidity_2m)} relative Feuchte</p>
		</div>
	</section>
{/if}
