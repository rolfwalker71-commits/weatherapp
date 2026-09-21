<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import { moonView } from '$lib/moon-view';
	import { panelClass } from '$lib/platform';
	import { clockState, weatherState } from '$lib/weather.svelte';
	import AppIcon from './AppIcon.svelte';
	import MoonPhase from './MoonPhase.svelte';

	interface Props {
		onOpen?: () => void;
	}

	let { onOpen }: Props = $props();

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const bundle = $derived(weatherState.bundle);
	/** Recomputed once a minute with the shared clock. */
	const moon = $derived(bundle ? moonView(bundle, new Date(clockState.now)) : null);
	const ageLabel = $derived.by(() => {
		const days = Math.floor(moon?.info.phase ?? 0);
		return `${days} ${days === 1 ? 'Tag' : 'Tage'} alt`;
	});
	const tile =$derived(isDesktop ? 'rounded-md p-3 ring-1 ring-border' : 'rounded-[1.25rem] p-3 bg-muted');
</script>

{#if moon}
	<section class="{panelClass(chromeState.chrome)} relative p-5 sm:p-6" aria-labelledby="moon-title">
		{#if onOpen}
			<button
				type="button"
				class="absolute inset-0 z-[1] rounded-[inherit]"
				onclick={onOpen}
				aria-label="Mondkalender öffnen"
			></button>
		{/if}
		<div class="flex items-center justify-between gap-3">
			<h2 id="moon-title" class="flex items-center gap-2 text-xl font-semibold leading-snug tracking-tight">
				<AppIcon name="moon" class="size-6 wx-icon-night" /> Mond
			</h2>
			{#if onOpen}
				<AppIcon name="chevronRight" class="size-5 opacity-60" />
			{/if}
		</div>

		<div class="mt-3 flex items-center gap-4">
			<MoonPhase cycle={moon.info.cycle} southern={moon.southern} class="size-16 sm:size-20" />
			<div class="min-w-0">
				<p class="break-words text-lg font-semibold leading-snug">{moon.info.label}</p>
				<p class="text-sm leading-snug text-muted-foreground tabular-nums">
					{Math.round(moon.info.illumination * 100)} % beleuchtet · {ageLabel}
				</p>
			</div>
		</div>

		<div class="mt-4 grid grid-cols-2 gap-2">
			{#each moon.today.events as event (event.kind)}
				<div class={tile}>
					<p class="text-sm opacity-80">Mond{event.label.toLowerCase()}</p>
					<p class="mt-1 text-xl font-semibold tabular-nums">{event.time}</p>
				</div>
			{/each}
			{#if moon.today.note}
				<div class="{tile} {moon.today.events.length ? '' : 'col-span-2'}">
					<p class="text-sm leading-snug opacity-80">{moon.today.note}</p>
				</div>
			{/if}
			<div class={tile}>
				<p class="text-sm opacity-80">Nächster Vollmond</p>
				<p class="mt-1 font-semibold tabular-nums">{moon.nextFull}</p>
			</div>
			<div class={tile}>
				<p class="text-sm opacity-80">Nächster Neumond</p>
				<p class="mt-1 font-semibold tabular-nums">{moon.nextNew}</p>
			</div>
		</div>
	</section>
{/if}
