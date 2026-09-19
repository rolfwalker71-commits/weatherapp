<script lang="ts">
	import { formatHourLabel, formatTemp, formatTime, formatWind, windDirection } from '$lib/format';
	import { insightLine, precipNowSummary } from '$lib/insights';
	import type { WeatherBundle } from '$lib/types';
	import { unitsState } from '$lib/units.svelte';
	import { getWmo, heroAtmosphere } from '$lib/wmo';
	import AppIcon from './AppIcon.svelte';
	import WeatherIcon from './WeatherIcon.svelte';

	/** Mirrors the layouts in src/lib/scriptable/wetter-widget.js at real point sizes. */
	interface Props {
		bundle: WeatherBundle;
		placeName: string;
		gps: boolean;
	}

	let { bundle, placeName, gps }: Props = $props();

	const SIZES = {
		small: { w: 158, h: 158, label: 'Klein', hint: 'iPhone & iPad' },
		medium: { w: 338, h: 158, label: 'Mittel', hint: 'iPhone & iPad' },
		large: { w: 338, h: 354, label: 'Gross', hint: 'iPhone & iPad' },
		extraLarge: { w: 715, h: 338, label: 'Extragross', hint: 'nur iPad' }
	} as const;
	type Family = keyof typeof SIZES;
	const families = Object.keys(SIZES) as Family[];

	let available = $state(338);
	const fit = (width: number) => Math.min(1, available / width);

	const tz = $derived(bundle.timezone);
	const cur = $derived(bundle.current);
	const isDay = $derived(cur.is_day === 1);
	const wmo = $derived(getWmo(cur.weather_code, isDay));
	const scene = $derived.by(() => {
		const s = heroAtmosphere(cur.weather_code, isDay);
		return s === 'hail' ? 'storm' : s;
	});
	const today = $derived(bundle.days[0]);
	const hiLo = $derived(today ? `H ${formatTemp(today.tMax)}  T ${formatTemp(today.tMin)}` : '');
	const insight = $derived(insightLine(bundle));
	const rain = $derived.by(() => {
		const p = precipNowSummary(bundle);
		const wet = p.headline !== 'trocken';
		const onset = p.detail?.match(/ab (\d\d:\d\d)/)?.[1];
		return {
			wet,
			headline: p.headline,
			detail: p.detail ?? (wet ? 'hält an' : 'nächste 12 Std.'),
			short: wet ? 'Regen jetzt' : onset ? `Regen ab ${onset}` : 'Trocken'
		};
	});
	const sun = $derived.by(() => {
		if (!today?.sunrise || !today.sunset) return null;
		// Bundle times are the place's wall-clock times, like `current.time`.
		const up = cur.time < today.sunset;
		const next = up ? today.sunset : (bundle.days[1]?.sunrise ?? today.sunrise);
		return {
			icon: up ? ('sunset' as const) : ('sunrise' as const),
			value: formatTime(next, tz),
			detail: `${formatTime(today.sunrise, tz)} – ${formatTime(today.sunset, tz)}`
		};
	});

	function strip(count: number) {
		const items = [{ key: 'now', label: 'Jetzt', temp: cur.temperature_2m, code: cur.weather_code, isDay }];
		const next = bundle.hours.filter((h) => h.time > cur.time);
		for (const h of next.slice(0, count - 1)) {
			items.push({ key: h.time, label: formatHourLabel(h.time), temp: h.temperature, code: h.code, isDay: h.isDay });
		}
		return items;
	}

	const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
	function days(count: number) {
		const list = bundle.days.slice(0, count);
		const lo = Math.min(...list.map((d) => d.tMin));
		const hi = Math.max(...list.map((d) => d.tMax));
		const span = Math.max(1, hi - lo);
		return list.map((d, i) => ({
			key: d.date,
			name: i === 0 ? 'Heute' : WEEKDAYS[new Date(`${d.date}T12:00:00Z`).getUTCDay()],
			code: d.code,
			prob: d.precipProb != null && d.precipProb >= 20 ? `${Math.round(d.precipProb)}%` : '',
			min: formatTemp(d.tMin),
			max: formatTemp(d.tMax),
			left: ((d.tMin - lo) / span) * 100,
			width: Math.max(4, ((d.tMax - d.tMin) / span) * 100),
			gradient: `linear-gradient(90deg, ${tempColor(d.tMin)}, ${tempColor(d.tMax)})`,
			dot: i === 0 ? ((cur.temperature_2m - lo) / span) * 100 : null
		}));
	}

	const rainBars = $derived.by(() => {
		const pts = bundle.minutes.slice(0, 8);
		const max = Math.max(1, ...pts.map((p) => p.precipMm ?? 0));
		return pts.map((p) => ({ key: p.time, h: Math.max(10, ((p.precipMm ?? 0) / max) * 100), wet: (p.precipMm ?? 0) >= 0.1 }));
	});

	const STOPS: [number, number[]][] = [
		[-15, [94, 92, 230]],
		[-5, [10, 132, 255]],
		[3, [100, 210, 255]],
		[10, [48, 209, 88]],
		[17, [255, 214, 10]],
		[24, [255, 159, 10]],
		[31, [255, 69, 58]]
	];
	function tempColor(t: number): string {
		let c = STOPS[STOPS.length - 1][1];
		if (t <= STOPS[0][0]) c = STOPS[0][1];
		else {
			for (let i = 1; i < STOPS.length; i++) {
				const [t1, c1] = STOPS[i];
				const [t0, c0] = STOPS[i - 1];
				if (t <= t1) {
					const f = (t - t0) / (t1 - t0);
					c = c0.map((v, k) => v + (c1[k] - v) * f);
					break;
				}
			}
		}
		return `rgb(${c.map(Math.round).join(' ')})`;
	}
