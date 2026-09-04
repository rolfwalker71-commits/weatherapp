<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import AppIcon from './AppIcon.svelte';
	import { precipNowSummary } from '$lib/insights';
	import { panelClass } from '$lib/platform';
	import { weatherState } from '$lib/weather.svelte';

	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

	const summary = $derived(
		weatherState.bundle ? precipNowSummary(weatherState.bundle) : null
	);
</script>

{#if summary}
	<section class="{panelClass(chromeState.chrome)} {compact ? 'p-4' : 'p-5 sm:p-6'}">
		<h2
			class="flex min-w-0 items-center gap-2 {compact
				? 'text-base'
				: 'text-xl'} font-semibold leading-snug tracking-tight"
		>
			<AppIcon name="nowcast" class="size-6 wx-icon-storm" />
			Regen jetzt
		</h2>
		<p class="mt-2 text-2xl font-semibold tabular-nums leading-snug">{summary.headline}</p>
		{#if summary.detail}
			<p class="mt-1 break-words text-sm leading-snug text-muted-foreground">{summary.detail}</p>
		{/if}
	</section>
{/if}
