<script lang="ts">
	import { TOPIC_CHIPS } from '$lib/nav';
	import { openTopic, uiState } from '$lib/ui.svelte';
	import AppIcon from './AppIcon.svelte';
	import HScroll from './HScroll.svelte';
</script>

<nav class="w-full min-w-0 max-w-full max-lg:overflow-x-hidden" aria-label="Themen">
	<HScroll fade fadeFrom="from-background" scrollerClass="pb-1">
		{#each TOPIC_CHIPS as chip (chip.id)}
			<button
				type="button"
				class="wx-topic-chip"
				aria-pressed={uiState.topic === chip.id}
				onclick={() => openTopic(chip.id)}
			>
				<AppIcon name={chip.icon} filled={uiState.topic === chip.id} class="size-4 {chip.iconClass}" />
				{chip.label}
			</button>
		{/each}
	</HScroll>
</nav>
