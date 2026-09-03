<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import { formatTemp, formatTime, formatWind, windDirection } from '$lib/format';
	import { panelClass } from '$lib/platform';
	import { fetchPassObservations } from '$lib/station';
	import type { PassObservation } from '$lib/types';
	import { unitsState } from '$lib/units.svelte';
	import AppIcon from './AppIcon.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const shape = $derived(isDesktop ? 'rounded-md p-3 ring-1 ring-border' : 'rounded-[1.25rem] p-3 bg-muted');
	let passes = $state<PassObservation[]>([]);
	let loaded = $state(false);

	$effect(() => {
		void load();
	});

	async function load() {
		passes = await fetchPassObservations();
		loaded = true;
	}
</script>

{#if loaded && passes.length}
	<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
		<h2 class="flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
			<AppIcon name="berge" class="size-6 wx-icon-snow" /> Pässe
		</h2>
		<p class="mt-1 text-sm text-muted-foreground">SwissMetNet, aktuelle Messung</p>
		<div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
			{#each passes as pass (pass.id)}
				<div class="{shape}">
					<p class="break-words font-medium leading-snug">{pass.name}</p>
					<p class="text-sm text-muted-foreground">{pass.id}</p>
					{#if pass.temperature != null}
						<p class="mt-1 text-lg font-semibold tabular-nums">{formatTemp(pass.temperature)}</p>
					{/if}
					{#if pass.windKmh != null}
						<p class="text-sm text-muted-foreground">
							{formatWind(pass.windKmh, unitsState.wind)}
							{#if pass.windDir != null}
								{windDirection(pass.windDir)}
							{/if}
						</p>
					{/if}
					{#if pass.observedAt}
						<p class="mt-1 text-sm text-muted-foreground">{formatTime(pass.observedAt)}</p>
					{/if}
				</div>
			{/each}
		</div>
	</section>
{/if}
