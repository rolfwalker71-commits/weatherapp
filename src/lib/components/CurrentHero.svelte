<script lang="ts">
	import Droplets from '@lucide/svelte/icons/droplets';
	import Star from '@lucide/svelte/icons/star';
	import Wind from '@lucide/svelte/icons/wind';
	import { chromeState } from '$lib/chrome.svelte';
	import { formatKmH, formatPercent, formatRefreshStatus, formatTemp, placeLabel, windDirection } from '$lib/format';
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
	const favored = $derived(isFavorite(weatherState.place));
	const tile = $derived(isDesktop ? 'rounded-md ring-1 ring-border' : 'rounded-3xl');
</script>

{#if current && wmo && bundle}
	<section
		id="aktuell"
		class="{panelClass(chromeState.chrome)} relative overflow-hidden p-5 sm:p-7"
		data-mood={mood}
	>
		<div class="hero-wash" data-mood={mood} aria-hidden="true"></div>
		<div class="hero-on-{mood} relative flex flex-col gap-6">
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0">
					<p class="text-sm opacity-75">
						{bundle.timezone.replace('_', ' ')}
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
					<Star class="size-5 wx-icon-star {favored ? 'fill-current' : ''}" />
				</button>
			</div>

			<div class="flex flex-wrap items-end justify-between gap-4">
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
					badge
					class={isDesktop ? 'size-10' : 'size-12'}
				/>
			</div>

			<p class="text-sm opacity-75">
				{#if today}
					Heute {formatTemp(today.tMin)} bis {formatTemp(today.tMax)} ·
				{/if}
				{formatRefreshStatus(
					bundle.fetchedAt,
					weatherState.stale,
					clockState.now,
					weatherState.error?.startsWith('Offline') ?? false
				)}
			</p>

			<dl class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				<div class="{tile} wx-chip-cloud p-4">
					<dt class="flex items-center gap-2 text-sm opacity-80">
						<Wind class="size-4 wx-icon-wind" /> Wind
					</dt>
					<dd class="mt-1 text-lg font-medium tabular-nums">
						{formatKmH(current.wind_speed_10m)}
						<span class="text-sm font-normal opacity-75">
							{windDirection(current.wind_direction_10m)}
						</span>
					</dd>
					<p class="text-sm opacity-75">Böen {formatKmH(current.wind_gusts_10m)}</p>
				</div>
				<div class="{tile} wx-chip-rain p-4">
					<dt class="flex items-center gap-2 text-sm opacity-80">
						<Droplets class="size-4 wx-icon-drop" /> Luftfeuchtigkeit
					</dt>
					<dd class="mt-1 text-lg font-medium tabular-nums">{formatPercent(current.relative_humidity_2m)}</dd>
					<p class="text-sm opacity-75">Niederschlag {current.precipitation.toFixed(1)} mm</p>
				</div>
				<div class="{tile} wx-chip-fog col-span-2 p-4 sm:col-span-1">
					<dt class="text-sm opacity-80">Luftdruck · Bewölkung</dt>
					<dd class="mt-1 text-lg font-medium tabular-nums">{Math.round(current.pressure_msl)} hPa</dd>
					<p class="text-sm opacity-75">{Math.round(current.cloud_cover)} % bedeckt</p>
				</div>
			</dl>
		</div>
	</section>
{/if}
