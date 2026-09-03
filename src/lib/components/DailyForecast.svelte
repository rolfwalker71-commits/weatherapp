<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import { moodChipClass } from '$lib/colors';
	import { formatDayMonth, formatPercent, formatTemp, formatWeekday, formatWeekdayLong } from '$lib/format';
	import { panelClass } from '$lib/platform';
	import type { DayPoint } from '$lib/types';
	import { weatherMood } from '$lib/wmo';
	import { weatherState } from '$lib/weather.svelte';
	import WeatherIcon from './WeatherIcon.svelte';

	interface Props {
		selectedDate?: string | null;
		onSelect?: (day: DayPoint) => void;
	}

	let { selectedDate = null, onSelect }: Props = $props();

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const days = $derived(weatherState.bundle?.days ?? []);
	const title = $derived(days.length ? `${days.length}-Tage-Trend` : 'Tages-Trend');
	const min = $derived(Math.min(...days.map((d) => d.tMin)));
	const max = $derived(Math.max(...days.map((d) => d.tMax)));
	const span = $derived(Math.max(1, max - min));

	function left(tMin: number): number {
		return ((tMin - min) / span) * 100;
	}

	function width(tMin: number, tMax: number): number {
		return Math.max(8, ((tMax - tMin) / span) * 100);
	}
</script>

<section id="woche" class="{panelClass(chromeState.chrome)} max-lg:overflow-x-hidden p-5 sm:p-6">
	<h2 class="text-xl font-semibold leading-snug tracking-tight">{title}</h2>
	<p class="mb-4 text-sm text-muted-foreground">Tippen für Stundenverlauf, Minima und Niederschlag</p>

	{#if days.length === 0}
		<p class="text-sm text-muted-foreground">Keine Tagesdaten verfügbar.</p>
	{:else}
	<ul class="space-y-2">
		{#each days as day, index (day.date)}
			{@const mood = weatherMood(day.code, true)}
			{@const selected = selectedDate === day.date || (!selectedDate && index === 0)}
			<li>
				<button
					type="button"
					class="grid w-full min-w-0 max-w-full grid-cols-[4.5rem_2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-left {moodChipClass(
						mood
					)} {isDesktop ? 'rounded-md' : 'rounded-3xl'} {selected
						? 'ring-2 ring-inset ring-primary'
						: ''}"
					aria-pressed={selectedDate === day.date}
					aria-label="{index === 0 ? 'Heute' : formatWeekdayLong(day.date)}, {formatTemp(day.tMin)} bis {formatTemp(
						day.tMax
					)}{day.precipProb != null ? `, Regen ${formatPercent(day.precipProb)}` : ''}, Details öffnen"
					onclick={() => onSelect?.(day)}
				>
					<div class="min-w-0">
						<p class="font-medium leading-snug">{index === 0 ? 'Heute' : formatWeekday(day.date)}</p>
						<p class="text-sm opacity-75">{formatDayMonth(day.date)}</p>
					</div>
					<WeatherIcon code={day.code} class="size-8 justify-self-center" />
					<div class="relative h-2 bg-background/50 {isDesktop ? 'rounded-sm' : 'rounded-full'}">
						<div
							class="absolute top-0 h-2 wx-temp-bar {isDesktop ? 'rounded-sm' : 'rounded-full'}"
							style="left: {left(day.tMin)}%; width: {width(day.tMin, day.tMax)}%;"
						></div>
					</div>
					<div class="text-right tabular-nums">
						<p class="font-medium">{formatTemp(day.tMin)} / {formatTemp(day.tMax)}</p>
						{#if day.precipProb != null}
							<p class="text-sm opacity-75">{formatPercent(day.precipProb)}</p>
						{/if}
					</div>
				</button>
			</li>
		{/each}
	</ul>
	{/if}
</section>
