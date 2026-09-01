<script lang="ts">
	import { moodIconClass } from '$lib/colors';
	import { getWmo, weatherMood } from '$lib/wmo';

	interface Props {
		code: number;
		isDay?: boolean;
		class?: string;
		badge?: boolean;
	}

	let { code, isDay = true, class: className = 'size-8', badge = false }: Props = $props();

	const meta = $derived(getWmo(code, isDay));
	const mood = $derived(weatherMood(code, isDay));
	const colorClass = $derived(moodIconClass(mood));
</script>

{#if badge}
	<span class="wx-badge wx-chip-{mood} size-[4.5rem] rounded-[1.75rem] [html[data-chrome=desktop]_&]:size-14 [html[data-chrome=desktop]_&]:rounded-md">
		<meta.icon class="{className} {colorClass}" aria-hidden="true" />
	</span>
{:else}
	<meta.icon class="{className} {colorClass}" aria-hidden="true" />
{/if}
