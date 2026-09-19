<script lang="ts">
	import * as core from '$lib/scriptable/core.js';
	import { canvasPainter } from '$lib/scriptable/canvas';
	import { WEATHER_GLYPHS, type WeatherGlyph } from '$lib/icons/weather';
	import type { WindUnit } from '$lib/types';
	import AppIcon from './AppIcon.svelte';
	import SymbolMark from './SymbolMark.svelte';

	/** Mirrors the «Jetzt-Karte» layouts in src/lib/scriptable/wetter-widget.js. */
	interface Props {
		data: ReturnType<typeof core.normalize>;
		wind: WindUnit;
	}

	let { data, wind }: Props = $props();

	const SIZES = {
		small: { w: 158, h: 158, pad: 14, glyph: 34, label: 'Klein', hint: 'iPhone & iPad' },
		medium: { w: 338, h: 158, pad: 15, glyph: 46, label: 'Mittel', hint: 'iPhone & iPad' },
		large: { w: 338, h: 354, pad: 16, glyph: 60, label: 'Gross', hint: 'iPhone & iPad' },
		extraLarge: { w: 715, h: 338, pad: 18, glyph: 56, label: 'Extragross', hint: 'nur iPad' }
	} as const;
	type Family = keyof typeof SIZES;
	const families = Object.keys(SIZES) as Family[];

	let available = $state(338);
	const fit = (width: number) => Math.min(1, available / width);

	const cur = $derived(data.current);
	const info = $derived(core.wmo(cur.code, cur.isDay));
	const scene = $derived(core.sceneOf(cur.code, cur.isDay));
	const rain = $derived(core.rain(data));
	const insight = $derived(core.insight(data));
	const clothing = $derived(core.clothing(data));
	const metrics = $derived(core.metricsLine(data));
	const sun = $derived(core.sunLine(data));
	const range = $derived(core.todayRange(data));
	const status = $derived(core.statusLine(data, false));
	const region = $derived(core.placeRegion(data.place));
	const glyphRaw = (name: string) => WEATHER_GLYPHS[name as WeatherGlyph] ?? '';

	function hours(count: number) {
		const list = [{ key: 'now', label: 'Jetzt', t: cur.temp, code: cur.code, isDay: cur.isDay }];
		for (const h of core.upcomingHours(data, count - 1)) {
			list.push({ key: String(h.ts), label: core.hourLabel(data, h.ts), t: h.temp, code: h.code, isDay: h.isDay });
		}
		return list;
	}

	interface Day {
		date: string;
		code: number;
		min: number;
		max: number;
		prob: number | null;
	}

	function days(count: number) {
		const list: Day[] = data.days.slice(0, count);
		const lo = Math.min(...list.map((d) => d.min));
		const hi = Math.max(...list.map((d) => d.max));
		const span = Math.max(1, hi - lo);
		return list.map((d, i) => ({
			key: d.date,
			name: core.weekday(d, i),
			code: d.code,
			prob: d.prob != null && d.prob >= 20 ? `${Math.round(d.prob)}%` : '',
			min: core.temp(d.min),
			max: core.temp(d.max),
			left: ((d.min - lo) / span) * 100,
			width: Math.max(4, ((d.max - d.min) / span) * 100),
			gradient: `linear-gradient(90deg, ${core.tempHex(d.min)}, ${core.tempHex(d.max)})`,
			dot: i === 0 ? ((cur.temp - lo) / span) * 100 : null
		}));
	}

	/** Paints the same scene as the widget's background image. */
	function paint(canvas: HTMLCanvasElement, params: { family: Family; scene: string }) {
		const draw = ({ family, scene }: { family: Family; scene: string }) => {
			const s = SIZES[family];
			const ratio = window.devicePixelRatio || 1;
			canvas.width = s.w * ratio;
			canvas.height = s.h * ratio;
			const ctx = canvas.getContext('2d');
			if (!ctx) return;
			ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
			const gx = family === 'extraLarge' ? s.pad + 330 - s.glyph / 2 : s.w - s.pad - s.glyph / 2;
			core.paintScene(canvasPainter(ctx), scene, s.w, s.h, { x: gx, y: s.pad + s.glyph / 2, size: s.glyph });
		};
		draw(params);
		return { update: draw };
	}
</script>

