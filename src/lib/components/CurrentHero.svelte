<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import AppIcon from './AppIcon.svelte';
	import { formatRefreshStatus, formatTemp, placeLabel } from '$lib/format';
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
</script>

{#if current && wmo && bundle}
	<section
		id="jetzt"
		class="{panelClass(chromeState.chrome)} relative overflow-hidden p-5 sm:p-7"
		data-mood={mood}
	>
		<div class="hero-wash" data-mood={mood} aria-hidden="true"></div>
		<div class="hero-on-{mood} relative flex flex-col gap-5">
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0">
					<p class="text-sm opacity-75">
						{formatRefreshStatus(
							bundle.fetchedAt,
							weatherState.stale,
							clockState.now,
							weatherState.error?.startsWith('Offline') ?? false
						)}
					</p>
					<h1 class="mt-1 break-words text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
						{weatherState.place.name}
					</h1>
					<p class="mt-1 break-words text-sm opacity-75">
						{placeLabel(weatherState.place)}
					</p>
				</div>
				<button
					type="button"
					class="icon-btn shrink-0"
					onclick={() => starPlace(weatherState.place)}
					aria-pressed={favored}
					aria-label={favored ? 'Favorit entfernen' : 'Als Favorit speichern'}
				>
					<AppIcon name="star" filled={favored} class="size-5 wx-icon-star" />
				</button>
			</div>

			<div class="flex flex-wrap items-center justify-between gap-4">
				<div class="flex items-end gap-3">
					<p class="font-extrabold leading-none tracking-tight tabular-nums {isDesktop ? 'text-7xl' : 'text-7xl sm:text-8xl'}">
						{formatTemp(current.temperature_2m)}
					</p>
					<div class="mb-2 space-y-1">
						<p class="text-lg font-medium leading-snug">{wmo.label}</p>
						<p class="text-sm opacity-75">
							Gefühlt {formatTemp(current.apparent_temperature)}
						</p>
					</div>
				</div>
				<WeatherIcon
					code={current.weather_code}
					isDay={current.is_day === 1}
					hero
					class={isDesktop
						? 'size-[4.5rem] shrink-0'
						: 'size-[4.5rem] shrink-0 sm:size-[6rem]'}
				/>
			</div>

			{#if insight}
				<p class="text-base font-medium leading-snug">{insight}</p>
			{/if}
			{#if clothing}
				<p class="text-base leading-snug">{clothing}</p>
			{/if}

			{#if today}
				<p class="text-sm opacity-75">
					Heute {formatTemp(today.tMin)} bis {formatTemp(today.tMax)}
				</p>
			{/if}
		</div>
	</section>
{/if}
