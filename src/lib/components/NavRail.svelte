<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import { isMehrSection, MEHR_GROUPS, NAV_ITEMS, RAIL_ITEMS, navItemCurrent, type MehrId, type SectionId } from '$lib/nav';
	import { goSection, openTopic, uiState } from '$lib/ui.svelte';
	import { weatherState } from '$lib/weather.svelte';
	import AppIcon from './AppIcon.svelte';

	function go(id: SectionId) {
		goSection(id);
	}

	/** iPad sidebar: the tab sections plus everything from "Mehr", grouped like an iPadOS sidebar. */
	const sidebarGroups = [
		{ title: 'Wetter', items: NAV_ITEMS.filter((item) => item.id !== 'mehr').map((item) => ({ id: item.id as MehrId | SectionId, label: item.label, icon: item.icon })) },
		...MEHR_GROUPS.map((group) => ({
			title: group.title === 'Wetter' ? 'Themen' : group.title,
			items: group.items.map((item) => ({ id: item.id as MehrId | SectionId, label: item.label, icon: item.icon }))
		}))
	];

	function openSidebarItem(id: MehrId | SectionId) {
		if (NAV_ITEMS.some((item) => item.id === id) || isMehrSection(id as MehrId)) {
			goSection(id as SectionId);
			return;
		}
		openTopic(id as Exclude<MehrId, 'radar' | 'favoriten' | 'einstellungen' | 'vergleich'>);
	}

	function sidebarCurrent(id: MehrId | SectionId): boolean {
		return uiState.topic ? uiState.topic === id : weatherState.section === id;
	}
</script>

{#if chromeState.chrome === 'ios'}
<nav class="wx-sidebar" aria-label="Hauptnavigation">
	<p class="wx-sidebar-title">Wetter</p>
	{#each sidebarGroups as group (group.title)}
		<section>
			<h2 class="wx-sidebar-heading">{group.title}</h2>
			<ul>
				{#each group.items as item (item.id)}
					<li>
						<button
							type="button"
							class="wx-sidebar-item"
							aria-current={sidebarCurrent(item.id) ? 'page' : undefined}
							onclick={() => openSidebarItem(item.id)}
						>
							<AppIcon name={item.icon} filled={sidebarCurrent(item.id)} class="size-5" />
							<span>{item.label}</span>
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</nav>
{:else}

<nav
	class="sticky top-[4.25rem] hidden h-[calc(100dvh-4.25rem)] w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-card/80 p-3 lg:flex"
	aria-label="Hauptnavigation"
>
	{#each RAIL_ITEMS as item}
		{@const current = navItemCurrent(item.id, weatherState.section, 'rail')}
		<button
			type="button"
			class="relative flex min-h-12 items-center gap-3 rounded-md px-3 text-left {current
				? 'bg-primary/10 text-primary'
				: 'text-foreground hover:bg-muted'}"
			aria-current={current ? 'page' : undefined}
			onclick={() => go(item.id)}
		>
			{#if current}
				<span class="absolute inset-y-2 left-0 w-0.5 bg-primary" aria-hidden="true"></span>
			{/if}
			<AppIcon name={item.icon} filled={current} class="size-5 {item.iconClass}" />
			<span class="leading-snug">{item.railLabel}</span>
		</button>
	{/each}
</nav>
{/if}
