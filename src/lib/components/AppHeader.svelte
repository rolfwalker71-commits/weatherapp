<script lang="ts">
	import LocateFixed from '@lucide/svelte/icons/locate-fixed';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { chromeState } from '$lib/chrome.svelte';
	import { loadPlace, locateUser, weatherState } from '$lib/weather.svelte';
	import CitySearch from './CitySearch.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
</script>

<header
	class={isDesktop
		? 'mica sticky top-0 z-20 border-b border-border'
		: 'sticky top-0 z-20 bg-card'}
>
	<div
		class="mx-auto flex w-full max-w-[90rem] flex-col gap-3 px-4 py-3 sm:px-6 {isDesktop
			? 'lg:flex-row lg:items-center lg:gap-6 lg:py-2'
			: ''}"
		style="padding-top: max(0.75rem, env(safe-area-inset-top, 0px));"
	>
		<div class="flex items-center justify-between gap-3">
			<div class="min-w-0">
				<p class="text-sm text-muted-foreground">Wetter</p>
				<p class="truncate text-lg font-semibold tracking-tight">Schweiz & Welt</p>
			</div>
			<div class="flex items-center gap-2 lg:hidden">
				<button
					type="button"
					class="icon-btn"
					onclick={() => void loadPlace(weatherState.place)}
					aria-label="Aktualisieren"
					disabled={weatherState.loading}
				>
					<RefreshCw class="size-5 wx-icon-week {weatherState.loading ? 'animate-spin' : ''}" />
				</button>
				<ThemeToggle />
			</div>
		</div>

		<div class="min-w-0 flex-1">
			<CitySearch />
		</div>

		{#if isDesktop}
			<div class="hidden items-center gap-2 lg:flex">
				<button
					type="button"
					class="inline-flex h-11 items-center gap-2 rounded-md bg-primary/10 px-3 text-sm text-primary"
					onclick={() => void locateUser()}
					disabled={weatherState.locating}
				>
					<LocateFixed class="size-4 wx-icon-wind" />
					Standort
				</button>
				<button
					type="button"
					class="icon-btn"
					onclick={() => void loadPlace(weatherState.place)}
					aria-label="Aktualisieren"
				>
					<RefreshCw class="size-5 wx-icon-week {weatherState.loading ? 'animate-spin' : ''}" />
				</button>
				<ThemeToggle />
			</div>
		{/if}
	</div>
</header>
