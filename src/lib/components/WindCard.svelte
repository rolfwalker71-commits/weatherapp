<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import AppIcon from './AppIcon.svelte';
	import { formatPercent, formatTime, formatWind, formatWindValue, windDirection } from '$lib/format';
	import { windBars, windChartAriaLabel } from '$lib/insights';
	import { panelClass } from '$lib/platform';
	import { unitsState } from '$lib/units.svelte';
	import { weatherState } from '$lib/weather.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const current = $derived(weatherState.bundle?.current);
	const hour = $derived(weatherState.bundle?.hours[0]);
	const bars = $derived(
		windBars(weatherState.bundle?.minutes ?? [], weatherState.bundle?.hours ?? [])
	);
	const maxWind = $derived(
		Math.max(1, ...bars.flatMap((bar) => [bar.speed, bar.gusts ?? 0]))
	);
	const shape = $derived(isDesktop ? 'rounded-md p-3 ring-1 ring-border' : 'rounded-[1.25rem] p-3 bg-muted');
	const tile = $derived(isDesktop ? 'rounded-md' : 'rounded-full');
	const hasGusts = $derived(bars.some((bar) => bar.gusts != null));
</script>

{#if current}
	<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
		<h2 class="flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
			<AppIcon name="wind" class="size-6 wx-icon-wind" /> Wind
		</h2>
		<p class="mt-2 text-3xl font-semibold tabular-nums">{formatWind(current.wind_speed_10m, unitsState.wind)}</p>
		<p class="mt-1 text-sm text-muted-foreground">
			aus {windDirection(current.wind_direction_10m)}
			{#if current.wind_gusts_10m != null}
				· Böen {formatWind(current.wind_gusts_10m, unitsState.wind)}
			{/if}
		</p>
		{#if hour?.cape != null}
			<p class="mt-2 text-sm leading-snug">
				CAPE {Math.round(hour.cape)} J/kg · Modell
			</p>
		{/if}

		{#if bars.length}
			<div
				class="mt-4 overflow-x-auto lg:overflow-visible [-ms-overflow-style:none] [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden"
				role="region"
				aria-label={windChartAriaLabel(bars)}
			>
				<div class="flex min-w-[36rem] items-end gap-1.5 lg:min-w-0">
					{#each bars as bar (bar.time)}
						{@const speedLabel = formatWindValue(bar.speed, unitsState.wind)}
						{@const gustLabel = bar.gusts != null ? formatWindValue(bar.gusts, unitsState.wind) : null}
						{@const showGust = gustLabel != null && gustLabel !== speedLabel}
						<div class="flex w-11 shrink-0 flex-col items-center gap-1 lg:w-auto lg:min-w-0 lg:flex-1">
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
								title="{formatTime(bar.time)} · {formatWind(bar.speed, unitsState.wind)} aus {windDirection(
									bar.direction
								)}{bar.gusts != null ? ` · Böen ${formatWind(bar.gusts, unitsState.wind)}` : ''}"
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
									<span class="mt-0.5 text-[0.65rem] tabular-nums text-muted-foreground">{gustLabel}</span>
								{/if}
							</div>
							<span class="text-[0.65rem] tabular-nums text-muted-foreground">{formatTime(bar.time)}</span>
						</div>
					{/each}
				</div>
			</div>
			<p class="mt-2 text-sm text-muted-foreground">
				Zahl Wind{hasGusts ? ' · kleiner Böen' : ''}
				· {unitsState.wind === 'ms' ? 'm/s' : 'km/h'}
			</p>
		{/if}

		<dl class="mt-4 grid grid-cols-2 gap-2">
			{#if hour?.gusts != null}
				<div class="{shape}">
					<dt class="text-sm text-muted-foreground">Böen (Stunde)</dt>
					<dd class="font-medium tabular-nums">{formatWind(hour.gusts, unitsState.wind)}</dd>
				</div>
			{/if}
			{#if current.relative_humidity_2m != null}
				<div class="{shape}">
					<dt class="text-sm text-muted-foreground">Luftfeuchtigkeit</dt>
					<dd class="font-medium tabular-nums">{formatPercent(current.relative_humidity_2m)}</dd>
				</div>
			{/if}
			{#if current.pressure_msl != null}
				<div class="{shape}">
					<dt class="text-sm text-muted-foreground">Luftdruck</dt>
					<dd class="font-medium tabular-nums">{Math.round(current.pressure_msl)} hPa</dd>
				</div>
			{/if}
			{#if current.cloud_cover != null}
				<div class="{shape}">
					<dt class="text-sm text-muted-foreground">Bewölkung</dt>
					<dd class="font-medium tabular-nums">{Math.round(current.cloud_cover)} %</dd>
				</div>
			{/if}
		</dl>
	</section>
{/if}
