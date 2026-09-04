<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import { moodChipClass } from '$lib/colors';
	import { formatHourLabel, formatPercent, formatTemp } from '$lib/format';
	import { insightLine, snowFrost } from '$lib/insights';
	import { panelClass } from '$lib/platform';
	import type { HourPoint } from '$lib/types';
	import { weatherMood } from '$lib/wmo';
	import { weatherState } from '$lib/weather.svelte';
	import HScroll from './HScroll.svelte';
	import WeatherIcon from './WeatherIcon.svelte';

	interface Props {
		onSelect?: (hour: HourPoint) => void;
		embedded?: boolean;
		/** Cap visible hours (e.g. 4 on Jetzt). Omit for full 24h strip. */
		limit?: number;
	}

	let { onSelect, embedded = false, limit }: Props = $props();

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const allHours = $derived(weatherState.bundle?.hours ?? []);
	const hours = $derived(limit != null ? allHours.slice(0, limit) : allHours);
	const compact = $derived(limit != null && limit <= 4);
	const line = $derived(weatherState.bundle ? insightLine(weatherState.bundle) : null);
	const frost = $derived(weatherState.bundle ? snowFrost(weatherState.bundle) : null);
	const maxPrecip = $derived(Math.max(1, ...hours.map((h) => h.precipMm)));
	const title = $derived(
		embedded ? '24 Stunden' : compact ? 'Nächste 4 Stunden' : 'Nächste 24 Stunden'
	);
</script>

<section
	id={embedded ? 'stunden' : undefined}
	class="{panelClass(chromeState.chrome)} max-lg:overflow-x-hidden p-5 sm:p-6"
	aria-labelledby="hourly-title"
>
	<div class="mb-4 flex min-w-0 items-end justify-between gap-3">
		<div class="min-w-0">
			<h2 id="hourly-title" class="text-xl font-semibold leading-snug tracking-tight">
				{title}
			</h2>
			{#if !embedded && (line || frost?.snowLabel)}
				<p class="text-sm text-muted-foreground">
					{line ?? ''}{line && frost?.snowLabel ? ' · ' : ''}{frost?.snowLabel ?? ''}
				</p>
			{/if}
		</div>
	</div>

	{#if hours.length === 0}
		<p class="text-sm text-muted-foreground">Keine Stundendaten verfügbar.</p>
	{:else if compact}
		<div
			class="grid w-full gap-1.5 sm:gap-2"
			style="grid-template-columns: repeat({hours.length}, minmax(0, 1fr));"
			role="list"
		>
			{#each hours as hour, index (hour.time)}
				{@const mood = weatherMood(hour.code, hour.isDay)}
				<button
					type="button"
					role="listitem"
					aria-label="{index === 0
						? 'Jetzt'
						: formatHourLabel(hour.time)}, {formatTemp(hour.temperature)}{hour.precipProb != null
						? `, Regen ${formatPercent(hour.precipProb)}`
						: ''}"
					class="flex min-w-0 w-full flex-col items-center gap-1.5 px-1 py-2.5 sm:gap-2 sm:px-2 sm:py-3 {moodChipClass(
						mood
					)} {isDesktop ? 'rounded-md' : 'rounded-3xl'} {index === 0
						? 'ring-2 ring-inset ring-primary'
						: ''}"
					onclick={() => onSelect?.(hour)}
				>
					<span class="text-xs tabular-nums opacity-80 sm:text-sm"
						>{index === 0 ? 'Jetzt' : formatHourLabel(hour.time)}</span
					>
					<WeatherIcon code={hour.code} isDay={hour.isDay} class="size-7 sm:size-8" />
					<span class="text-sm font-bold tabular-nums sm:text-base">{formatTemp(hour.temperature)}</span>
					<span
						class="flex h-7 w-1.5 items-end overflow-hidden sm:h-8 {isDesktop
							? 'rounded-sm'
							: 'rounded-full'} bg-background/50"
						aria-hidden="true"
					>
						<span
							class="block w-full wx-bar-rain"
							style="height: {Math.max(8, (hour.precipMm / maxPrecip) * 100)}%;"
						></span>
					</span>
					{#if hour.precipProb != null}
						<span class="text-[0.65rem] opacity-75 tabular-nums sm:text-xs"
							>{formatPercent(hour.precipProb)}</span
						>
					{/if}
				</button>
			{/each}
		</div>
	{:else}
		<HScroll
			fade
			gap="gap-[var(--hourly-gap)]"
			scrollerClass="snap-x snap-mandatory py-1 [--hourly-gap:0.375rem] sm:[--hourly-gap:0.5rem]"
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
					class="flex min-w-0 shrink-0 snap-start flex-col items-center gap-2 px-1 py-2.5 sm:gap-2 sm:px-2 sm:py-3 {moodChipClass(
						mood
					)} {isDesktop ? 'rounded-md' : 'rounded-3xl'} {index === 0
						? 'ring-2 ring-inset ring-primary'
						: ''}"
					style="flex: 0 0 calc((100% - 3 * var(--hourly-gap)) / 4)"
					onclick={() => onSelect?.(hour)}
				>
					<span class="text-sm tabular-nums opacity-80"
						>{index === 0 ? 'Jetzt' : formatHourLabel(hour.time)}</span
					>
					<WeatherIcon code={hour.code} isDay={hour.isDay} class="size-8" />
					<span class="text-base font-bold tabular-nums">{formatTemp(hour.temperature)}</span>
					<span
						class="flex h-8 w-1.5 items-end overflow-hidden {isDesktop
							? 'rounded-sm'
							: 'rounded-full'} bg-background/50"
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
		</HScroll>
	{/if}
</section>
