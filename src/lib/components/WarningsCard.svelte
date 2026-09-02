<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import AppIcon from './AppIcon.svelte';
	import { scaleFillClass } from '$lib/colors';
	import { fetchAlerts, fetchAvalanche } from '$lib/push-client';
	import { panelClass } from '$lib/platform';
	import type { AlertItem, AvalancheBulletin } from '$lib/types';
	import { weatherState } from '$lib/weather.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const shape = $derived(isDesktop ? 'rounded-md p-3' : 'rounded-[1.25rem] p-3');

	let alerts = $state<AlertItem[]>([]);
	let avalanche = $state<AvalancheBulletin | null>(null);

	$effect(() => {
		const { latitude, longitude } = weatherState.place;
		void load(latitude, longitude);
	});

	async function load(lat: number, lon: number) {
		const [nextAlerts, nextAvalanche] = await Promise.all([fetchAlerts(lat, lon), fetchAvalanche(lat, lon)]);
		alerts = nextAlerts;
		avalanche = nextAvalanche.available && nextAvalanche.level != null ? nextAvalanche : null;
	}

	function tone(severity: AlertItem['severity']) {
		if (severity === 'extreme' || severity === 'severe') return 'bad';
		if (severity === 'moderate') return 'warn';
		if (severity === 'minor') return 'fair';
		return 'neutral';
	}

	const visible = $derived(alerts.length > 0 || avalanche != null);
</script>

{#if visible}
	<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6" role="status">
		<h2 class="flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
			<AppIcon name="warning" class="size-6 wx-icon-storm" /> Warnungen
		</h2>

		{#if avalanche}
			<div class="{shape} mb-3 wx-scale-warn">
				<p class="text-sm opacity-80">{avalanche.source}</p>
				<p class="font-medium leading-snug">{avalanche.label}</p>
				{#if avalanche.note}
					<p class="mt-1 text-sm leading-snug opacity-80">{avalanche.note}</p>
				{/if}
			</div>
		{/if}

		{#if alerts.length}
			<ul class="mt-3 space-y-2">
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
		{/if}
	</section>
{/if}
