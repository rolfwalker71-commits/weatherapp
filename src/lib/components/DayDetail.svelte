<script lang="ts">
	import Droplets from '@lucide/svelte/icons/droplets';
	import Sun from '@lucide/svelte/icons/sun';
	import Sunrise from '@lucide/svelte/icons/sunrise';
	import Wind from '@lucide/svelte/icons/wind';
	import X from '@lucide/svelte/icons/x';
	import { uvLevel } from '$lib/aqi';
	import { chromeState } from '$lib/chrome.svelte';
	import { moodChipClass, scaleFillClass } from '$lib/colors';
	import {
		formatDayMonth,
		formatHour,
		formatKmH,
		formatMm,
		formatPercent,
		formatTemp,
		formatTime,
		formatWeekday,
		formatWeekdayLong,
		hoursOnDay
	} from '$lib/format';
	import type { DayPoint, HourPoint } from '$lib/types';
	import { getWmo, weatherMood } from '$lib/wmo';
	import { weatherState } from '$lib/weather.svelte';
	import WeatherIcon from './WeatherIcon.svelte';

	interface Props {
		day: DayPoint | null;
		onClose: () => void;
		onSelectDay: (day: DayPoint) => void;
		onSelectHour: (hour: HourPoint) => void;
	}

	let { day, onClose, onSelectDay, onSelectHour }: Props = $props();

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const days = $derived(weatherState.bundle?.days ?? []);
	const weekHours = $derived(weatherState.bundle?.allHours ?? weatherState.bundle?.hours ?? []);
	const dayHours = $derived(day ? hoursOnDay(weekHours, day.date) : []);
	const maxPrecip = $derived(Math.max(1, ...dayHours.map((hour) => hour.precipMm)));
	const wmo = $derived(day ? getWmo(day.code, true) : null);
	const mood = $derived(day ? weatherMood(day.code, true) : 'cloud');
	const uvTone = $derived(scaleFillClass(uvLevel(day?.uvMax).tone));
	const now = $derived(weatherState.bundle ? new Date(weatherState.bundle.current.time).getTime() : Date.now());
	const todayDate = $derived(weatherState.bundle?.days[0]?.date);

	function dayLabel(item: DayPoint, index: number): string {
		if (index === 0 || item.date === todayDate) return 'Heute';
		return formatWeekday(item.date);
	}

	function isPastHour(hour: HourPoint): boolean {
		return new Date(hour.time).getTime() + 60 * 60 * 1000 <= now;
	}
</script>

