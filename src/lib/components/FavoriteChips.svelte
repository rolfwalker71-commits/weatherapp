<script lang="ts">
	import Star from '@lucide/svelte/icons/star';
	import { chromeState } from '$lib/chrome.svelte';
	import { placeShort } from '$lib/format';
	import { samePlace } from '$lib/storage';
	import { loadPlace, weatherState } from '$lib/weather.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
</script>

{#if weatherState.favorites.length > 0}
	<div class="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
		{#each weatherState.favorites as place (place.id ?? `${place.latitude}-${place.longitude}`)}
			{@const active = samePlace(place, weatherState.place)}
			<button
				type="button"
				class="inline-flex shrink-0 items-center gap-2 px-4 text-sm leading-none {isDesktop
					? 'h-10 rounded-md'
					: 'h-10 rounded-full'} {active ? 'wx-chip-clear' : 'bg-muted text-foreground'}"
				onclick={() => void loadPlace(place, { recent: false })}
			>
				<Star class="size-3.5 wx-icon-star {active ? 'fill-current' : ''}" aria-hidden="true" />
				<span class="whitespace-nowrap">{placeShort(place)}</span>
			</button>
		{/each}
	</div>
{/if}
