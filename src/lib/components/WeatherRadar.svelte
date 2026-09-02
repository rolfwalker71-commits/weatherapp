<script lang="ts">
	import 'leaflet/dist/leaflet.css';
	import CloudDrizzle from '@lucide/svelte/icons/cloud-drizzle';
	import CloudRain from '@lucide/svelte/icons/cloud-rain';
	import CloudRainWind from '@lucide/svelte/icons/cloud-rain-wind';
	import CloudSnow from '@lucide/svelte/icons/cloud-snow';
	import Wind from '@lucide/svelte/icons/wind';
	import { onMount } from 'svelte';
	import AppIcon from './AppIcon.svelte';
	import { chromeState } from '$lib/chrome.svelte';
	import { formatHour, formatKmH, formatMm, formatPercent, windDirection } from '$lib/format';
	import { panelClass } from '$lib/platform';
	import {
		capeTone,
		fetchRadarCatalog,
		fetchWindGrid,
		infraredTileUrl,
		lightningWmsOptions,
		LIGHTNING_WMS,
		radarTileUrl,
		windTone,
		type MapBounds,
		type RadarFrame,
		type SatelliteFrame,
		type WindPoint
	} from '$lib/radar';
	import { themeState } from '$lib/theme.svelte';
	import { weatherState } from '$lib/weather.svelte';

	interface RadarApi {
		applyLayers: () => void;
		showFrame: (index: number) => void;
		showInfrared: (index: number) => void;
		refreshPlace: () => void;
		setBase: () => void;
		invalidate: () => void;
	}

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const hours = $derived((weatherState.bundle?.hours ?? []).slice(0, 12));
	const current = $derived(weatherState.bundle?.current);
	const maxPrecip = $derived(Math.max(0.2, ...hours.map((hour) => hour.precipMm)));
	let showRain = $state(true);
	let showWind = $state(true);
	let showInfrared = $state(false);
	let showCape = $state(false);
	let showLightning = $state(true);
	let lightningStatus = $state<'unknown' | 'ok' | 'down'>('unknown');
	let frames = $state<RadarFrame[]>([]);
	let infrared = $state<SatelliteFrame[]>([]);
	let host = $state('https://tilecache.rainviewer.com');
	let frameIndex = $state(0);
	let irIndex = $state(0);
	let playing = $state(true);
	let mapError = $state<string | null>(null);
	let windPoints = $state<WindPoint[]>([]);
	let mapEl = $state<HTMLDivElement | null>(null);
	let api = $state<RadarApi | null>(null);

	const activeFrame = $derived(frames[frameIndex] ?? null);
	const frameLabel = $derived(
		activeFrame
			? `${new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' }).format(new Date(activeFrame.time * 1000))}${activeFrame.kind === 'nowcast' ? ' · Prognose' : ''}`
			: '—'
	);

	const chip = $derived(
		isDesktop
			? 'min-h-10 rounded-md px-3 text-sm'
			: 'min-h-10 rounded-full px-3 text-sm'
	);

	$effect(() => {
		showRain;
		showWind;
		showInfrared;
		showCape;
		showLightning;
		lightningStatus;
		api?.applyLayers();
	});

	$effect(() => {
		api?.showFrame(frameIndex);
	});

	$effect(() => {
		api?.showInfrared(irIndex);
	});

	$effect(() => {
		weatherState.place.latitude;
		weatherState.place.longitude;
		api?.refreshPlace();
	});

	$effect(() => {
		themeState.dark;
		api?.setBase();
	});

	$effect(() => {
		if (weatherState.section === 'radar') api?.invalidate();
	});

	function onScrubStart() {
		playing = false;
	}

	onMount(() => {
		let cancelled = false;
		let map: import('leaflet').Map | undefined;
		let baseLayer: import('leaflet').TileLayer | undefined;
		let radarLayer: import('leaflet').TileLayer | undefined;
		let infraredLayer: import('leaflet').TileLayer | undefined;
		let lightningLayer: import('leaflet').TileLayer.WMS | undefined;
		let windLayer: import('leaflet').LayerGroup | undefined;
		let capeLayer: import('leaflet').LayerGroup | undefined;
		let marker: import('leaflet').CircleMarker | undefined;
		let L: typeof import('leaflet');
		let playTimer: ReturnType<typeof setInterval> | undefined;
		let catalogTimer: ReturnType<typeof setInterval> | undefined;
		let currentHost = host;
		let rainOn = true;
		let windOn = true;
		let irOn = false;
		let capeOn = false;
		let lightningOn = true;
		let lightningErrors = 0;

		function setBase() {
			if (!map || !L) return;
			baseLayer?.remove();
			baseLayer = L.tileLayer(
				themeState.dark
					? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
					: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
				{
					attribution:
						'Tiles &copy; <a href="https://www.esri.com/">Esri</a> · Radar <a href="https://www.rainviewer.com/api.html">RainViewer</a> · ' +
						LIGHTNING_WMS.attribution,
					maxZoom: 16
				}
			).addTo(map);
		}

		function showRadar(frame: RadarFrame | undefined) {
			if (!map || !L || !frame || !rainOn) {
				radarLayer?.remove();
				radarLayer = undefined;
				return;
			}
			const next = L.tileLayer(radarTileUrl(currentHost, frame.path), {
				opacity: 0.62,
				maxZoom: 7,
				maxNativeZoom: 7
			});
			next.addTo(map);
			if (radarLayer) {
				const previous = radarLayer;
				requestAnimationFrame(() => previous.remove());
			}
			radarLayer = next;
		}

		function showIr(frame: SatelliteFrame | undefined) {
			if (!map || !L || !frame || !irOn) {
				infraredLayer?.remove();
				infraredLayer = undefined;
				return;
			}
			const next = L.tileLayer(infraredTileUrl(currentHost, frame.path), {
				opacity: 0.38,
				maxZoom: 7,
				maxNativeZoom: 7
			});
			next.addTo(map);
			infraredLayer?.remove();
			infraredLayer = next;
			if (radarLayer) radarLayer.bringToFront();
		}

		function drawWind(points: WindPoint[]) {
			if (!map || !L) return;
			windLayer?.remove();
			windLayer = L.layerGroup();
			for (const point of points) {
				const tone = windTone(point.speed);
				const icon = L.divIcon({
					className: 'wx-wind-marker',
					html: `<div class="wx-wind-arrow wx-wind-${tone}" style="transform:rotate(${point.direction}deg)" title="${Math.round(point.speed)} km/h aus ${windDirection(point.direction)}"></div>`,
					iconSize: [22, 28],
					iconAnchor: [11, 14]
				});
				L.marker([point.latitude, point.longitude], { icon, interactive: false }).addTo(windLayer);
			}
			if (windOn) windLayer.addTo(map);
			drawCape(points);
		}

		function drawCape(points: WindPoint[]) {
			if (!map || !L) return;
			capeLayer?.remove();
			capeLayer = L.layerGroup();
			for (const point of points) {
				const tone = capeTone(point.cape);
				if (tone === 'none') continue;
				L.circleMarker([point.latitude, point.longitude], {
					radius: tone === 'strong' ? 10 : 7,
					weight: 0,
					fillColor: tone === 'strong' ? '#e65100' : '#f9a825',
					fillOpacity: 0.28
				}).addTo(capeLayer);
			}
			if (capeOn) capeLayer.addTo(map);
		}

		function ensureLightning() {
			if (!map || !L) return;
			if (!lightningLayer) {
				lightningLayer = L.tileLayer.wms(LIGHTNING_WMS.url, lightningWmsOptions());
				lightningLayer.on('tileerror', () => {
					lightningErrors += 1;
					if (lightningErrors >= 4) lightningStatus = 'down';
				});
				lightningLayer.on('load', () => {
					if (lightningStatus !== 'down') lightningStatus = 'ok';
				});
			}
			return lightningLayer;
		}

		function applyLayers() {
			rainOn = showRain;
			windOn = showWind;
			irOn = showInfrared;
			capeOn = showCape;
			lightningOn = showLightning;
			if (!map) return;
			if (rainOn) showRadar(frames[frameIndex]);
			else {
				radarLayer?.remove();
				radarLayer = undefined;
			}
			if (irOn) showIr(infrared[irIndex] ?? infrared[infrared.length - 1]);
			else {
				infraredLayer?.remove();
				infraredLayer = undefined;
			}
			const bolts = ensureLightning();
			if (lightningOn && lightningStatus !== 'down') bolts?.addTo(map);
			else bolts?.remove();
			if (windOn) windLayer?.addTo(map);
			else windLayer?.remove();
			if (capeOn) capeLayer?.addTo(map);
			else capeLayer?.remove();
			if (radarLayer) radarLayer.bringToFront();
			if (lightningOn) bolts?.bringToFront();
		}

		function placeMarker() {
			if (!map || !L) return;
			const { latitude, longitude } = weatherState.place;
			marker?.remove();
			marker = L.circleMarker([latitude, longitude], {
				radius: 8,
				weight: 2,
				color: themeState.dark ? '#60cdff' : '#005fb8',
				fillColor: themeState.dark ? '#60cdff' : '#005fb8',
				fillOpacity: 0.85
			}).addTo(map);
		}

		function flyToPlace() {
			if (!map || !L) return;
			const { latitude, longitude } = weatherState.place;
			map.setView([latitude, longitude], Math.max(map.getZoom() || 8, 8));
			placeMarker();
		}

		function boundsFromMap(): MapBounds | null {
			if (!map) return null;
			const box = map.getBounds();
			return {
				south: box.getSouth(),
				north: box.getNorth(),
				west: box.getWest(),
				east: box.getEast()
			};
		}

		async function loadCatalog() {
			try {
				const catalog = await fetchRadarCatalog();
				if (cancelled) return;
				currentHost = catalog.host;
				host = catalog.host;
				frames = catalog.frames;
				infrared = catalog.infrared;
				frameIndex = Math.max(0, catalog.frames.length - 1);
				irIndex = Math.max(0, catalog.infrared.length - 1);
				mapError = catalog.frames.length ? null : 'Keine Radarframes verfügbar.';
				applyLayers();
			} catch {
				if (!cancelled) mapError = 'Radar derzeit nicht erreichbar.';
			}
		}

		let windAbort: AbortController | null = null;
		let windTimer: ReturnType<typeof setTimeout> | undefined;

		async function loadWind() {
			const bounds = boundsFromMap();
			if (!bounds) return;
			windAbort?.abort();
			const controller = new AbortController();
			windAbort = controller;
			try {
				const points = await fetchWindGrid(bounds, controller.signal);
				if (cancelled || controller.signal.aborted) return;
				windPoints = points;
				drawWind(points);
			} catch (error) {
				if ((error as Error).name === 'AbortError' || cancelled) return;
				windPoints = [];
			}
		}

		function scheduleWind() {
			clearTimeout(windTimer);
			windTimer = setTimeout(() => {
				void loadWind();
			}, 380);
		}

		async function start() {
			const leaflet = await import('leaflet');
			L = leaflet.default;
			if (cancelled || !mapEl) return;

			map = L.map(mapEl, {
				zoomControl: true,
				attributionControl: true
			}).setView([weatherState.place.latitude, weatherState.place.longitude], 8);

			setBase();
			flyToPlace();
			map.on('moveend', scheduleWind);
			map.on('zoomend', scheduleWind);
			await Promise.all([loadCatalog(), loadWind()]);

			api = {
				applyLayers,
				showFrame: (index) => showRadar(frames[index]),
				showInfrared: (index) => showIr(infrared[index]),
				refreshPlace: () => {
					flyToPlace();
				},
				setBase,
				invalidate: () => {
					map?.invalidateSize();
					scheduleWind();
				}
			};

			playTimer = setInterval(() => {
				if (!playing || !rainOn || frames.length < 2) return;
				frameIndex = (frameIndex + 1) % frames.length;
			}, 520);

			catalogTimer = setInterval(() => {
				void loadCatalog();
			}, 5 * 60 * 1000);
		}

		void start();

		return () => {
			cancelled = true;
			clearInterval(playTimer);
			clearInterval(catalogTimer);
			clearTimeout(windTimer);
			windAbort?.abort();
			api = null;
			map?.off('moveend', scheduleWind);
			map?.off('zoomend', scheduleWind);
			map?.remove();
		};
	});