{#if day && wmo}
	<div class="fixed inset-0 z-40 flex items-end justify-center lg:items-center">
		<button
			type="button"
			class="absolute inset-0 bg-black/40 {isDesktop ? 'lg:bg-black/20' : ''}"
			aria-label="Tagesdetails schliessen"
			onclick={onClose}
		></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="day-title"
			class="relative z-10 flex max-h-[min(42rem,92dvh)] w-full max-w-lg flex-col overflow-hidden bg-card {isDesktop
				? 'rounded-md ring-1 ring-border'
				: 'rounded-t-3xl'}"
		>
			<div class="hero-wash" data-mood={mood} aria-hidden="true"></div>
			<div class="hero-on-{mood} relative flex min-h-0 flex-col overflow-y-auto p-5">
				{#if !isDesktop}
					<div class="mx-auto mb-4 h-1.5 w-12 rounded-full bg-current/30" aria-hidden="true"></div>
				{/if}
				<div class="mb-4 flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="text-sm opacity-75">{formatDayMonth(day.date)}</p>
						<h2 id="day-title" class="break-words text-xl font-semibold leading-snug">
							{day.date === todayDate ? 'Heute' : formatWeekdayLong(day.date)} · {wmo.label}
						</h2>
					</div>
					<button type="button" class="icon-btn shrink-0" onclick={onClose} aria-label="Schliessen">
						<X class="size-5" />
					</button>
				</div>

				<div
					class="relative mb-4"
					aria-label="Tag wählen"
				>
					<div
						class="flex gap-2 overflow-x-auto px-0.5 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden"
					>
						{#each days as item, index (item.date)}
							<button
								type="button"
								aria-pressed={item.date === day.date}
								class="h-10 min-h-10 shrink-0 px-3 text-sm leading-none {isDesktop
									? 'rounded-md'
									: 'rounded-full'} {item.date === day.date
									? isDesktop
										? 'bg-primary/10 text-primary'
										: 'bg-secondary text-primary'
									: 'bg-muted text-muted-foreground'}"
								onclick={() => onSelectDay(item)}
							>
								{dayLabel(item, index)}
							</button>
						{/each}
					</div>
				</div>

				<div class="mb-4 flex items-center gap-3">
					<WeatherIcon code={day.code} badge class="size-8" />
					<p class="text-4xl font-extrabold tabular-nums">{formatTemp(day.tMin)} / {formatTemp(day.tMax)}</p>
				</div>

				<dl class="mb-5 grid grid-cols-2 gap-3">
					<div class="{isDesktop ? 'rounded-md' : 'rounded-3xl'} {moodChipClass('rain')} p-3">
						<dt class="flex items-center gap-2 text-sm opacity-80">
							<Droplets class="size-4 wx-icon-drop" /> Niederschlag
						</dt>
						<dd class="font-medium tabular-nums">{formatPercent(day.precipProb)} · {formatMm(day.precipMm)}</dd>
					</div>
					<div class="{isDesktop ? 'rounded-md' : 'rounded-3xl'} {moodChipClass('cloud')} p-3">
						<dt class="flex items-center gap-2 text-sm opacity-80">
							<Wind class="size-4 wx-icon-wind" /> Wind max
						</dt>
						<dd class="font-medium tabular-nums">{formatKmH(day.windMax)}</dd>
					</div>
					<div class="{isDesktop ? 'rounded-md' : 'rounded-3xl'} {uvTone} p-3">
						<dt class="flex items-center gap-2 text-sm opacity-80">
							<Sun class="size-4 wx-icon-sun" /> UV-Index
						</dt>
						<dd class="font-medium tabular-nums">{day.uvMax?.toFixed(1) ?? '–'}</dd>
					</div>
					<div class="{isDesktop ? 'rounded-md' : 'rounded-3xl'} {moodChipClass('clear')} p-3">
						<dt class="flex items-center gap-2 text-sm opacity-80">
							<Sunrise class="size-4 wx-icon-sun" /> Sonne
						</dt>
						<dd class="font-medium tabular-nums">{formatTime(day.sunrise)} – {formatTime(day.sunset)}</dd>
					</div>
				</dl>

				<h3 class="mb-2 text-sm font-medium">Stundenverlauf</h3>
				{#if dayHours.length === 0}
					<p class="text-sm opacity-75">Stundenverlauf nach der nächsten Aktualisierung verfügbar.</p>
				{:else}
					<div class="relative">
						<div
							class="flex gap-2 overflow-x-auto px-1 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden"
						>
							{#each dayHours as hour (hour.time)}
								{@const hourMood = weatherMood(hour.code, hour.isDay)}
								<button
									type="button"
									aria-label="{formatHour(hour.time)} Uhr, {formatTemp(hour.temperature)}, Regen {formatPercent(hour.precipProb)}"
									class="flex w-[4.5rem] shrink-0 flex-col items-center gap-2 px-2 py-3 {moodChipClass(
										hourMood
									)} {isDesktop ? 'rounded-md' : 'rounded-3xl'} {isPastHour(hour) ? 'opacity-55' : ''}"
									onclick={() => onSelectHour(hour)}
								>
									<span class="text-sm tabular-nums opacity-80">{formatHour(hour.time)}</span>
									<WeatherIcon code={hour.code} isDay={hour.isDay} class="size-6" />
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
									<span class="text-xs opacity-75 tabular-nums">{formatPercent(hour.precipProb)}</span>
								</button>
							{/each}
						</div>
						<div
							class="pointer-events-none absolute inset-y-1 right-0 w-6 bg-gradient-to-l from-card"
							aria-hidden="true"
						></div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
