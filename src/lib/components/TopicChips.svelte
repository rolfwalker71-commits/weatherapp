<script lang="ts">
	import { TOPIC_CHIPS } from '$lib/nav';
	import { openTopic, uiState } from '$lib/ui.svelte';
	import AppIcon from './AppIcon.svelte';
</script>

<nav aria-label="Themen" class="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
</nav>
