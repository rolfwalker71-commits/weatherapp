<script lang="ts">
	import Shirt from '@lucide/svelte/icons/shirt';
	import { comfortAdvice } from '$lib/comfort';
	import { clothingLine } from '$lib/insights';
	import { panelClass } from '$lib/platform';
	import { chromeState } from '$lib/chrome.svelte';
	import { weatherState } from '$lib/weather.svelte';

	const bundle = $derived(weatherState.bundle);
	const comfort = $derived(bundle ? comfortAdvice(bundle) : null);
	const clothing = $derived(bundle ? clothingLine(bundle) : null);
</script>

{#if bundle && (clothing || comfort)}
	<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
		<h2 class="flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
			<Shirt class="size-6 wx-icon-thermo" /> Draußen
		</h2>
		{#if clothing}
			<p class="mt-2 text-base font-medium leading-snug">{clothing}</p>
		{/if}
		{#if comfort}
			<p class="mt-1 text-sm text-muted-foreground">{comfort.detail}</p>
		{/if}
	</section>
{/if}
