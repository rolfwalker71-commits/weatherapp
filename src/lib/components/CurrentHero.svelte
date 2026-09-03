<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import AppIcon from './AppIcon.svelte';
	import { formatRefreshStatus, formatStationLine, formatTemp, placeLabel } from '$lib/format';
	import { clothingLine, insightLine } from '$lib/insights';
	import { panelClass } from '$lib/platform';
	import { getWmo, weatherMood } from '$lib/wmo';
	import { clockState, isFavorite, starPlace, weatherState } from '$lib/weather.svelte';
	import WeatherIcon from './WeatherIcon.svelte';

	const bundle = $derived(weatherState.bundle);
	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const current = $derived(bundle?.current);
	const wmo = $derived(current ? getWmo(current.weather_code, current.is_day === 1) : null);
	const mood = $derived(
		current ? weatherMood(current.weather_code, current.is_day === 1) : 'cloud'
	);
	const today = $derived(bundle?.days[0]);
	const insight = $derived(bundle ? insightLine(bundle) : null);
	const clothing = $derived(bundle ? clothingLine(bundle) : null);
	const favored = $derived(isFavorite(weatherState.place));
	const station = $derived(bundle?.station ?? null);
	const stationLine = $derived(
		station ? formatStationLine(station, bundle?.timezone) : null
	);
</script>

{#if current && wmo && bundle}
	<section
		id="jetzt"
		class="{panelClass(chromeState.chrome)} hero-on-{mood} relative overflow-hidden p-5 sm:p-6"
		data-mood={mood}
	>
		<div class="hero-wash" data-mood={mood} aria-hidden="true"></div>
		<div class="hero-stack">
			<div class="flex items-start justify-between gap-3">
				<div class="hero-place min-w-0">
					<p class="text-sm leading-snug opacity-75">
						{formatRefreshStatus(
							bundle.fetchedAt,
							weatherState.stale,
							clockState.now,
							weatherState.error?.startsWith('Offline') ?? false
						)}
					</p>
					<h1 class="mt-0.5 break-words text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
						{weatherState.place.name}
					</h1>
					<p class="mt-0.5 break-words text-sm leading-snug opacity-75">
						{placeLabel(weatherState.place)}
					</p>
				</div>
				<WeatherIcon
					code={current.weather_code}
					isDay={current.is_day === 1}
					hero
					class="hero-weather shrink-0 {isDesktop
						? 'size-[4.25rem]'
						: 'size-[4.25rem] sm:size-[5.5rem]'}"
				/>
			</div>

			<div class="flex items-center gap-2.5 sm:gap-3">
				<p
					class="shrink-0 font-extrabold leading-none tracking-tight tabular-nums {isDesktop
						? 'text-[4.375rem]'
						: 'text-[4.375rem] sm:text-[5.875rem]'}"
				>
					{formatTemp(current.temperature_2m)}
				</p>
				<div class="min-w-0 shrink">
					<p class="truncate whitespace-nowrap text-[1.1875rem] font-medium leading-snug">
						{wmo.label}
					</p>
					<p class="whitespace-nowrap text-[0.8125rem] leading-snug opacity-75">
						Gefühlt {formatTemp(current.apparent_temperature)}
					</p>
				</div>
			</div>

			{#if stationLine || insight || clothing}
				<div class="hero-meta">
					{#if stationLine}
						<p class="break-words text-sm leading-snug opacity-75">{stationLine}</p>
					{/if}
					{#if insight}
						<p class="text-base font-medium leading-snug">{insight}</p>
					{/if}
					{#if clothing}
						<p class="text-base leading-snug">{clothing}</p>
					{/if}
				</div>
			{/if}

			<div class="flex items-end justify-between gap-3">
				{#if today}
					<p class="hero-range min-w-0 text-sm leading-snug opacity-75">
						Heute {formatTemp(today.tMin)} bis {formatTemp(today.tMax)}
					</p>
				{/if}
				<button
					type="button"
					class="hero-fav ml-auto"
					onclick={() => starPlace(weatherState.place)}
					aria-pressed={favored}
					aria-label={favored ? 'Favorit entfernen' : 'Als Favorit speichern'}
				>
					<AppIcon name="star" filled={favored} class="hero-fav-glyph wx-icon-star" />
				</button>
			</div>
		</div>
	</section>
{/if}
