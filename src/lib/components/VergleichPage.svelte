<script lang="ts">
	import { fetchWeatherHero } from '$lib/api';
	import { chromeState } from '$lib/chrome.svelte';
	import { formatSourceLine, formatTemp } from '$lib/format';
	import { nextPrecipLine } from '$lib/insights';
	import { panelClass } from '$lib/platform';
	import { samePlace } from '$lib/storage';
	import type { Place, WeatherBundle } from '$lib/types';
	import { goSection } from '$lib/ui.svelte';
	import { getWmo } from '$lib/wmo';
	import { loadPlace, weatherState } from '$lib/weather.svelte';
	import CitySearch from './CitySearch.svelte';
	import WeatherIcon from './WeatherIcon.svelte';

	interface Slot {
		place: Place | null;
		bundle: WeatherBundle | null;
		error: string | null;
		loading: boolean;
	}

	const favorites = $derived(weatherState.favorites);
	let left = $state<Slot>({ place: null, bundle: null, error: null, loading: false });
	let right = $state<Slot>({ place: null, bundle: null, error: null, loading: false });
	const flights = new Map<string, AbortController>();

	$effect(() => {
		if (!left.place && weatherState.place) {
			void setSlot('left', weatherState.place);
		}
	});

	$effect(() => {
		if (right.place) return;
		const other = favorites.find((item) => !samePlace(item, weatherState.place));
		if (other) void setSlot('right', other);
	});

	async function setSlot(side: 'left' | 'right', place: Place) {
		const key = `${side}:${place.latitude},${place.longitude}`;
		flights.get(key)?.abort();
		const controller = new AbortController();
		flights.set(key, controller);
		const next: Slot = { place, bundle: null, error: null, loading: true };
		if (side === 'left') left = next;
		else right = next;
		try {
			const bundle = await fetchWeatherHero(place, controller.signal);
			if (controller.signal.aborted) return;
			const done: Slot = { place, bundle, error: null, loading: false };
			if (side === 'left') left = done;
			else right = done;
		} catch (error) {
			if ((error as Error).name === 'AbortError') return;
			const fail: Slot = {
				place,
				bundle: null,
				error: 'Wetterdaten konnten nicht geladen werden.',
				loading: false
			};
			if (side === 'left') left = fail;
			else right = fail;
		}
	}

	function openJetzt(place: Place) {
		void loadPlace(place, { recent: false });
		goSection('jetzt');
	}
</script>

{#snippet column(slot: Slot, side: 'left' | 'right', title: string)}
	<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
		<h2 class="mb-3 text-lg font-semibold leading-snug tracking-tight">{title}</h2>
		<CitySearch
			id="vergleich-{side}"
			placeholder="Ort suchen"
			hotkey={false}
			onSelect={(place) => void setSlot(side, place)}
		/>
		{#if favorites.length}
			<div class="mt-3 flex flex-wrap gap-2">
				{#each favorites as fav (fav.id ?? `${fav.latitude}-${fav.longitude}`)}
					<button
						type="button"
						class="min-h-10 px-3 text-sm {chromeState.chrome === 'desktop'
							? 'rounded-md bg-muted'
							: 'rounded-full bg-muted'}"
						onclick={() => void setSlot(side, fav)}
					>
						{fav.name}
					</button>
				{/each}
			</div>
		{/if}

		{#if slot.place && slot.bundle}
			{@const current = slot.bundle.current}
			{@const wmo = getWmo(current.weather_code, current.is_day === 1)}
			{@const rain = nextPrecipLine(slot.bundle)}
			{@const source = formatSourceLine(slot.bundle.station, slot.bundle.timezone)}
			<button
				type="button"
				class="mt-5 w-full text-left"
				onclick={() => openJetzt(slot.place!)}
			>
				<p class="break-words text-xl font-semibold leading-snug tracking-tight">{slot.place.name}</p>
				<div class="mt-3 flex items-center gap-3">
					<p class="text-4xl font-extrabold tabular-nums">{formatTemp(current.temperature_2m)}</p>
					<WeatherIcon
						code={current.weather_code}
						isDay={current.is_day === 1}
						class="size-12 shrink-0"
					/>
				</div>
				<p class="mt-1 text-base leading-snug">{wmo.label}</p>
				{#if slot.bundle.station}
					<p class="mt-2 text-sm leading-snug text-muted-foreground">
						Station {slot.bundle.station.id}
						{#if slot.bundle.station.name}
							· {slot.bundle.station.name}
						{/if}
					</p>
				{/if}
				{#if rain}
					<p class="mt-1 text-sm leading-snug">{rain}</p>
				{/if}
				<p class="mt-2 text-sm text-muted-foreground">{source}</p>
				<p class="mt-3 text-sm text-primary">Jetzt öffnen</p>
			</button>
		{:else if slot.loading}
			<p class="mt-5 text-sm text-muted-foreground">Wetter wird geladen…</p>
		{:else if slot.error}
			<p class="mt-5 text-sm text-muted-foreground">{slot.error}</p>
		{:else}
			<p class="mt-5 text-sm text-muted-foreground">Ort wählen — Favorit oder Suche.</p>
		{/if}
	</section>
{/snippet}

<section aria-labelledby="vergleich-title">
	<h1 id="vergleich-title" class="mb-4 text-2xl font-semibold leading-snug tracking-tight">
		Vergleich
	</h1>
	<div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
		{@render column(left, 'left', 'Ort A')}
		{@render column(right, 'right', 'Ort B')}
	</div>
</section>
