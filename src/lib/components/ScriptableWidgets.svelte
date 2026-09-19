<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import { listTileClass } from '$lib/platform';
	import { buildWidgetScript, widgetScriptName, type WidgetStyle } from '$lib/scriptable';
	import * as core from '$lib/scriptable/core.js';
	import { WEATHER_GLYPHS } from '$lib/icons/weather';
	import { APP_ORIGIN } from '$lib/platform';
	import { loadHomePlace, samePlace } from '$lib/storage';
	import type { Place } from '$lib/types';
	import { unitsState } from '$lib/units.svelte';
	import { favoriteKey, favoriteWeather, weatherState } from '$lib/weather.svelte';
	import AppIcon from './AppIcon.svelte';
	import ScriptableCardPreviews from './ScriptableCardPreviews.svelte';
	import ScriptablePreviews from './ScriptablePreviews.svelte';

	interface Choice {
		id: string;
		label: string;
		place: Place | null;
	}

	const isDesktop = $derived(chromeState.chrome === 'desktop');

	const choices = $derived.by(() => {
		const list: Choice[] = [{ id: 'gps', label: 'Standort (GPS)', place: null }];
		const add = (place: Place | null) => {
			if (!place || list.some((c) => c.place && samePlace(c.place, place))) return;
			list.push({ id: favoriteKey(place), label: place.name, place });
		};
		add(weatherState.place);
		add(loadHomePlace());
		weatherState.favorites.forEach(add);
		return list;
	});

	let selectedId = $state<string | null>(null);
	const selected = $derived(
		choices.find((c) => c.id === selectedId) ?? choices[1] ?? choices[0]
	);
	const styles: { id: WidgetStyle; label: string }[] = [
		{ id: 'card', label: 'Jetzt-Karte' },
		{ id: 'classic', label: 'Klassisch' }
	];
	let style = $state<WidgetStyle>('card');
	const script = $derived(buildWidgetScript({ place: selected.place, wind: unitsState.wind, style }));
	const scriptName = $derived(widgetScriptName(selected.place, style));

	/** Same request and evaluation as the script itself (card preview and detail view). */
	let coreData = $state<ReturnType<typeof core.normalize> | null>(null);
	$effect(() => {
		const place = selected.place ?? weatherState.place;
		const gps = !selected.place;
		const controller = new AbortController();
		fetch(core.forecastUrl(place), { signal: controller.signal })
			.then((response) => response.json())
			.then((raw) => {
				if (!raw?.current) return;
				coreData = core.normalize(raw, {
					name: place.name,
					latitude: place.latitude,
					longitude: place.longitude,
					admin1: place.admin1,
					country: place.country,
					gps
				});
			})
			.catch(() => {
				/* preview only */
			});
		return () => controller.abort();
	});
	const detail = $derived(
		coreData ? core.detailHtml(coreData, WEATHER_GLYPHS, { wind: unitsState.wind, appUrl: APP_ORIGIN }) : null
	);
	let detailWidth = $state(390);
	const detailScale = $derived(Math.min(1, detailWidth / 390));

	/** Preview data: the chosen place's live bundle (Jetzt or Favoriten), else what Jetzt shows. */
	const preview = $derived.by(() => {
		const place = selected.place;
		if (place) {
			if (weatherState.bundle && samePlace(weatherState.bundle.place, place)) return weatherState.bundle;
			return favoriteWeather.bundles[favoriteKey(place)] ?? null;
		}
		return weatherState.bundle;
	});
	const previewName = $derived(selected.place?.name ?? preview?.place.name ?? 'Standort');

	let status = $state<string | null>(null);
	let statusTimer: ReturnType<typeof setTimeout> | undefined;
	function flash(message: string) {
		status = message;
		clearTimeout(statusTimer);
		statusTimer = setTimeout(() => (status = null), 3500);
	}

	/** Older WebViews without the async clipboard API. */
	function legacyCopy(text: string): boolean {
		const area = document.createElement('textarea');
		area.value = text;
		area.setAttribute('readonly', '');
		area.style.position = 'fixed';
		area.style.opacity = '0';
		document.body.appendChild(area);
		area.select();
		area.setSelectionRange(0, text.length);
		let ok = false;
		try {
			ok = document.execCommand('copy');
		} catch {
			ok = false;
		}
		area.remove();
		return ok;
	}

	async function copyScript() {
		let ok = false;
		try {
			await navigator.clipboard.writeText(script);
			ok = true;
		} catch {
			ok = legacyCopy(script);
		}
		flash(
			ok
				? 'Skript kopiert — jetzt in Scriptable einfügen.'
				: 'Kopieren nicht möglich. Bitte «Als Datei» verwenden.'
		);
	}

	async function shareFile() {
		const file = new File([script], `${scriptName}.js`, { type: 'text/javascript' });
		const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
		if (nav.canShare?.({ files: [file] })) {
			try {
				await navigator.share({ files: [file], title: scriptName });
				return;
			} catch (err) {
				if ((err as DOMException)?.name === 'AbortError') return;
			}
		}
		const url = URL.createObjectURL(file);
		const a = document.createElement('a');
		a.href = url;
		a.download = file.name;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		flash(`${file.name} gesichert.`);
	}
</script>

