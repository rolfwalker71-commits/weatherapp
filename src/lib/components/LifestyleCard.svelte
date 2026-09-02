<script lang="ts">
	import Shirt from '@lucide/svelte/icons/shirt';
	import { chromeState } from '$lib/chrome.svelte';
	import { scaleBarClass, scaleFillClass } from '$lib/colors';
	import { comfortAdvice } from '$lib/comfort';
	import { clothingLine } from '$lib/insights';
	import { outdoorScores } from '$lib/lifestyle';
	import { panelClass } from '$lib/platform';
	import { weatherState } from '$lib/weather.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const bundle = $derived(weatherState.bundle);
	const comfort = $derived(bundle ? comfortAdvice(bundle) : null);
	const clothing = $derived(bundle ? clothingLine(bundle) : '');
	const scores = $derived(bundle ? outdoorScores(bundle) : []);
	const shape = $derived(isDesktop ? 'rounded-md p-3' : 'rounded-[1.25rem] p-3');
</script>

{#if bundle && comfort}
	<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
		<h2 class="flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
			<Shirt class="size-5 wx-icon-thermo" /> Gefühl & Draußen
		</h2>
		<p class="mt-2 text-base font-medium leading-snug">{clothing}</p>
		<p class="mt-1 text-sm text-muted-foreground">{comfort.detail}</p>

		<ul class="mt-4 space-y-2">
			{#each scores as score (score.id)}
				<li class="{shape} {scaleFillClass(score.tone)}">
					<div class="flex items-center justify-between gap-3">
						<p class="font-medium leading-snug">{score.label}</p>
						<p class="tabular-nums">{score.score}</p>
					</div>
					<div class="mt-2 h-2 bg-background/40 {isDesktop ? 'rounded-sm' : 'rounded-full'}">
						<div
							class="h-2 {scaleBarClass(score.tone)} {isDesktop ? 'rounded-sm' : 'rounded-full'}"
							style="width: {Math.max(6, score.score)}%;"
						></div>
					</div>
					<p class="mt-1 text-sm leading-snug opacity-80">{score.hint}</p>
				</li>
			{/each}
		</ul>
	</section>
{/if}
