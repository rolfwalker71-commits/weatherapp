<script lang="ts">
	import AppIcon from './AppIcon.svelte';
	import { chromeState } from '$lib/chrome.svelte';
	import {
		formatHour,
		formatMm,
		formatPercent,
		formatTime,
		formatWind,
		formatWindValue,
		windDirection
	} from '$lib/format';
	import { windChartAriaLabel, windHourBars } from '$lib/insights';
	import { panelClass } from '$lib/platform';
	import { unitsState } from '$lib/units.svelte';
	import { weatherState } from '$lib/weather.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const hours = $derived((weatherState.bundle?.hours ?? []).slice(0, 12));
	const windBars12 = $derived(windHourBars(weatherState.bundle?.hours ?? [], 12));
	const maxPrecip = $derived(Math.max(0.2, ...hours.map((hour) => hour.precipMm)));
	const maxWind = $derived(
		Math.max(1, ...windBars12.flatMap((bar) => [bar.speed, bar.gusts ?? 0]))
	);
	const hasGusts = $derived(windBars12.some((bar) => bar.gusts != null));
	const tile = $derived(isDesktop ? 'rounded-md' : 'rounded-full');
</script>

<section class="{panelClass(chromeState.chrome)} overflow-hidden max-lg:overflow-x-hidden p-5 sm:p-6">
	<h2 class="mb-1 text-xl font-semibold leading-snug tracking-tight">Regen + Wind</h2>
	<p class="mb-4 text-sm text-muted-foreground">Nächste 12 Stunden · stündlich Open-Meteo</p>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<div class="min-w-0">
			<h3 class="mb-3 flex items-center gap-2 font-medium">
				<AppIcon name="nowcast" class="size-4 wx-icon-rain" /> Regen
			</h3>
			{#if hours.length}
				<div
					class="wx-inline-scroll"
					role="region"
					aria-label="Niederschlag nächste 12 Stunden, stündlich"
				>
					<div
						class="min-w-0 max-w-full overflow-x-auto overscroll-x-contain lg:overflow-visible [-ms-overflow-style:none] [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden"
					>
						<div class="flex w-max min-w-full items-end gap-1 lg:w-full lg:min-w-0">
							{#each hours as hour (hour.time)}
								<div
									class="flex w-11 shrink-0 flex-col items-center gap-1 lg:w-auto lg:min-w-0 lg:flex-1"
								>
									<div class="flex h-16 w-full items-end">
										<div
											class="w-full {tile} wx-bar-rain"
											style="height: {Math.max(10, (hour.precipMm / maxPrecip) * 100)}%;"
											title="{formatHour(hour.time)} · {formatMm(hour.precipMm)}"
										></div>
									</div>
									<span class="text-[0.65rem] tabular-nums text-muted-foreground"
										>{formatHour(hour.time)}</span
									>
								</div>
							{/each}
						</div>
					</div>
				</div>
				<p class="mt-3 text-sm text-muted-foreground">
					Nächste Stunde {formatMm(hours[0]?.precipMm ?? 0)}
					{#if hours[0]?.precipProb != null}
						· Wahrscheinlichkeit {formatPercent(hours[0].precipProb)}
					{/if}
				</p>
			{:else}
				<p class="text-sm text-muted-foreground">Keine Niederschlagsdaten.</p>
			{/if}
		</div>

		<div class="min-w-0">
			<h3 class="mb-3 flex items-center gap-2 font-medium">
				<AppIcon name="wind" class="size-4 wx-icon-wind" /> Wind
			</h3>
			{#if windBars12.length}
				<div class="wx-inline-scroll" role="region" aria-label={windChartAriaLabel(windBars12)}>
					<div
						class="min-w-0 max-w-full overflow-x-auto overscroll-x-contain lg:overflow-visible [-ms-overflow-style:none] [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden"
					>
						<div class="flex w-max min-w-full items-end gap-1 lg:w-full lg:min-w-0">
							{#each windBars12 as bar (bar.time)}
								{@const speedLabel = formatWindValue(bar.speed, unitsState.wind)}
								{@const gustLabel =
									bar.gusts != null ? formatWindValue(bar.gusts, unitsState.wind) : null}
								{@const showGust = gustLabel != null && gustLabel !== speedLabel}
								<div
									class="flex w-11 shrink-0 flex-col items-center gap-1 lg:w-auto lg:min-w-0 lg:flex-1"
								>
									<svg
										class="wx-wind-mini wx-icon-wind"
										viewBox="0 0 12 16"
										style="transform: rotate({bar.direction}deg)"
										aria-hidden="true"
									>
										<title>aus {windDirection(bar.direction)}</title>
										<path d="M6 1 L10.5 15 L6 11.5 L1.5 15 Z" fill="currentColor" />
									</svg>
									<span class="sr-only">{windDirection(bar.direction)}</span>
									<div
										class="relative flex h-14 w-full items-end"
										title="{formatTime(bar.time)} · {formatWind(
											bar.speed,
											unitsState.wind
										)} aus {windDirection(bar.direction)}{bar.gusts != null
											? ` · Böen ${formatWind(bar.gusts, unitsState.wind)}`
											: ''}"
									>
										{#if bar.gusts != null}
											<div
												class="absolute bottom-0 w-full {tile} wx-bar-gust"
												style="height: {Math.max(8, (bar.gusts / maxWind) * 100)}%;"
											></div>
										{/if}
										<div
											class="relative w-full {tile} wx-bar-wind"
											style="height: {Math.max(8, (bar.speed / maxWind) * 100)}%;"
										></div>
									</div>
									<div
										class="flex flex-col items-center justify-start leading-none {hasGusts
											? 'min-h-[2.25rem]'
											: ''}"
									>
										<span class="text-xs font-semibold tabular-nums">{speedLabel}</span>
										{#if showGust}
											<span class="mt-0.5 text-[0.65rem] tabular-nums text-muted-foreground"
												>{gustLabel}</span
											>
										{/if}
									</div>
									<span class="text-[0.65rem] tabular-nums text-muted-foreground"
										>{formatHour(bar.time)}</span
									>
								</div>
							{/each}
						</div>
					</div>
				</div>
				<p class="mt-2 text-sm text-muted-foreground">
					Zahl Wind{hasGusts ? ' · kleiner Böen' : ''}
					· {unitsState.wind === 'ms' ? 'm/s' : 'km/h'}
				</p>
			{:else}
				<p class="text-sm text-muted-foreground">Keine Winddaten.</p>
			{/if}
		</div>
	</div>
</section>
