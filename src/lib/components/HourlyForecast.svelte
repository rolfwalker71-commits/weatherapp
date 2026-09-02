<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import { moodChipClass } from '$lib/colors';
	import { formatHourLabel, formatPercent, formatTemp } from '$lib/format';
	import { insightLine, snowFrost } from '$lib/insights';
	import { panelClass } from '$lib/platform';
	import type { HourPoint } from '$lib/types';
	import { weatherMood } from '$lib/wmo';
	import { weatherState } from '$lib/weather.svelte';
	import WeatherIcon from './WeatherIcon.svelte';

	interface Props {
		onSelect?: (hour: HourPoint) => void;
	}

	let { onSelect }: Props = $props();

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const hours = $derived(weatherState.bundle?.hours ?? []);
	const line = $derived(weatherState.bundle ? insightLine(weatherState.bundle) : null);
	const frost = $derived(weatherState.bundle ? snowFrost(weatherState.bundle) : null);
	const maxPrecip = $derived(Math.max(1, ...hours.map((h) => h.precipMm)));
</script>

<section id="stunden" class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
	<div class="mb-4 flex items-end justify-between gap-3">
		<div>
			<h2 class="text-xl font-semibold leading-snug tracking-tight">Nächste 24 Stunden</h2>
			{#if line || frost?.snowLabel}
				<p class="text-sm text-muted-foreground">
					{line ?? ''}{line && frost?.snowLabel ? ' · ' : ''}{frost?.snowLabel ?? ''}
				</p>
			{/if}
		</div>
	</div>

	{#if hours.length === 0}
		<p class="text-sm text-muted-foreground">Keine Stundendaten verfügbar.</p>
	{:else}
		<div class="relative">
			<div
				class="flex gap-2 overflow-x-auto px-1 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden"
			>
				{#each hours as hour, index (hour.time)}
					{@const mood = weatherMood(hour.code, hour.isDay)}
					<button
						type="button"
						aria-label="{index === 0
							? 'Jetzt'
							: formatHourLabel(hour.time)}, {formatTemp(hour.temperature)}{hour.precipProb != null
							? `, Regen ${formatPercent(hour.precipProb)}`
							: ''}"
						class="flex w-[4.75rem] shrink-0 flex-col items-center gap-2 px-2 py-3 {moodChipClass(mood)} {isDesktop
							? 'rounded-md'
							: 'rounded-3xl'} {index === 0 ? 'ring-2 ring-inset ring-primary' : ''}"
						onclick={() => onSelect?.(hour)}
					>
						<span class="text-sm tabular-nums opacity-80">{index === 0 ? 'Jetzt' : formatHourLabel(hour.time)}</span>
						<WeatherIcon code={hour.code} isDay={hour.isDay} class="size-8" />
						<span class="text-base font-bold tabular-nums">{formatTemp(hour.temperature)}</span>
						<span
							class="flex h-8 w-1.5 items-end overflow-hidden {isDesktop ? 'rounded-sm' : 'rounded-full'} bg-background/50"
							aria-hidden="true"
						>
							<span
								class="block w-full wx-bar-rain"
								style="height: {Math.max(8, (hour.precipMm / maxPrecip) * 100)}%;"
							></span>
						</span>
						{#if hour.precipProb != null}
							<span class="text-xs opacity-75 tabular-nums">{formatPercent(hour.precipProb)}</span>
						{/if}
					</button>
				{/each}
			</div>
			<div
				class="pointer-events-none absolute inset-y-1 right-0 w-7 bg-gradient-to-l from-card"
				aria-hidden="true"
			></div>
		</div>
	{/if}
</section>
