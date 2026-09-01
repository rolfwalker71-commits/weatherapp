<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import { searchPlaces } from '$lib/api';
	import { chromeState } from '$lib/chrome.svelte';
	import { placeLabel } from '$lib/format';
	import { loadRecent } from '$lib/storage';
	import type { Place } from '$lib/types';
	import { loadPlace } from '$lib/weather.svelte';

	let query = $state('');
	let results = $state<Place[]>([]);
	let recent = $state<Place[]>([]);
	let open = $state(false);
	let active = $state(-1);
	let loading = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);

	const listId = 'city-listbox';
	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const shown = $derived(query.trim().length >= 2 ? results : recent);

	let timer: ReturnType<typeof setTimeout> | undefined;
	let abort: AbortController | null = null;

	function refreshRecent() {
		recent = loadRecent();
	}

	function onFocus() {
		refreshRecent();
		open = true;
	}

	function onInput(event: Event) {
		const value = (event.target as HTMLInputElement).value;
		query = value;
		open = true;
		active = -1;
		clearTimeout(timer);
		abort?.abort();
		if (value.trim().length < 2) {
			results = [];
			loading = false;
			return;
		}
		loading = true;
		timer = setTimeout(async () => {
			abort = new AbortController();
			try {
				results = await searchPlaces(value, abort.signal);
			} catch {
				if (abort.signal.aborted) return;
				results = [];
			} finally {
				loading = false;
			}
		}, 220);
	}

	function choose(place: Place) {
		query = '';
		results = [];
		open = false;
		active = -1;
		void loadPlace(place);
		inputEl?.blur();
	}

	function onKeydown(event: KeyboardEvent) {
		if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
			open = true;
			refreshRecent();
			return;
		}
		if (event.key === 'Escape') {
			open = false;
			active = -1;
			return;
		}
		if (!shown.length) return;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			active = (active + 1) % shown.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			active = (active - 1 + shown.length) % shown.length;
		} else if (event.key === 'Enter' && active >= 0) {
			event.preventDefault();
			choose(shown[active]);
		}
	}

	export function focusSearch() {
		inputEl?.focus();
		open = true;
		refreshRecent();
	}

	function onWindowKey(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			focusSearch();
		}
	}
</script>

<svelte:window onkeydown={onWindowKey} />

<div class="relative w-full {isDesktop ? 'max-w-xl' : ''}">
	<label class="sr-only" for="city-search">Stadt suchen</label>
	<div
		class="flex items-center gap-2 bg-muted px-4 {isDesktop
			? 'h-11 rounded-md ring-1 ring-border'
			: 'min-h-12 rounded-full'}"
	>
		<Search class="size-4 shrink-0 wx-icon-week" aria-hidden="true" />
		<input
			id="city-search"
			bind:this={inputEl}
			value={query}
			type="search"
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			role="combobox"
			aria-expanded={open}
			aria-controls={listId}
			aria-autocomplete="list"
			aria-activedescendant={active >= 0 ? `city-opt-${active}` : undefined}
			placeholder={isDesktop ? 'Stadt suchen  ·  Ctrl K' : 'Stadt weltweit suchen'}
			class="h-11 min-h-0 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
			oninput={onInput}
			onfocus={onFocus}
			onkeydown={onKeydown}
			onblur={() => setTimeout(() => (open = false), 140)}
		/>
		{#if loading}
			<span class="sr-only">Suche läuft</span>
			<span class="size-2 animate-pulse rounded-full bg-primary" aria-hidden="true"></span>
		{/if}
	</div>

	{#if open && shown.length > 0}
		<ul
			id={listId}
			role="listbox"
			class="absolute z-30 mt-2 max-h-72 w-full overflow-auto py-1 {isDesktop
				? 'rounded-md bg-card ring-1 ring-border'
				: 'rounded-3xl bg-card'}"
		>
			{#if query.trim().length < 2}
				<li class="px-4 py-2 text-sm text-muted-foreground">Zuletzt gesucht</li>
			{/if}
			{#each shown as place, index (place.id ?? `${place.latitude}-${place.longitude}`)}
				<li role="option" id="city-opt-{index}" aria-selected={active === index}>
					<button
						type="button"
						class="flex w-full items-start gap-3 px-4 py-3 text-left {active === index
							? isDesktop
								? 'bg-primary/10'
								: 'bg-secondary text-primary'
							: 'bg-card hover:bg-muted'}"
						onmousedown={(event) => event.preventDefault()}
						onclick={() => choose(place)}
					>
						<MapPin class="mt-0.5 size-4 shrink-0 wx-icon-rain" aria-hidden="true" />
						<span class="min-w-0">
							<span class="block break-words leading-snug">{place.name}</span>
							<span class="block text-sm text-muted-foreground">{placeLabel(place)}</span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
