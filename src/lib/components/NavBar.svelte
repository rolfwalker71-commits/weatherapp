<script lang="ts">
	import { onMount } from 'svelte';
	import { NAV_ITEMS, navItemCurrent, type SectionId } from '$lib/nav';
	import { dockBarClass } from '$lib/platform';
	import { goSection } from '$lib/ui.svelte';
	import { weatherState } from '$lib/weather.svelte';
	import AppIcon from './AppIcon.svelte';

	let dockEl: HTMLElement | undefined = $state();

	function go(id: SectionId) {
		goSection(id);
	}

	onMount(() => {
		const el = dockEl;
		if (!el) return;
		const root = document.documentElement;
		const syncNavHeight = () => {
			const height = el.getBoundingClientRect().height;
			if (height > 0) root.style.setProperty('--wx-nav-h', `${Math.ceil(height)}px`);
		};
		syncNavHeight();
		const ro = new ResizeObserver(syncNavHeight);
		ro.observe(el);
		return () => {
			ro.disconnect();
			root.style.removeProperty('--wx-nav-h');
		};
	});
</script>

<nav bind:this={dockEl} class="wx-dock {dockBarClass()}" aria-label="Bereiche">
	<!-- pt for icon breathing room; pb above home-indicator so labels never sit on it -->
	<ul
		class="grid w-full max-w-full grid-cols-5 pt-1"
		style="padding-bottom: calc(0.375rem + env(safe-area-inset-bottom, 0px));"
	>
		{#each NAV_ITEMS as item}
			{@const current = navItemCurrent(item.id, weatherState.section, 'dock')}
			<li class="min-w-0">
				<button
					type="button"
					class="flex min-h-12 w-full min-w-0 flex-col items-center justify-center gap-0 px-0.5 py-0.5"
					aria-current={current ? 'page' : undefined}
					onclick={() => go(item.id)}
				>
					<span
						class="flex size-8 items-center justify-center rounded-full {current
							? item.pill
							: 'text-muted-foreground'}"
					>
						<AppIcon name={item.icon} filled={current} class="size-5 {item.iconClass}" />
					</span>
					<span
						class="mt-0.5 max-w-full text-center text-xs leading-none {current
							? item.iconClass
							: 'text-muted-foreground'}"
					>
						{item.label}
					</span>
				</button>
			</li>
		{/each}
	</ul>
</nav>
