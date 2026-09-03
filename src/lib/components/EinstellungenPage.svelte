<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import { listTileClass, panelClass } from '$lib/platform';
	import { loadHomePlace, saveHomePlace, samePlace } from '$lib/storage';
	import type { Place, WindUnit } from '$lib/types';
	import { setWindUnit, unitsState } from '$lib/units.svelte';
	import { weatherState } from '$lib/weather.svelte';
	import AppIcon from './AppIcon.svelte';
	import CitySearch from './CitySearch.svelte';
	import SettingsSheet from './SettingsSheet.svelte';
	import ThemePanel from './ThemePanel.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	let home = $state<Place | null>(loadHomePlace());
	let standalone = $state(false);

	const windOptions: { id: WindUnit; label: string }[] = [
		{ id: 'kmh', label: 'km/h' },
		{ id: 'ms', label: 'm/s' }
	];

	$effect(() => {
		if (typeof window === 'undefined') return;
		const media = window.matchMedia('(display-mode: standalone)');
		const nav = navigator as Navigator & { standalone?: boolean };
		standalone = media.matches || nav.standalone === true;
		const onChange = () => {
			standalone = media.matches || nav.standalone === true;
		};
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	});

	function pinHome(place: Place) {
		saveHomePlace(place);
		home = place;
	}

	function pinCurrent() {
		pinHome(weatherState.place);
	}
</script>

<section aria-labelledby="einstellungen-title">
	<h1 id="einstellungen-title" class="mb-4 text-2xl font-semibold leading-snug tracking-tight">
		Einstellungen
	</h1>
	<div class="grid min-w-0 max-w-full grid-cols-1 gap-4 max-lg:overflow-x-hidden lg:grid-cols-2 lg:items-start">
		<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
			<h2 class="mb-1 flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
				<AppIcon name="home" class="size-5 wx-icon-rain" /> Home-Ort
			</h2>
			<p class="mb-3 text-sm leading-snug text-muted-foreground">
				{#if home}
					Gesetzt: {home.name}
					{#if home.admin1 && home.admin1 !== home.name}
						, {home.admin1}
					{/if}
				{:else}
					Kein Home-Ort — bei fehlendem GPS bleibt Bern.
				{/if}
			</p>
			<button
				type="button"
				class="mb-3 inline-flex min-h-12 items-center gap-2 px-4 text-sm {isDesktop
					? 'rounded-md bg-primary/10 text-primary'
					: 'rounded-full bg-secondary text-primary'}"
				onclick={pinCurrent}
			>
				<AppIcon name="pin" class="size-4" />
				Aktuellen Ort als Home
			</button>
			<CitySearch
				id="home-place"
				placeholder="Home-Ort suchen"
				hotkey={false}
				onSelect={pinHome}
			/>
			{#if weatherState.favorites.length}
				<div class="mt-3 flex flex-wrap gap-2">
					{#each weatherState.favorites as fav (fav.id ?? `${fav.latitude}-${fav.longitude}`)}
						<button
							type="button"
							class="min-h-10 px-3 text-sm {listTileClass(
								chromeState.chrome,
								home != null && samePlace(home, fav)
							)}"
							onclick={() => pinHome(fav)}
						>
							{fav.name}
						</button>
					{/each}
				</div>
			{/if}
		</section>

		<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
			<h2 class="mb-3 text-xl font-semibold leading-snug tracking-tight">Einheiten</h2>
			<p class="mb-3 text-sm text-muted-foreground">Wind. Temperatur bleibt °C, Niederschlag mm.</p>
			<ul class="flex flex-wrap gap-2">
				{#each windOptions as option (option.id)}
					<li>
						<button
							type="button"
							class="min-h-12 px-4 text-sm {listTileClass(
								chromeState.chrome,
								unitsState.wind === option.id
							)}"
							aria-pressed={unitsState.wind === option.id}
							onclick={() => setWindUnit(option.id)}
						>
							{option.label}
						</button>
					</li>
				{/each}
			</ul>
		</section>

		<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
			<h2 class="mb-3 text-xl font-semibold leading-snug tracking-tight">Meldungen</h2>
			<SettingsSheet embedded />
		</section>
		<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
			<h2 class="mb-3 text-xl font-semibold leading-snug tracking-tight">Darstellung</h2>
			<ThemePanel />
			{#if !standalone}
				<p class="mt-4 text-sm leading-snug text-muted-foreground">
					Zum Home-Bildschirm: Browser-Menü → App installieren oder Zum Startbildschirm.
				</p>
			{/if}
		</section>
	</div>
</section>