{#snippet glyph(size: number)}
	<span class="wc-glyph" style="--g:{size}px"><SymbolMark raw={glyphRaw(info.glyph)} class="wc-glyph-svg" /></span>
{/snippet}

{#snippet top(statusSize: number, placeSize: number, regionSize: number, glyphSize: number)}
	<div class="flex items-start justify-between gap-2">
		<div class="min-w-0">
			<p class="wc-muted truncate" style="font-size:{statusSize}px">{status}</p>
			<p class="wc-place truncate" style="font-size:{placeSize}px">
				{data.place.name}{#if data.place.gps}<AppIcon name="locate" filled class="wc-loc" />{/if}
			</p>
			<p class="wc-muted truncate" style="font-size:{regionSize}px">{region}</p>
		</div>
		{@render glyph(glyphSize)}
	</div>
{/snippet}

{#snippet now(tempSize: number, labelSize: number)}
	<div class="flex items-center gap-2.5">
		<p class="wc-temp" style="font-size:{tempSize}px">{core.temp(cur.temp)}</p>
		<div class="min-w-0">
			<p class="font-medium leading-tight" style="font-size:{labelSize}px">{info.label}</p>
			<p class="wc-muted" style="font-size:{labelSize - 4}px">Gefühlt {core.temp(cur.feels)}</p>
		</div>
	</div>
{/snippet}

{#snippet strip()}
	<div class="wc-glass">
		<div class="grid grid-cols-2 gap-2.5">
			<div class="min-w-0">
				<p class="wc-k"><AppIcon name="drop" filled class="wc-mini" />Regen</p>
				<p class="truncate text-[18px] font-semibold leading-tight">{rain.headline}</p>
				<p class="wc-muted truncate text-[10px]">{rain.detail}</p>
			</div>
			<div class="min-w-0">
				<p class="wc-k"><AppIcon name="wind" class="wc-mini" />Wind</p>
				<p class="truncate text-[18px] font-semibold leading-tight">{core.wind(cur.wind, wind)}</p>
				<p class="wc-muted truncate text-[10px]">
					aus {core.compass(cur.windDir)} · Böen {core.wind(cur.gusts, wind)}
				</p>
			</div>
		</div>
		<p class="mt-1.5 truncate text-[10px]">{metrics}</p>
		{#if sun}
			<p class="mt-1 flex items-center gap-1 text-[10px]"><AppIcon name="sunrise" class="wc-mini" />{sun}</p>
		{/if}
	</div>
{/snippet}

{#snippet hourRow(count: number)}
	<div class="flex justify-between">
		{#each hours(count) as h (h.key)}
			<div class="flex flex-col items-center gap-1">
				<p class="wc-muted text-[10px] font-medium">{h.label}</p>
				<SymbolMark raw={glyphRaw(core.wmo(h.code, h.isDay).glyph)} class="size-[18px]" />
				<p class="text-[14px] font-semibold">{core.temp(h.t)}</p>
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
							class="wc-widget"
							data-scene={scene}
							style="width:{size.w}px;height:{size.h}px;transform:scale({s});padding:{size.pad}px"
						>
							<canvas class="wc-bg" use:paint={{ family, scene }} aria-hidden="true"></canvas>
							{#if family === 'small'}
								<div class="flex items-start justify-between gap-1">
									<p class="wc-place truncate text-[15px]">{data.place.name}</p>
									{@render glyph(size.glyph)}
								</div>
								<p class="wc-temp text-[48px]">{core.temp(cur.temp)}</p>
								<div class="flex-1"></div>
								<p class="truncate text-[13px] font-medium">{info.label}</p>
								<p class="wc-muted text-[11px]">{range}</p>
							{:else if family === 'medium'}
								{@render top(10, 20, 11, size.glyph)}
								<div class="flex-1"></div>
								<div class="flex items-end justify-between gap-2">
									{@render now(48, 15)}
									<div class="shrink-0 text-right text-[11px]">
										<p class="font-medium">{rain.short}</p>
										<p class="wc-muted">{range}</p>
									</div>
								</div>
							{:else if family === 'large'}
								{@render top(11, 26, 12, size.glyph)}
								<div class="mt-1">{@render now(62, 17)}</div>
								<p class="mt-1 truncate text-[14px] font-medium">{insight}</p>
								{#if clothing}<p class="truncate text-[14px]">{clothing}</p>{/if}
								<div class="mt-2">{@render strip()}</div>
								<div class="flex-1"></div>
								<p class="wc-muted text-[12px]">{range}</p>
							{:else}
								<div class="flex h-full gap-[22px]">
									<div class="flex w-[330px] shrink-0 flex-col">
										{@render top(11, 26, 12, size.glyph)}
										<div class="mt-1">{@render now(58, 17)}</div>
										<p class="mt-1 truncate text-[14px] font-medium">{insight}</p>
										{#if clothing}<p class="truncate text-[14px]">{clothing}</p>{/if}
										<div class="flex-1"></div>
										{@render strip()}
									</div>
									<div class="flex min-w-0 flex-1 flex-col gap-2">
										<div class="wc-glass">{@render hourRow(7)}</div>
										<div class="wc-glass">
											<p class="wc-k mb-1"><AppIcon name="woche" class="wc-mini" />7 Tage</p>
											<div class="flex flex-col gap-0.5">
												{#each days(6) as d (d.key)}
													<div class="flex items-center gap-1.5 text-[13px]">
														<p class="w-[42px] shrink-0 font-semibold">{d.name}</p>
														<SymbolMark raw={glyphRaw(core.wmo(d.code, true).glyph)} class="size-[17px] shrink-0" />
														<p class="wc-prob w-[32px] shrink-0 text-[11px] font-semibold">{d.prob}</p>
														<p class="wc-muted w-[30px] shrink-0 text-right">{d.min}</p>
														<div class="wc-track relative h-[5px] min-w-0 flex-1 rounded-full">
															<span
																class="absolute inset-y-0 rounded-full"
																style="left:{d.left}%;width:{d.width}%;background:{d.gradient}"
															></span>
															{#if d.dot != null}<span class="wc-dot" style="left:{d.dot}%"></span>{/if}
														</div>
														<p class="w-[30px] shrink-0 text-right font-semibold">{d.max}</p>
													</div>
												{/each}
											</div>
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
</div>

<style>
	.wc-widget {
		position: relative;
		isolation: isolate;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: 22px;
		transform-origin: top left;
		color: #fff;
		text-shadow: 0 1px 1px rgb(0 0 0 / 0.14);
		--wc-muted: rgb(255 255 255 / 0.78);
		--wc-faint: rgb(255 255 255 / 0.22);
		--wc-glass: rgb(255 255 255 / 0.16);
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
		line-height: 1.2;
	}
	.wc-widget > :global(*) {
		flex-shrink: 0;
	}
	.wc-widget[data-scene='clear'] {
		color: #3a2300;
		--wc-muted: rgb(58 35 0 / 0.72);
		--wc-faint: rgb(58 35 0 / 0.18);
		--wc-glass: rgb(255 255 255 / 0.3);
	}
	.wc-bg {
		position: absolute;
		inset: 0;
		z-index: -1;
		width: 100%;
		height: 100%;
	}
	.wc-muted {
		color: var(--wc-muted);
	}
	.wc-place {
		display: flex;
		align-items: center;
		gap: 3px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.wc-place :global(.wc-loc) {
		width: 0.6em;
		height: 0.6em;
		flex-shrink: 0;
	}
	.wc-temp {
		font-weight: 200;
		line-height: 1;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.wc-glyph {
		display: inline-flex;
		flex-shrink: 0;
		color: #fff;
	}
	.wc-widget[data-scene='night'] .wc-glyph {
		color: #f3f1ff;
	}
	.wc-glyph :global(.wc-glyph-svg) {
		width: var(--g);
		height: var(--g);
	}
	.wc-glass {
		border-radius: 14px;
		padding: 10px 12px;
		background: var(--wc-glass);
	}
	.wc-k {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: var(--wc-muted);
	}
	:global(.wc-mini) {
		width: 11px;
		height: 11px;
		flex-shrink: 0;
	}
	.wc-prob {
		color: #9ad8ff;
	}
	.wc-widget[data-scene='clear'] .wc-prob {
		color: #0a5ea8;
	}
	.wc-track {
		background: var(--wc-faint);
	}
	.wc-dot {
		position: absolute;
		top: 50%;
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: #fff;
		box-shadow: 0 0 0 1px rgb(0 0 0 / 0.35);
		transform: translate(-50%, -50%);
	}
</style>
