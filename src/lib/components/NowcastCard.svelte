<script lang="ts">
	import CloudLightning from '@lucide/svelte/icons/cloud-lightning';
	import { chromeState } from '$lib/chrome.svelte';
	import { formatMm, formatTime } from '$lib/format';
	import { thunderNowcast } from '$lib/insights';
	import { panelClass } from '$lib/platform';
	import { weatherState } from '$lib/weather.svelte';

	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const minutes = $derived((weatherState.bundle?.minutes ?? []).filter((item) => item.precipMm != null));
	const nowcast = $derived(thunderNowcast(minutes));
	const maxPrecip = $derived(Math.max(0.2, ...minutes.map((item) => item.precipMm ?? 0)));
	const tile = $derived(isDesktop ? 'rounded-md' : 'rounded-full');
</script>

{#if minutes.length}
	<section class="{panelClass(chromeState.chrome)} {compact ? 'p-4' : 'p-5 sm:p-6'}">
		<h2 class="flex items-center gap-2 {compact ? 'text-base' : 'text-xl'} font-semibold leading-snug tracking-tight">
			<CloudLightning class="size-6 wx-icon-storm" /> 90 Min.
		</h2>
		{#if nowcast.label}
			<p class="mb-2 text-sm leading-snug text-muted-foreground">{nowcast.label}</p>
		{/if}

		<div class="flex items-end gap-1" aria-label="Niederschlag nächste 90 Minuten">
			{#each minutes as point (point.time)}
				<div class="flex min-w-0 flex-1 flex-col items-center gap-1">
					<div class="flex {compact ? 'h-10' : 'h-14'} w-full items-end">
						<div
							class="w-full {tile} wx-bar-rain"
							style="height: {Math.max(8, ((point.precipMm ?? 0) / maxPrecip) * 100)}%;"
							title="{formatTime(point.time)} · {formatMm(point.precipMm ?? 0)}"
						></div>
					</div>
					<span class="text-[0.65rem] tabular-nums text-muted-foreground">{formatTime(point.time)}</span>
				</div>
			{/each}
		</div>
		{#if nowcast.nextMm != null}
			<p class="mt-2 text-sm text-muted-foreground">Summe {formatMm(nowcast.nextMm)}</p>
		{/if}
	</section>
{/if}
