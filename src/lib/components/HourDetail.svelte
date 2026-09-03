<script lang="ts">
	import { uvLevel } from '$lib/aqi';
	import { chromeState } from '$lib/chrome.svelte';
	import { moodChipClass, scaleFillClass } from '$lib/colors';
	import { formatPercent, formatTemp, formatTime, formatWind } from '$lib/format';
	import { unitsState } from '$lib/units.svelte';
	import type { HourPoint } from '$lib/types';
	import { getWmo, weatherMood } from '$lib/wmo';
	import AppIcon from './AppIcon.svelte';
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
	<div class="wx-overlay wx-overlay--hour">
		<button
			type="button"
			class="wx-sheet-backdrop"
			aria-label="Details schliessen"
			onclick={onClose}
		></button>
		<div role="dialog" aria-modal="true" aria-labelledby="hour-title" class="wx-sheet">
			<div class="hero-wash" data-mood={mood} aria-hidden="true"></div>
			<div class="hero-on-{mood} relative flex min-h-0 flex-1 flex-col">
				<div class="wx-sheet-head px-5 pt-5">
					{#if !isDesktop}
						<div class="mx-auto mb-4 h-1.5 w-12 rounded-full bg-current/30" aria-hidden="true"></div>
					{/if}
					<div class="mb-4 flex items-start justify-between gap-3">
						<div class="min-w-0">
							<h2 id="hour-title" class="break-words text-xl font-semibold leading-snug">
								{formatTime(hour.time)} · {wmo.label}
							</h2>
						</div>
						<button type="button" class="icon-btn shrink-0" onclick={onClose} aria-label="Schliessen">
							<AppIcon name="close" class="size-5" />
						</button>
					</div>
				</div>
				<div class="wx-sheet-body px-5 pb-5">
					<div class="mb-4 flex items-center gap-3">
						<WeatherIcon code={hour.code} isDay={hour.isDay} badge class="size-14" />
						<p class="text-4xl font-semibold tabular-nums">{formatTemp(hour.temperature)}</p>
					</div>
					<dl class="grid grid-cols-2 gap-3">
						<div class="{isDesktop ? 'rounded-md' : 'rounded-3xl'} {moodChipClass('clear')} p-3">
							<dt class="flex items-center gap-2 text-sm opacity-80">
								<AppIcon name="thermo" class="size-4 wx-icon-thermo" /> Gefühlte
							</dt>
							<dd class="font-medium tabular-nums">{formatTemp(hour.feelsLike)}</dd>
						</div>
						<div class="{isDesktop ? 'rounded-md' : 'rounded-3xl'} {moodChipClass('cloud')} p-3">
							<dt class="flex items-center gap-2 text-sm opacity-80">
								<AppIcon name="wind" class="size-4 wx-icon-wind" /> Wind
							</dt>
							<dd class="font-medium tabular-nums">{formatWind(hour.wind, unitsState.wind)}</dd>
						</div>
						<div class="{isDesktop ? 'rounded-md' : 'rounded-3xl'} {moodChipClass('rain')} p-3">
							<dt class="flex items-center gap-2 text-sm opacity-80">
								<AppIcon name="drop" class="size-4 wx-icon-drop" /> Regen
							</dt>
							<dd class="font-medium tabular-nums">
								{#if hour.precipProb != null}{formatPercent(hour.precipProb)} · {/if}{hour.precipMm.toFixed(1)} mm
							</dd>
						</div>
						<div class="{isDesktop ? 'rounded-md' : 'rounded-3xl'} {moodChipClass('fog')} p-3">
							<dt class="flex items-center gap-2 text-sm opacity-80">
								<AppIcon name="drop" class="size-4 wx-icon-sun" /> Feuchte
							</dt>
							<dd class="font-medium tabular-nums">{formatPercent(hour.humidity)}</dd>
						</div>
						{#if hour.uv != null}
							<div class="{isDesktop ? 'rounded-md' : 'rounded-3xl'} {uvTone} p-3">
								<dt class="flex items-center gap-2 text-sm opacity-80">
									<AppIcon name="sun" class="size-4 wx-icon-sun" /> UV-Index
								</dt>
								<dd class="font-medium tabular-nums">{hour.uv.toFixed(1)}</dd>
							</div>
						{/if}
					</dl>
				</div>
			</div>
		</div>
	</div>
{/if}
