<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import { formatRefreshStatus } from '$lib/format';
	import { goSection, setDrawer } from '$lib/ui.svelte';
	import { clockState, loadPlace, locateUser, weatherState } from '$lib/weather.svelte';
	import AppIcon from './AppIcon.svelte';
	import CitySearch from './CitySearch.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const updatedLabel = $derived(
		weatherState.bundle
			? formatRefreshStatus(
					weatherState.bundle.fetchedAt,
					weatherState.stale,
					clockState.now,
					weatherState.error?.startsWith('Offline') ?? false
				)
			: 'Wetter'
	);
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
			<div class="flex min-w-0 items-center gap-2">
				{#if !isDesktop}
					<button
						type="button"
						class="icon-btn shrink-0 lg:hidden"
						onclick={() => setDrawer(true)}
						aria-label="Menü"
						title="Menü"
					>
						<AppIcon name="menu" class="size-5" />
					</button>
				{/if}
				<div class="min-w-0">
					<p class="text-sm leading-snug text-muted-foreground">{updatedLabel}</p>
					<p class="break-words text-lg font-semibold leading-snug tracking-tight">Schweiz & Welt</p>
				</div>
			</div>
			<div class="flex items-center gap-2 lg:hidden">
				<button
					type="button"
					class="icon-btn"
					onclick={() => void locateUser()}
					aria-label="Standort"
					title="Standort verwenden"
					disabled={weatherState.locating}
				>
					<AppIcon name="locate" class="size-5 {weatherState.locating ? 'animate-pulse' : ''}" />
				</button>
				<button
					type="button"
					class="icon-btn"
					onclick={() => void loadPlace(weatherState.place)}
					aria-label="Aktualisieren"
					title="Aktualisieren"
					disabled={weatherState.loading}
				>
					<AppIcon name="refresh" class="size-5 wx-icon-week {weatherState.loading ? 'animate-spin' : ''}" />
				</button>
			</div>
		</div>

		<div class="min-w-0 flex-1">
			<CitySearch />
		</div>

		{#if isDesktop}
			<div class="hidden items-center gap-2 lg:flex">
				<button
					type="button"
					class="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary/10 px-3 text-sm text-primary"
					onclick={() => void locateUser()}
					disabled={weatherState.locating}
				>
					<AppIcon name="locate" class="size-4 wx-icon-wind" />
					Standort
				</button>
				<button
					type="button"
					class="icon-btn"
					onclick={() => void loadPlace(weatherState.place)}
					aria-label="Aktualisieren"
					title="Aktualisieren"
					disabled={weatherState.loading}
				>
					<AppIcon name="refresh" class="size-5 wx-icon-week {weatherState.loading ? 'animate-spin' : ''}" />
				</button>
				<button
					type="button"
					class="icon-btn"
					onclick={() => goSection('einstellungen')}
					aria-label="Meldungen"
					title="Meldungen"
				>
					<AppIcon name="bell" class="size-5 wx-icon-week" />
				</button>
				<ThemeToggle />
			</div>
		{/if}
	</div>
</header>
