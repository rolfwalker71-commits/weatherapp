<script lang="ts">
	import Droplets from '@lucide/svelte/icons/droplets';
	import Sun from '@lucide/svelte/icons/sun';
	import Thermometer from '@lucide/svelte/icons/thermometer';
	import Wind from '@lucide/svelte/icons/wind';
	import X from '@lucide/svelte/icons/x';
	import { uvLevel } from '$lib/aqi';
	import { chromeState } from '$lib/chrome.svelte';
	import { moodChipClass, scaleFillClass } from '$lib/colors';
	import { formatHour, formatKmH, formatPercent, formatTemp, formatTime } from '$lib/format';
	import type { HourPoint } from '$lib/types';
	import { getWmo, weatherMood } from '$lib/wmo';
	import WeatherIcon from './WeatherIcon.svelte';

	interface Props {
		hour: HourPoint | null;
		onClose: () => void;
	}

	let { hour, onClose }: Props = $props();

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const wmo = $derived(hour ? getWmo(hour.code, hour.isDay) : null);
	const mood = $derived(hour ? weatherMood(hour.code, hour.isDay) : 'cloud');
	const uvTone = $derived(scaleFillClass(uvLevel(hour?.uv).tone));

</script>

{#if hour && wmo}
	<div class="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
		<button
			type="button"
			class="absolute inset-0 bg-black/40 {isDesktop ? 'lg:bg-black/20' : ''}"
			aria-label="Details schliessen"
			onclick={onClose}
		></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="hour-title"
			class="relative z-10 w-full max-w-lg overflow-hidden bg-card p-5 {isDesktop
				? 'rounded-md ring-1 ring-border'
				: 'rounded-t-3xl'}"
		>
			<div class="hero-wash" data-mood={mood} aria-hidden="true"></div>
			<div class="hero-on-{mood} relative">
				{#if !isDesktop}
					<div class="mx-auto mb-4 h-1.5 w-12 rounded-full bg-current/30" aria-hidden="true"></div>
				{/if}
				<div class="mb-4 flex items-start justify-between gap-3">
					<div>
						<p class="text-sm opacity-75">{formatTime(hour.time)}</p>
						<h2 id="hour-title" class="text-xl font-semibold leading-snug">
							{formatHour(hour.time)} Uhr · {wmo.label}
						</h2>
					</div>
					<button type="button" class="icon-btn" onclick={onClose} aria-label="Schliessen">
						<X class="size-5" />
					</button>
				</div>
				<div class="mb-4 flex items-center gap-3">
					<WeatherIcon code={hour.code} isDay={hour.isDay} badge class="size-8" />
					<p class="text-4xl font-semibold tabular-nums">{formatTemp(hour.temperature)}</p>
				</div>
				<dl class="grid grid-cols-2 gap-3">
					<div class="{isDesktop ? 'rounded-md' : 'rounded-3xl'} {moodChipClass('clear')} p-3">
						<dt class="flex items-center gap-2 text-sm opacity-80">
							<Thermometer class="size-4 wx-icon-thermo" /> Gefühlte
						</dt>
						<dd class="font-medium tabular-nums">{formatTemp(hour.feelsLike)}</dd>
					</div>
					<div class="{isDesktop ? 'rounded-md' : 'rounded-3xl'} {moodChipClass('cloud')} p-3">
						<dt class="flex items-center gap-2 text-sm opacity-80">
							<Wind class="size-4 wx-icon-wind" /> Wind
						</dt>
						<dd class="font-medium tabular-nums">{formatKmH(hour.wind)}</dd>
					</div>
					<div class="{isDesktop ? 'rounded-md' : 'rounded-3xl'} {moodChipClass('rain')} p-3">
						<dt class="flex items-center gap-2 text-sm opacity-80">
							<Droplets class="size-4 wx-icon-drop" /> Regen
						</dt>
						<dd class="font-medium tabular-nums">{formatPercent(hour.precipProb)} · {hour.precipMm.toFixed(1)} mm</dd>
					</div>
					<div class="{isDesktop ? 'rounded-md' : 'rounded-3xl'} {uvTone} p-3">
						<dt class="flex items-center gap-2 text-sm opacity-80">
							<Sun class="size-4 wx-icon-sun" /> UV / Feuchte
						</dt>
						<dd class="font-medium tabular-nums">{hour.uv?.toFixed(1) ?? '–'} · {formatPercent(hour.humidity)}</dd>
					</div>
				</dl>
			</div>
		</div>
	</div>
{/if}