</script>

{#snippet place(size: number)}
	<p class="wp-place" style="font-size:{size}px">
		<span class="truncate">{placeName}</span>
		{#if gps}<AppIcon name="locate" filled class="wp-loc" />{/if}
	</p>
{/snippet}

{#snippet hero(tempSize: number, iconSize: number, placeSize: number, compact = false)}
	<div class="flex items-start justify-between gap-2">
		<div class="min-w-0">
			{@render place(placeSize)}
			<p class="wp-temp" style="font-size:{tempSize}px">{formatTemp(cur.temperature_2m)}</p>
		</div>
		<div class="flex min-w-0 flex-col items-end text-right">
			<span style="--wp-icon:{iconSize}px"><WeatherIcon code={cur.weather_code} {isDay} class="wp-icon" /></span>
			<p class="wp-t13 mt-1 font-medium">{wmo.label}</p>
			{#if compact}
				<p class="wp-t11 wp-muted">Gefühlt {formatTemp(cur.apparent_temperature)} · {hiLo}</p>
			{:else}
				<p class="wp-t11 wp-muted">Gefühlt {formatTemp(cur.apparent_temperature)}</p>
				<p class="wp-t11 wp-muted font-medium">{hiLo}</p>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet hours(count: number, iconSize: number, gap = 4)}
	<div class="flex justify-between">
		{#each strip(count) as h (h.key)}
			<div class="flex flex-col items-center" style="gap:{gap}px">
				<p class="wp-t10 wp-muted font-medium">{h.label}</p>
				<span style="--wp-icon:{iconSize}px"><WeatherIcon code={h.code} isDay={h.isDay} class="wp-icon" /></span>
				<p class="wp-t13 font-semibold">{formatTemp(h.temp)}</p>
			</div>
		{/each}
	</div>
{/snippet}

{#snippet cells()}
	<div class="grid grid-cols-3 gap-2">
		<div class="min-w-0">
			<p class="wp-label"><AppIcon name="drop" filled class="wp-mini" />Regen</p>
			<p class="wp-t14 truncate font-semibold">{rain.headline}</p>
			<p class="wp-t10 wp-muted truncate">{rain.detail}</p>
		</div>
		<div class="min-w-0">
			<p class="wp-label"><AppIcon name="wind" class="wp-mini" />Wind</p>
			<p class="wp-t14 truncate font-semibold">{formatWind(cur.wind_speed_10m, unitsState.wind)}</p>
			<p class="wp-t10 wp-muted truncate">
				aus {windDirection(cur.wind_direction_10m)} · Böen {formatWind(cur.wind_gusts_10m, unitsState.wind)}
			</p>
		</div>
		{#if sun}
			<div class="min-w-0">
				<p class="wp-label"><AppIcon name={sun.icon} class="wp-mini" />Sonne</p>
				<p class="wp-t14 truncate font-semibold">{sun.value}</p>
				<p class="wp-t10 wp-muted truncate">{sun.detail}</p>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet dayList(count: number, gap: number)}
	<div class="flex flex-col" style="gap:{gap}px">
		{#each days(count) as d (d.key)}
			<div class="flex items-center gap-1.5">
				<p class="wp-t13 w-[42px] shrink-0 font-semibold">{d.name}</p>
				<span class="w-[22px] shrink-0" style="--wp-icon:17px"><WeatherIcon code={d.code} class="wp-icon" /></span>
				<p class="wp-t11 wp-prob w-[32px] shrink-0 font-semibold">{d.prob}</p>
				<p class="wp-t13 wp-muted w-[30px] shrink-0 text-right font-medium">{d.min}</p>
				<div class="wp-track relative h-[5px] min-w-0 flex-1 rounded-full">
					<span
						class="absolute inset-y-0 rounded-full"
						style="left:{d.left}%;width:{d.width}%;background:{d.gradient}"
					></span>
					{#if d.dot != null}
						<span class="wp-dot" style="left:{d.dot}%"></span>
					{/if}
				</div>
				<p class="wp-t13 w-[30px] shrink-0 text-right font-semibold">{d.max}</p>
			</div>
		{/each}
	</div>
{/snippet}

<div class="space-y-6" bind:clientWidth={available}>
	<div>
		<h3 class="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">Home-Bildschirm</h3>
		<div class="flex flex-wrap items-start gap-4">
			{#each families as family (family)}
				{@const size = SIZES[family]}
				{@const s = fit(size.w)}
				<figure class="m-0">
					<div style="width:{size.w * s}px;height:{size.h * s}px">
						<div
							class="wp-widget"
							data-scene={scene}
							style="width:{size.w}px;height:{size.h}px;transform:scale({s});padding:{family === 'small'
								? 14
								: family === 'extraLarge'
									? 18
									: 15}px"
						>
							{#if family === 'small'}
								<div class="flex items-center justify-between gap-1">
									{@render place(14)}
									<span style="--wp-icon:24px"><WeatherIcon code={cur.weather_code} {isDay} class="wp-icon" /></span>
								</div>
								<p class="wp-temp" style="font-size:46px">{formatTemp(cur.temperature_2m)}</p>
								<div class="flex-1"></div>
								<p class="wp-t12 truncate font-semibold">{wmo.label}</p>
								<p class="wp-t11 wp-muted font-medium">{hiLo}</p>
								<p class="wp-t10 wp-muted flex items-center gap-1 font-medium">
									<AppIcon name="drop" filled={rain.wet} class="wp-mini {rain.wet ? 'wp-prob' : ''}" />{rain.short}
								</p>
							{:else if family === 'medium'}
								{@render hero(40, 26, 14, true)}
								<div class="flex-1"></div>
								{@render hours(6, 16)}
							{:else if family === 'large'}
								{@render hero(44, 30, 15, true)}
								<p class="wp-t13 mt-1.5 truncate font-medium">{insight}</p>
								<div class="mt-2">{@render cells()}</div>
								<div class="mt-2">{@render hours(6, 17, 3)}</div>
								<div class="mt-2">{@render dayList(5, 2)}</div>
							{:else}
								<div class="flex h-full gap-[22px]">
									<div class="flex w-[330px] shrink-0 flex-col">
										{@render hero(52, 36, 16)}
										<p class="wp-t13 mt-1.5 line-clamp-2 font-medium">{insight}</p>
										<div class="mt-2.5">{@render cells()}</div>
										<div class="flex-1"></div>
										{@render hours(7, 18)}
									</div>
									<div class="flex min-w-0 flex-1 flex-col">
										<p class="wp-label"><AppIcon name="woche" class="wp-mini" />7 Tage</p>
										<div class="mt-1.5">{@render dayList(7, 6)}</div>
										<div class="flex-1"></div>
										<p class="wp-label">
											<AppIcon name="drop" filled class="wp-mini" />Regen nächste 2 Std. · {rain.short}
										</p>
										<div class="mt-1 flex h-[30px] items-end gap-1">
											{#each rainBars as bar (bar.key)}
												<span class="wp-bar flex-1" class:is-wet={bar.wet} style="height:{bar.h}%"></span>
											{/each}
										</div>
									</div>
								</div>
							{/if}
						</div>
					</div>
					<figcaption class="mt-1.5 text-sm text-muted-foreground">
						<span class="font-medium text-foreground">{size.label}</span> · {size.hint}
					</figcaption>
				</figure>
			{/each}
		</div>
	</div>

	<div>
		<h3 class="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">Sperrbildschirm</h3>
		<div class="wp-lock flex flex-wrap items-center gap-4 rounded-[1.375rem] p-4">
			<figure class="m-0 flex flex-col items-center">
				<div class="wp-acc wp-circ">
					<span style="--wp-icon:16px"><WeatherIcon code={cur.weather_code} {isDay} class="wp-icon" /></span>
					<p class="text-[18px] font-semibold leading-none">{formatTemp(cur.temperature_2m)}</p>
					{#if today}
						<p class="text-[9px] font-medium leading-none">{Math.round(today.tMin)}–{Math.round(today.tMax)}</p>
					{/if}
				</div>
				<figcaption class="mt-1.5 text-xs opacity-75">Rund</figcaption>
			</figure>
			<figure class="m-0 flex flex-col">
				<div class="wp-acc wp-rect">
					<p class="flex items-center gap-1 text-[14px] font-semibold leading-tight">
						<span style="--wp-icon:14px"><WeatherIcon code={cur.weather_code} {isDay} class="wp-icon" /></span>
						<span class="truncate">{formatTemp(cur.temperature_2m)} {placeName}</span>
					</p>
					<p class="truncate text-[12px] leading-tight">{wmo.label}</p>
					<p class="truncate text-[12px] leading-tight">{hiLo} · {rain.short}</p>
				</div>
				<figcaption class="mt-1.5 text-xs opacity-75">Rechteckig</figcaption>
			</figure>
			<figure class="m-0 flex flex-col">
				<p class="wp-inline flex items-center gap-1 text-[15px] font-medium">
					<span style="--wp-icon:15px"><WeatherIcon code={cur.weather_code} {isDay} class="wp-icon" /></span>
					{formatTemp(cur.temperature_2m)} {placeName} · {rain.short}
				</p>
				<figcaption class="mt-1.5 text-xs opacity-75">Über der Uhr</figcaption>
			</figure>
		</div>
	</div>
</div>

<style>
	.wp-widget {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: 22px;
		transform-origin: top left;
		color: #fff;
		text-shadow: 0 1px 1px rgb(0 0 0 / 0.14);
		--wp-muted: rgb(255 255 255 / 0.78);
		--wp-faint: rgb(255 255 255 / 0.22);
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
		line-height: 1.2;
	}
	.wp-widget > :global(*) {
		flex-shrink: 0;
	}
	.wp-widget[data-scene='clear'] {
		color: #3a2300;
		--wp-muted: rgb(58 35 0 / 0.72);
		--wp-faint: rgb(58 35 0 / 0.18);
		background: linear-gradient(160deg, #ffd84a 0%, #ffba2e 55%, #ff9d24 100%);
	}
	.wp-widget[data-scene='partly'] {
		background: linear-gradient(160deg, #2f7fd6 0%, #5ea3e8 55%, #86bcef 100%);
	}
	.wp-widget[data-scene='night'] {
		background: linear-gradient(160deg, #070e26 0%, #15224a 55%, #25366a 100%);
	}
	.wp-widget[data-scene='cloud'] {
		background: linear-gradient(160deg, #5d7289 0%, #7f93a8 55%, #95a7b9 100%);
	}
	.wp-widget[data-scene='rain'] {
		background: linear-gradient(160deg, #34424f 0%, #4d5e6f 55%, #65788b 100%);
	}
	.wp-widget[data-scene='storm'] {
		background: linear-gradient(160deg, #16181f 0%, #2a2f3d 55%, #434a5c 100%);
	}
	.wp-widget[data-scene='snow'] {
		background: linear-gradient(160deg, #5a7a9c 0%, #7894b1 55%, #92aac2 100%);
	}
	.wp-widget[data-scene='fog'] {
		background: linear-gradient(160deg, #5b656f 0%, #75808a 55%, #88929b 100%);
	}
	:global(.dark) .wp-widget:not([data-scene='clear']) {
		filter: brightness(0.85);
	}
	.wp-widget :global(.wp-icon) {
		width: var(--wp-icon, 18px);
		height: var(--wp-icon, 18px);
		color: currentColor;
	}
	.wp-widget :global(.wp-icon.wx-icon-clear) {
		color: #ffd60a;
	}
	.wp-widget[data-scene='clear'] :global(.wp-icon) {
		color: #3a2300;
	}
	.wp-place {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 3px;
		font-weight: 600;
	}
	.wp-place :global(.wp-loc) {
		width: 0.75em;
		height: 0.75em;
		flex-shrink: 0;
	}
	.wp-temp {
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
		margin-top: 2px;
	}
	.wp-muted {
		color: var(--wp-muted);
	}
	.wp-prob {
		color: #9ad8ff;
	}
	.wp-widget[data-scene='clear'] .wp-prob {
		color: #0a5ea8;
	}
	.wp-t10 {
		font-size: 10px;
	}
	.wp-t11 {
		font-size: 11px;
	}
	.wp-t12 {
		font-size: 12px;
	}
	.wp-t13 {
		font-size: 13px;
	}
	.wp-t14 {
		font-size: 14px;
	}
	.wp-label {
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--wp-muted);
	}
	:global(.wp-mini) {
		width: 11px;
		height: 11px;
		flex-shrink: 0;
	}
	.wp-track {
		background: var(--wp-faint);
	}
	/* Warm bars would vanish on the sunny wash. */
	.wp-widget[data-scene='clear'] .wp-track > span:first-child {
		box-shadow: 0 0 0 1px rgb(58 35 0 / 0.45);
	}
	.wp-dot {
		position: absolute;
		top: 50%;
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: #fff;
		box-shadow: 0 0 0 1px rgb(0 0 0 / 0.35);
		transform: translate(-50%, -50%);
	}
	.wp-bar {
		border-radius: 2px;
		background: var(--wp-faint);
	}
	.wp-bar.is-wet {
		background: #64d2ff;
	}
	.wp-lock {
		color: #fff;
		background: linear-gradient(160deg, #1d2b4f, #3a4f7a 60%, #6a5a8a);
	}
	.wp-acc {
		background: rgb(255 255 255 / 0.16);
		backdrop-filter: blur(8px);
	}
	.wp-circ {
		display: flex;
		width: 72px;
		height: 72px;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		border-radius: 999px;
	}
	.wp-rect {
		width: 172px;
		height: 72px;
		padding: 7px 10px;
		border-radius: 14px;
	}
	.wp-lock :global(.wp-icon) {
		width: var(--wp-icon, 16px);
		height: var(--wp-icon, 16px);
		color: #fff;
	}
</style>
