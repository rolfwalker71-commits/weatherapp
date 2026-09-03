<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import { panelClass } from '$lib/platform';
	import { goSection } from '$lib/ui.svelte';
	import {
		favoriteKey,
		favoriteWeather,
		loadFavoriteHeroes,
		loadPlace,
		weatherState
	} from '$lib/weather.svelte';
	import AppIcon from './AppIcon.svelte';
	import CurrentHero from './CurrentHero.svelte';
	import HScroll from './HScroll.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const places = $derived(weatherState.favorites);

	$effect(() => {
		places.length;
		weatherState.section;
		if (weatherState.section === 'favoriten') {
			void loadFavoriteHeroes();
		}
	});

	function openJetzt(place: (typeof places)[number]) {
		void loadPlace(place, { recent: false });
		goSection('jetzt');
	}
</script>

<section aria-labelledby="favoriten-title">
	<h1 id="favoriten-title" class="mb-4 text-2xl font-semibold leading-snug tracking-tight">
		Favoriten
	</h1>

	{#if places.length === 0}
		<div class="{panelClass(chromeState.chrome)} p-6 sm:p-8">
			<div class="flex items-start gap-4">
				<span
					class="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted [html[data-chrome=desktop]_&]:rounded-md"
				>
					<AppIcon name="star" class="size-6 wx-icon-star" />
				</span>
				<div class="min-w-0">
					<p class="text-lg font-semibold leading-snug tracking-tight">Keine Favoriten</p>
					<p class="mt-2 text-base leading-snug text-muted-foreground">
						Noch keine Orte gespeichert. Öffne Jetzt und tippe auf den Stern unten rechts in der
						Hauptkarte.
					</p>
				</div>
			</div>
		</div>
	{:else}
		<HScroll
			label="Favoriten"
			gap="gap-4"
			fade={!isDesktop}
			fadeFrom="from-background"
			scrollerClass="snap-x snap-mandatory pb-1"
		>
			{#each places as place (place.id ?? `${place.latitude}-${place.longitude}`)}
				{@const key = favoriteKey(place)}
				{@const bundle = favoriteWeather.bundles[key] ?? null}
				{@const error = favoriteWeather.errors[key] ?? null}
				<div class="w-[min(100%,36rem)] shrink-0 snap-start snap-always">
					{#if bundle}
						<CurrentHero {place} {bundle} onOpen={() => openJetzt(place)} />
					{:else}
						<div class="{panelClass(chromeState.chrome)} p-5 sm:p-6" aria-busy={!error}>
							<p class="break-words text-2xl font-semibold leading-snug tracking-tight">
								{place.name}
							</p>
							{#if error}
								<p class="mt-3 text-base leading-snug text-muted-foreground">{error}</p>
							{:else}
								<p class="mt-3 text-base leading-snug text-muted-foreground">Wetter wird geladen…</p>
								<div
									class="mt-6 h-24 animate-pulse bg-muted [html[data-chrome=android]_&]:rounded-3xl [html[data-chrome=desktop]_&]:rounded-md"
								></div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</HScroll>
	{/if}
</section>
