<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import { formatTemp } from '$lib/format';
	import { nextPrecipLine } from '$lib/insights';
	import { panelClass } from '$lib/platform';
	import { goSection } from '$lib/ui.svelte';
	import { getWmo } from '$lib/wmo';
	import { weatherState } from '$lib/weather.svelte';
	import WeatherIcon from './WeatherIcon.svelte';

	interface Props {
		standalone?: boolean;
	}

	let { standalone = false }: Props = $props();

	const bundle = $derived(weatherState.bundle);
	const place = $derived(weatherState.place);
	const current = $derived(bundle?.current);
	const wmo = $derived(current ? getWmo(current.weather_code, current.is_day === 1) : null);
	const rain = $derived(bundle ? nextPrecipLine(bundle) : null);
</script>

<section class="{panelClass(chromeState.chrome)} max-lg:overflow-x-hidden p-5 sm:p-6" aria-labelledby="widget-title">
	<p class="text-sm text-muted-foreground">Kompakt</p>
	<h1 id="widget-title" class="mt-0.5 break-words text-2xl font-semibold leading-snug tracking-tight">
		{place.name}
	</h1>
	{#if current && wmo}
		<div class="mt-4 flex items-center gap-3">
			<p class="font-extrabold leading-none tracking-tight tabular-nums text-[3.5rem]">
				{formatTemp(current.temperature_2m)}
			</p>
			<WeatherIcon
				code={current.weather_code}
				isDay={current.is_day === 1}
				class="size-[3.25rem] shrink-0"
			/>
		</div>
		<p class="mt-1 text-base leading-snug">{wmo.label}</p>
		{#if rain}
			<p class="mt-2 text-base leading-snug">{rain}</p>
		{/if}
	{:else if weatherState.loading}
		<p class="mt-4 text-sm text-muted-foreground">Wetter wird geladen…</p>
	{:else}
		<p class="mt-4 text-sm text-muted-foreground">Keine aktuellen Daten.</p>
	{/if}
	{#if standalone}
		<a
			href="/#jetzt"
			class="mt-5 inline-flex min-h-12 items-center text-sm text-primary"
		>
			Zur App
		</a>
	{:else}
		<button
			type="button"
			class="mt-5 inline-flex min-h-12 items-center text-sm text-primary"
			onclick={() => goSection('jetzt')}
		>
			Zur App
		</button>
	{/if}
</section>
