<script lang="ts">
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { chromeState } from '$lib/chrome.svelte';
	import { scaleFillClass } from '$lib/colors';
	import { fetchAlerts, fetchAvalanche } from '$lib/push-client';
	import { panelClass } from '$lib/platform';
	import type { AlertItem, AvalancheBulletin } from '$lib/types';
	import { weatherState } from '$lib/weather.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const shape = $derived(isDesktop ? 'rounded-md p-3' : 'rounded-[1.25rem] p-3');

	let alerts = $state<AlertItem[]>([]);
	let avalanche = $state<AvalancheBulletin | null>(null);
	let status = $state('Warnungen werden geladen…');

	$effect(() => {
		const { latitude, longitude } = weatherState.place;
		void load(latitude, longitude);
	});

	async function load(lat: number, lon: number) {
		status = 'Warnungen werden geladen…';
		const [nextAlerts, nextAvalanche] = await Promise.all([fetchAlerts(lat, lon), fetchAvalanche(lat, lon)]);
		alerts = nextAlerts;
		avalanche = nextAvalanche;
		status = nextAlerts.length ? '' : 'Keine aktiven Warnungen oder Feed nicht erreichbar.';
	}

	function tone(severity: AlertItem['severity']) {
		if (severity === 'extreme' || severity === 'severe') return 'bad';
		if (severity === 'moderate') return 'warn';
		if (severity === 'minor') return 'fair';
		return 'neutral';
	}

</script>

<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
	<h2 class="flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
		<TriangleAlert class="size-5 wx-icon-storm" /> Warnungen
	</h2>
	<p class="mb-4 text-sm text-muted-foreground">Meteoalarm (CAP/ATOM) und SLF — ohne Schätzwerte</p>

	{#if avalanche}
		<div class="{shape} mb-3 {avalanche.available ? 'wx-scale-warn' : 'wx-scale-neutral'}">
			<p class="text-sm opacity-80">Lawinenstufe SLF</p>
			<p class="font-medium leading-snug">{avalanche.label}</p>
			<p class="mt-1 text-sm leading-snug opacity-80">{avalanche.note}</p>
		</div>
	{/if}

	{#if alerts.length}
		<ul class="space-y-2">
			{#each alerts as alert (alert.id)}
				<li class="{shape} {scaleFillClass(tone(alert.severity))}">
					<p class="font-medium leading-snug">{alert.event}</p>
					<p class="mt-1 text-sm leading-snug opacity-80">{alert.headline}</p>
					{#if alert.area}
						<p class="mt-1 text-sm opacity-75">{alert.area} · {alert.source}</p>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm leading-snug text-muted-foreground" role="status">{status}</p>
	{/if}
</section>
