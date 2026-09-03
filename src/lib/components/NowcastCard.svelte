<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import AppIcon from './AppIcon.svelte';
	import { formatMm, formatTime } from '$lib/format';
	import { nowcast30Bars, nowcastAriaLabel, nowcastTitle, thunderNowcast } from '$lib/insights';
	import { panelClass } from '$lib/platform';
	import { weatherState } from '$lib/weather.svelte';

	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const bars = $derived(nowcast30Bars(weatherState.bundle?.minutes ?? []));
	const title = $derived(nowcastTitle(bars));
	const nowcast = $derived(thunderNowcast(bars));
	const maxPrecip = $derived(Math.max(0.2, ...bars.map((item) => item.precipMm)));
	const tile = $derived(isDesktop ? 'rounded-md' : 'rounded-full');
</script>

{#if bars.length}
	<section class="{panelClass(chromeState.chrome)} max-lg:overflow-x-hidden {compact ? 'p-4' : 'p-5 sm:p-6'}">
		<h2 class="flex min-w-0 items-center gap-2 {compact ? 'text-base' : 'text-xl'} font-semibold leading-snug tracking-tight">
			<AppIcon name="nowcast" class="size-6 wx-icon-storm" />
			{title}
		</h2>
		{#if nowcast.label}
			<p class="mb-2 break-words text-sm leading-snug text-muted-foreground">{nowcast.label}</p>
		{/if}

		<div
			class="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain lg:overflow-visible [-ms-overflow-style:none] [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden"
			role="region"
			aria-label={nowcastAriaLabel(bars)}
		>
			<div class="flex w-max min-w-full items-end gap-1.5 lg:w-full lg:min-w-0">
				{#each bars as point (point.time)}
					<div class="flex w-11 shrink-0 flex-col items-center gap-1 lg:w-auto lg:min-w-0 lg:flex-1">
						<div class="flex {compact ? 'h-10' : 'h-14'} w-full items-end">
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
		</div>
		{#if nowcast.nextMm != null}
			<p class="mt-2 text-sm text-muted-foreground">Summe {formatMm(nowcast.nextMm)}</p>
		{/if}
	</section>
{/if}
