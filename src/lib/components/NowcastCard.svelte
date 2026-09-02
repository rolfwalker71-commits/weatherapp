<script lang="ts">
	import CloudLightning from '@lucide/svelte/icons/cloud-lightning';
	import { chromeState } from '$lib/chrome.svelte';
	import { formatMm, formatTime } from '$lib/format';
	import { thunderNowcast } from '$lib/insights';
	import { panelClass } from '$lib/platform';
	import { weatherState } from '$lib/weather.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const minutes = $derived(weatherState.bundle?.minutes ?? []);
	const nowcast = $derived(thunderNowcast(minutes));
	const maxPrecip = $derived(Math.max(0.2, ...minutes.map((item) => item.precipMm)));
	const tile = $derived(isDesktop ? 'rounded-md' : 'rounded-full');
</script>

<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
	<h2 class="flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
		<CloudLightning class="size-5 wx-icon-storm" /> Nowcast 90 Min.
	</h2>
	<p class="mb-3 text-sm leading-snug text-muted-foreground">{nowcast.label}</p>

	{#if minutes.length}
		<div class="flex items-end gap-1" aria-label="Niederschlag nächste 90 Minuten">
			{#each minutes as point (point.time)}
				<div class="flex min-w-0 flex-1 flex-col items-center gap-1">
					<div class="flex h-14 w-full items-end">
						<div
							class="w-full {tile} wx-bar-rain"
							style="height: {Math.max(8, (point.precipMm / maxPrecip) * 100)}%;"
							title="{formatTime(point.time)} · {formatMm(point.precipMm)}"
						></div>
					</div>
					<span class="text-[0.65rem] tabular-nums text-muted-foreground">{formatTime(point.time)}</span>
				</div>
			{/each}
		</div>
		<p class="mt-3 text-sm text-muted-foreground">Summe {formatMm(nowcast.nextMm)} in {nowcast.windowMin} Min.</p>
	{:else}
		<p class="text-sm text-muted-foreground">Keine Minutendaten — stündliche Werte bleiben massgebend.</p>
	{/if}
</section>
