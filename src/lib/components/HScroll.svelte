<script lang="ts">
	import type { Snippet } from 'svelte';
	import { chromeState } from '$lib/chrome.svelte';
	import AppIcon from './AppIcon.svelte';

	interface Props {
		class?: string;
		scrollerClass?: string;
		fade?: boolean;
		fadeFrom?: string;
		label?: string;
		children: Snippet;
	}

	let {
		class: className = '',
		scrollerClass = '',
		fade = false,
		fadeFrom = 'from-card',
		label,
		children
	}: Props = $props();

	let scroller = $state<HTMLDivElement | null>(null);
	let canBack = $state(false);
	let canFwd = $state(false);

	const desktop = $derived(chromeState.chrome === 'desktop');

	function sync(): void {
		const el = scroller;
		if (!el) {
			canBack = false;
			canFwd = false;
			return;
		}
		const max = el.scrollWidth - el.clientWidth;
		canBack = max > 2 && el.scrollLeft > 2;
		canFwd = max > 2 && el.scrollLeft < max - 2;
	}

	function page(dir: -1 | 1): void {
		const el = scroller;
		if (!el) return;
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const step = Math.max(el.clientWidth * 0.85, 192);
		el.scrollBy({ left: dir * step, behavior: reduce ? 'auto' : 'smooth' });
	}

	$effect(() => {
		const el = scroller;
		if (!el) return;
		sync();
		const ro = new ResizeObserver(() => sync());
		ro.observe(el);
		el.addEventListener('scroll', sync, { passive: true });
		const mo = new MutationObserver(() => sync());
		mo.observe(el, { childList: true, subtree: true });
		return () => {
			ro.disconnect();
			mo.disconnect();
			el.removeEventListener('scroll', sync);
		};
	});
</script>

<div class="relative {className}">
	{#if desktop}
		{#if canBack}
			<button
				type="button"
				class="icon-btn absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 lg:inline-flex"
				aria-label="Zurück"
				onclick={() => page(-1)}
			>
				<AppIcon name="chevronLeft" class="size-5" />
			</button>
		{/if}
		{#if canFwd}
			<button
				type="button"
				class="icon-btn absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 lg:inline-flex"
				aria-label="Weiter"
				onclick={() => page(1)}
			>
				<AppIcon name="chevronRight" class="size-5" />
			</button>
		{/if}
	{/if}

	<div
		bind:this={scroller}
		class="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden {scrollerClass}"
		role={label ? 'group' : undefined}
		aria-label={label}
	>
		{@render children()}
	</div>

	{#if fade}
		<div
			class="pointer-events-none absolute inset-y-1 right-0 w-7 bg-gradient-to-l {fadeFrom} {desktop
				? 'lg:hidden'
				: ''}"
			aria-hidden="true"
		></div>
	{/if}
</div>
