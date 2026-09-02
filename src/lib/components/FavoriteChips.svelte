<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import AppIcon from './AppIcon.svelte';
	import { placeShort } from '$lib/format';
	import { samePlace } from '$lib/storage';
	import { loadPlace, weatherState } from '$lib/weather.svelte';
	import HScroll from './HScroll.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
</script>

{#if weatherState.favorites.length > 0}
	<HScroll fade fadeFrom="from-background" scrollerClass="pb-1">
		{#each weatherState.favorites as place (place.id ?? `${place.latitude}-${place.longitude}`)}
			{@const active = samePlace(place, weatherState.place)}
			<button
				type="button"
				class="inline-flex shrink-0 items-center gap-2 px-4 text-sm leading-none {isDesktop
					? 'h-10 rounded-md'
					: 'h-10 rounded-full'} {active ? 'wx-chip-clear' : 'bg-muted text-foreground'}"
				onclick={() => void loadPlace(place, { recent: false })}
			>
				<AppIcon name="star" filled={active} class="size-3.5 wx-icon-star" />
				<span class="whitespace-nowrap">{placeShort(place)}</span>
			</button>
		{/each}
	</HScroll>
{/if}