</script>

<section id="radar" class="{panelClass(chromeState.chrome)} overflow-hidden">
	<div class="p-5 sm:p-6">
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<h2 class="flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
					<AppIcon name="radar" class="size-5 wx-icon-rain" /> Wetterradar
				</h2>
				<p class="text-sm text-muted-foreground">
					Regen und Wind
					{#if lightningStatus !== 'down'}
						, Blitz von EUMETSAT MTG Lightning Imager
					{/if}
				</p>
			</div>
			<div class="flex flex-wrap gap-2" role="group" aria-label="Kartenlayer">
				<button
					type="button"
					aria-pressed={showRain}
					class="{chip} {showRain ? (isDesktop ? 'bg-primary/10 text-primary' : 'wx-chip-rain') : 'bg-muted text-muted-foreground'}"
					onclick={() => (showRain = !showRain)}
				>
					Regen
				</button>
				<button
					type="button"
					aria-pressed={showWind}
					class="{chip} {showWind ? (isDesktop ? 'bg-primary/10 text-primary' : 'wx-chip-cloud') : 'bg-muted text-muted-foreground'}"
					onclick={() => (showWind = !showWind)}
				>
					Wind
				</button>
				<button
					type="button"
					aria-pressed={showInfrared}
					class="{chip} {showInfrared ? (isDesktop ? 'bg-primary/10 text-primary' : 'wx-chip-night') : 'bg-muted text-muted-foreground'}"
					onclick={() => (showInfrared = !showInfrared)}
				>
					Infrarot
				</button>
				<button
					type="button"
					aria-pressed={showCape}
					class="{chip} {showCape ? (isDesktop ? 'bg-primary/10 text-primary' : 'wx-chip-storm') : 'bg-muted text-muted-foreground'}"
					onclick={() => (showCape = !showCape)}
				>
					CAPE
				</button>
				{#if lightningStatus !== 'down'}
					<button
						type="button"
						aria-pressed={showLightning}
						class="{chip} {showLightning ? (isDesktop ? 'bg-primary/10 text-primary' : 'wx-chip-storm') : 'bg-muted text-muted-foreground'}"
						onclick={() => (showLightning = !showLightning)}
					>
						Blitz
					</button>
				{/if}
			</div>
		</div>

		{#if mapError}
			<p class="mb-3 text-sm leading-snug text-muted-foreground" role="status">{mapError}</p>
		{/if}

		<div class="radar-frame overflow-hidden {isDesktop ? 'rounded-md ring-1 ring-border' : 'rounded-3xl'}">
			<div bind:this={mapEl} class="radar-map h-[22rem] w-full lg:h-[32rem]"></div>
		</div>

		<div class="mt-4 flex items-center gap-3">
			<button
				type="button"
				class="icon-btn"
				onclick={() => (playing = !playing)}
				aria-label={playing ? 'Animation anhalten' : 'Animation abspielen'}
			>
				{#if playing}
					<AppIcon name="pause" class="size-5 wx-icon-rain" />
				{:else}
					<AppIcon name="play" class="size-5 wx-icon-rain" />
				{/if}
			</button>
			<div class="min-w-0 flex-1">
				<label class="sr-only" for="radar-time">Radarzeit, halten und ziehen</label>
				<input
					id="radar-time"
					type="range"
					min="0"
					max={Math.max(0, frames.length - 1)}
					bind:value={frameIndex}
					class="w-full accent-primary"
					disabled={frames.length < 2}
					onpointerdown={onScrubStart}
					ontouchstart={onScrubStart}
					oninput={onScrubStart}
				/>
				<p class="mt-1 text-sm text-muted-foreground">{frameLabel} · Finger halten springt den Frame</p>
			</div>
		</div>
		<div class="mt-3 flex flex-wrap items-center gap-3 text-sm">
			<span class="text-muted-foreground">Legende</span>
			<span class="inline-flex items-center gap-1">
				<CloudDrizzle class="size-6 wx-icon-rain" />
				<i class="wx-leg wx-leg-1"></i> leicht
			</span>
			<span class="inline-flex items-center gap-1">
				<CloudRain class="size-6 wx-icon-rain" />
				<i class="wx-leg wx-leg-2"></i> mässig
			</span>
			<span class="inline-flex items-center gap-1">
				<CloudRainWind class="size-6 wx-icon-storm" />
				<i class="wx-leg wx-leg-3"></i> stark
			</span>
			<span class="inline-flex items-center gap-1">
				<CloudSnow class="size-6 wx-icon-snow" />
				<i class="wx-leg wx-leg-4"></i> Schnee
			</span>
		</div>
		{#if lightningStatus === 'down'}
			<p class="mt-3 text-sm leading-snug text-muted-foreground" role="status">
				Blitzschicht ausgeblendet — EUMETSAT-Feed nicht erreichbar.
			</p>
		{:else if showLightning}
			<p class="mt-3 text-sm leading-snug text-muted-foreground">
				Blitz: EUMETSAT MTG Lightning Imager (akkumulierte Flash-Fläche).
			</p>
		{/if}
		{#if weatherState.bundle?.hours[0]?.cape != null}
			<p class="mt-2 text-sm tabular-nums text-muted-foreground">
				CAPE {Math.round(weatherState.bundle.hours[0].cape)} J/kg
			</p>
		{/if}
	</div>

	<div class="grid grid-cols-1 border-t border-border lg:grid-cols-2">
		<div class="p-5 sm:p-6">
			<h3 class="mb-3 flex items-center gap-2 font-medium">
				<Wind class="size-4 wx-icon-wind" /> Wind vor Ort
			</h3>
			{#if current}
				<p class="text-3xl font-semibold tabular-nums">{formatKmH(current.wind_speed_10m)}</p>
				<p class="mt-1 text-sm text-muted-foreground">
					aus {windDirection(current.wind_direction_10m)} · Böen {formatKmH(current.wind_gusts_10m)}
				</p>
				<p class="mt-2 text-sm text-muted-foreground">
					{windPoints.length} Windpfeile im sichtbaren Ausschnitt
				</p>
			{:else}
				<p class="text-sm text-muted-foreground">Winddaten werden geladen.</p>
			{/if}
		</div>
		<div class="border-t border-border p-5 sm:p-6 lg:border-l lg:border-t-0">
			<h3 class="mb-3 font-medium">Regen nächste 12 Stunden</h3>
			{#if hours.length}
				<div class="flex items-end gap-1">
					{#each hours as hour (hour.time)}
						<div class="flex min-w-0 flex-1 flex-col items-center gap-1">
							<div class="flex h-16 w-full items-end">
								<div
									class="w-full {isDesktop ? 'rounded-sm' : 'rounded-full'} wx-bar-rain"
									style="height: {Math.max(10, (hour.precipMm / maxPrecip) * 100)}%;"
									title="{formatHour(hour.time)} · {formatMm(hour.precipMm)}"
								></div>
							</div>
							<span class="text-[0.65rem] tabular-nums text-muted-foreground">{formatHour(hour.time)}</span>
						</div>
					{/each}
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
	</div>
</section>
