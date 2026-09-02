<script lang="ts">
	import MoonStar from '@lucide/svelte/icons/moon-star';
	import { chromeState } from '$lib/chrome.svelte';
	import { skyWatch } from '$lib/lifestyle';
	import { panelClass } from '$lib/platform';
	import { weatherState } from '$lib/weather.svelte';

	const bundle = $derived(weatherState.bundle);
	const sky = $derived(bundle ? skyWatch(bundle) : null);
</script>

{#if sky}
	<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
		<h2 class="flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
			<MoonStar class="size-6 wx-icon-night" /> Himmel
		</h2>
		{#if sky.goldenLabel}
			<p class="mt-2 font-medium leading-snug">{sky.goldenLabel}</p>
		{/if}
		{#if sky.starsLabel}
			<p class="mt-1 text-sm leading-snug text-muted-foreground">{sky.starsLabel}</p>
		{/if}
		<p class="mt-1 text-sm text-muted-foreground">{sky.moonLabel}</p>
	</section>
{/if}
