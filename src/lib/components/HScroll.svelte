<script lang="ts">
	import type { Snippet } from 'svelte';
	import { chromeState } from '$lib/chrome.svelte';
	import AppIcon from './AppIcon.svelte';

	interface Props {
		class?: string;
		scrollerClass?: string;
		gap?: string;
		fade?: boolean;
		fadeFrom?: string;
		label?: string;
		children: Snippet;
	}

	let {
		class: className = '',
		scrollerClass = '',
		gap = 'gap-2',
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
		const max = Math.max(0, el.scrollWidth - el.clientWidth);
		const left = el.scrollLeft;
		canBack = max > 0 && left > 0;
		canFwd = max > 0 && left < max;
	}

	function scheduleSync(): void {
		requestAnimationFrame(sync);
	}

	function page(dir: -1 | 1): void {
		const el = scroller;
		if (!el) return;
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const cards = [...el.children] as HTMLElement[];
		const left = el.scrollLeft;
		const target =
			dir === 1
				? cards.find((card) => card.offsetLeft > left + 1)
				: [...cards].reverse().find((card) => card.offsetLeft < left - 1);
		const behavior = reduce ? 'auto' : 'smooth';
		if (target) {
			el.scrollTo({ left: target.offsetLeft, behavior });
		} else {
			const step = Math.max(el.clientWidth * 0.85, 192);
			el.scrollBy({ left: dir * step, behavior });
		}
		scheduleSync();
	}

	$effect(() => {
		const el = scroller;
		if (!el) return;
		sync();
		const ro = new ResizeObserver(scheduleSync);
		ro.observe(el);
		for (const child of el.children) {
			ro.observe(child);
		}
		el.addEventListener('scroll', sync, { passive: true });
		el.addEventListener('scrollend', sync);
		const mo = new MutationObserver(() => {
			for (const child of el.children) {
				ro.observe(child);
			}
			scheduleSync();
		});
		mo.observe(el, { childList: true, subtree: true });
		return () => {
			ro.disconnect();
			mo.disconnect();
			el.removeEventListener('scroll', sync);
			el.removeEventListener('scrollend', sync);
		};
	});
</script>

<div class="relative w-full min-w-0 max-w-full {className}">
	{#if desktop}
		<button
			type="button"
			class="icon-btn absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 lg:inline-flex {canBack
				? ''
				: 'pointer-events-none invisible'}"
			aria-label="Zurück"
			aria-hidden={!canBack}
			tabindex={canBack ? 0 : -1}
			disabled={!canBack}
			onclick={() => page(-1)}
		>
			<AppIcon name="chevronLeft" class="size-5" />
		</button>
		<button
			type="button"
			class="icon-btn absolute right-0 top-1/2 z-20 hidden -translate-y-1/2 lg:inline-flex {canFwd
				? ''
				: 'pointer-events-none invisible'}"
			aria-label="Weiter"
			aria-hidden={!canFwd}
			tabindex={canFwd ? 0 : -1}
			disabled={!canFwd}
			onclick={() => page(1)}
		>
			<AppIcon name="chevronRight" class="size-5" />
		</button>
	{/if}

	<div
		bind:this={scroller}
		class="flex w-full min-w-0 max-w-full {gap} overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden {scrollerClass}"
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