<section aria-labelledby="scriptable-title">
	<h2 id="scriptable-title" class="mb-1 flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
		<AppIcon name="jetzt" class="size-5 wx-icon-rain" /> Scriptable-Widgets
	</h2>
	<p class="mb-4 text-sm leading-snug text-muted-foreground">
		Home- und Sperrbildschirm-Widgets für iPhone und iPad über die kostenlose App
		<a
			class="text-primary underline-offset-2 hover:underline"
			href="https://apps.apple.com/app/scriptable/id1405459188"
			target="_blank"
			rel="noreferrer">Scriptable</a
		>. Das Skript holt die Daten direkt bei Open-Meteo — ohne Konto.
	</p>

	<h3 class="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">Stil</h3>
	<ul class="wx-segmented mb-4 flex flex-wrap gap-2">
		{#each styles as option (option.id)}
			<li>
				<button
					type="button"
					class="min-h-11 px-3 text-sm {listTileClass(chromeState.chrome, style === option.id)}"
					aria-pressed={style === option.id}
					onclick={() => (style = option.id)}
				>
					{option.label}
				</button>
			</li>
		{/each}
	</ul>

	<h3 class="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">Ort</h3>
	<ul class="wx-segmented mb-4 flex flex-wrap gap-2">
		{#each choices as choice (choice.id)}
			<li>
				<button
					type="button"
					class="inline-flex min-h-11 items-center gap-1.5 px-3 text-sm {listTileClass(
						chromeState.chrome,
						selected.id === choice.id
					)}"
					aria-pressed={selected.id === choice.id}
					onclick={() => (selectedId = choice.id)}
				>
					{#if !choice.place}<AppIcon name="locate" class="size-4" />{/if}
					{choice.label}
				</button>
			</li>
		{/each}
	</ul>

	<div class="mb-2 flex flex-wrap gap-2">
		<button
			type="button"
			class="inline-flex min-h-12 items-center gap-2 px-4 text-sm font-medium {isDesktop
				? 'rounded-md bg-primary text-on-primary'
				: 'rounded-full bg-primary text-on-primary'}"
			onclick={copyScript}
		>
			Skript kopieren
		</button>
		<button
			type="button"
			class="inline-flex min-h-12 items-center gap-2 px-4 text-sm {isDesktop
				? 'rounded-md bg-primary/10 text-primary'
				: 'rounded-full bg-secondary text-primary'}"
			onclick={shareFile}
		>
			Als Datei
		</button>
	</div>
	<p class="mb-4 min-h-5 text-sm text-muted-foreground" role="status">{status ?? ''}</p>

	<details class="mb-5 rounded-[1.25rem] bg-muted px-4 py-3 text-sm leading-relaxed">
		<summary class="cursor-pointer font-medium">So richtest du es ein</summary>
		<ol class="mt-2 list-decimal space-y-1 pl-5">
			<li>Scriptable aus dem App Store laden.</li>
			<li>
				Skript kopieren, in Scriptable auf <strong>+</strong> tippen, einfügen und oben als
				<strong>{scriptName}</strong> benennen. (Oder «Als Datei» im Ordner iCloud Drive › Scriptable sichern.)
			</li>
			<li>
				Home-Bildschirm lange drücken › <strong>Bearbeiten</strong> › <strong>Widget hinzufügen</strong> ›
				Scriptable, Grösse wählen (Klein, Mittel, Gross, auf dem iPad auch Extragross).
			</li>
			<li>Widget lange drücken › <strong>Widget bearbeiten</strong> › Script: {scriptName}.</li>
			<li>
				Optional unter <strong>Parameter</strong>, mehrere durch Komma getrennt: <code>karte</code> oder
				<code>klassisch</code> für den Stil, <code>gps</code> für den aktuellen Standort oder ein Ortsname wie
				<code>Zürich</code>. So reicht ein Skript für mehrere Widgets, z. B. <code>klassisch, Zürich</code>.
			</li>
			<li>
				Antippen öffnet die animierte Detailansicht in Scriptable. Web-Apps auf dem Home-Bildschirm lassen sich
				von iOS aus nicht per Link öffnen.
			</li>
			<li>Sperrbildschirm: gleich, beim Anpassen des Sperrbildschirms Scriptable wählen.</li>
		</ol>
	</details>

	{#if style === 'card'}
		{#if coreData}
			<ScriptableCardPreviews data={coreData} wind={unitsState.wind} />
			<p class="mt-3 text-sm text-muted-foreground">
				Widgets zeigen ein Standbild der Wetterszene, iOS spielt in Widgets keine Animationen ab. Animiert ist die
				Detailansicht beim Antippen.
			</p>
		{:else}
			<p class="text-sm text-muted-foreground">Vorschau wird geladen …</p>
		{/if}
	{:else if preview}
		<ScriptablePreviews bundle={preview} placeName={previewName} gps={!selected.place} />
	{:else}
		<p class="text-sm text-muted-foreground">
			Für die Vorschau zuerst {selected.label} öffnen, damit Wetterdaten da sind.
		</p>
	{/if}

	{#if detail}
		<h3 class="mb-2 mt-6 text-sm font-medium uppercase tracking-wide text-muted-foreground">
			Beim Antippen · Detailansicht
		</h3>
		<div class="max-w-[390px]" bind:clientWidth={detailWidth}>
			<div class="overflow-hidden rounded-[1.5rem] ring-1 ring-border" style="height:{720 * detailScale}px">
				<iframe
					title="Detailansicht in Scriptable"
					srcdoc={detail}
					sandbox="allow-same-origin"
					class="origin-top-left border-0"
					style="width:390px;height:720px;transform:scale({detailScale})"
				></iframe>
			</div>
		</div>
	{/if}
</section>
