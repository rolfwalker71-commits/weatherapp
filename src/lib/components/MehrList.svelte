<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import { isMehrSection, MEHR_GROUPS } from '$lib/nav';
	import { listTileClass } from '$lib/platform';
	import { goSection, openTopic, uiState } from '$lib/ui.svelte';
	import { weatherState } from '$lib/weather.svelte';
	import AppIcon from './AppIcon.svelte';

	function openItem(id: (typeof MEHR_GROUPS)[number]['items'][number]['id']) {
		if (isMehrSection(id)) {
			goSection(id);
			return;
		}
		openTopic(id);
	}

	function selected(id: (typeof MEHR_GROUPS)[number]['items'][number]['id']): boolean {
		if (isMehrSection(id)) return weatherState.section === id;
		return uiState.topic === id;
	}
</script>

<div class="space-y-6">
	{#each MEHR_GROUPS as group (group.title)}
		<section>
			<h2 class="mb-2 px-1 text-sm font-medium text-muted-foreground">{group.title}</h2>
			<ul class="space-y-2">
				{#each group.items as item (item.id)}
					<li>
						<button
							type="button"
							class="flex min-h-12 w-full items-center gap-3 px-4 text-left {listTileClass(
								chromeState.chrome,
								selected(item.id)
							)}"
							aria-current={selected(item.id) ? 'page' : undefined}
							onclick={() => openItem(item.id)}
						>
							<span
								class="flex size-10 items-center justify-center rounded-full bg-muted [html[data-chrome=desktop]_&]:size-8 [html[data-chrome=desktop]_&]:rounded-md"
							>
								<AppIcon name={item.icon} class="size-5 {item.iconClass}" />
							</span>
							<span class="break-words leading-snug">{item.label}</span>
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>
