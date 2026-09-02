<script lang="ts">
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
	import { searchPlaces } from '$lib/api';
	import { chromeState } from '$lib/chrome.svelte';
	import { commuteState, loadCommute, setCommuteDestination } from '$lib/commute.svelte';
	import { formatTemp } from '$lib/format';
	import { commuteHint } from '$lib/lifestyle';
	import { panelClass } from '$lib/platform';
	import { samePlace } from '$lib/storage';
	import type { Place } from '$lib/types';
	import { weatherState } from '$lib/weather.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	let query = $state('');
	let results = $state<Place[]>([]);
	const hint = $derived(
		weatherState.bundle && commuteState.bundle
			? commuteHint(weatherState.bundle, commuteState.bundle)
			: ''
	);

	$effect(() => {
		weatherState.place.latitude;
		weatherState.place.longitude;
		if (commuteState.destination) void loadCommute(weatherState.place);
	});

	async function onInput(event: Event) {
		query = (event.target as HTMLInputElement).value;
		if (query.trim().length < 2) {
			results = [];
			return;
		}
		try {
			results = await searchPlaces(query);
		} catch {
			results = [];
		}
	}

	function choose(place: Place) {
		setCommuteDestination(place);
		query = '';
		results = [];
		void loadCommute(weatherState.place);
	}

	function pickFavorite(place: Place) {
		if (samePlace(place, weatherState.place)) return;
		choose(place);
	}
</script>

<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
	<h2 class="flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
		<ArrowLeftRight class="size-5 wx-icon-week" /> Pendeln
	</h2>
	<p class="mb-3 text-sm text-muted-foreground">Wetter am Start und am Ziel — Favoriten oder Suche</p>

	{#if weatherState.favorites.length}
		<div class="mb-3 flex flex-wrap gap-2">
			{#each weatherState.favorites as place (place.id ?? `${place.latitude}-${place.longitude}`)}
				<button
					type="button"
					class="min-h-10 px-3 text-sm {isDesktop ? 'rounded-md' : 'rounded-full'} {commuteState.destination &&
					samePlace(place, commuteState.destination)
						? 'wx-chip-clear'
						: 'bg-muted'}"
					onclick={() => pickFavorite(place)}
				>
					{place.name}
				</button>
			{/each}
		</div>
	{/if}

	<label class="sr-only" for="commute-search">Pendenziel suchen</label>
	<input
		id="commute-search"
		type="search"
		value={query}
		placeholder="Zielort suchen"
		class="h-12 w-full bg-muted px-4 text-base outline-none {isDesktop ? 'rounded-md' : 'rounded-full'}"
		oninput={onInput}
	/>
	{#if results.length}
		<ul class="mt-2 overflow-hidden {isDesktop ? 'rounded-md ring-1 ring-border' : 'rounded-3xl'} bg-card">
			{#each results as place (place.id ?? `${place.latitude}-${place.longitude}`)}
				<li>
					<button
						type="button"
						class="min-h-12 w-full px-4 py-3 text-left hover:bg-muted"
						onclick={() => choose(place)}
					>
						{place.name}
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if commuteState.destination && weatherState.bundle}
		<div class="mt-4 grid grid-cols-2 gap-3">
			<div class="{isDesktop ? 'rounded-md ring-1 ring-border p-3' : 'rounded-[1.25rem] bg-muted p-3'}">
				<p class="text-sm opacity-75">Start</p>
				<p class="font-medium leading-snug">{weatherState.place.name}</p>
				<p class="tabular-nums">{formatTemp(weatherState.bundle.current.temperature_2m)}</p>
			</div>
			<div class="{isDesktop ? 'rounded-md ring-1 ring-border p-3' : 'rounded-[1.25rem] bg-muted p-3'}">
				<p class="text-sm opacity-75">Ziel</p>
				<p class="font-medium leading-snug">{commuteState.destination.name}</p>
				<p class="tabular-nums">
					{commuteState.bundle ? formatTemp(commuteState.bundle.current.temperature_2m) : commuteState.loading ? '…' : '–'}
				</p>
			</div>
		</div>
		{#if hint}
			<p class="mt-3 text-sm leading-snug">{hint}</p>
		{/if}
		<button
			type="button"
			class="mt-3 min-h-10 text-sm text-primary"
			onclick={() => {
				setCommuteDestination(null);
				commuteState.bundle = null;
			}}
		>
			Ziel entfernen
		</button>
	{/if}
	{#if commuteState.error}
		<p class="mt-2 text-sm text-muted-foreground" role="status">{commuteState.error}</p>
	{/if}
</section>
