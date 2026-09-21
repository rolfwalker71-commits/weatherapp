<script lang="ts">
	interface Props {
		/** 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
		cycle: number;
		/** Southern hemisphere sees the disk rotated by 180°. */
		southern?: boolean;
		class?: string;
		title?: string;
	}

	let { cycle, southern = false, class: className = '', title }: Props = $props();

	const R = 48;
	const C = 50;

	/** Lit area: bright limb (semicircle) closed by the elliptical terminator. */
	const litPath = $derived.by(() => {
		const p = ((cycle % 1) + 1) % 1;
		const rx = Math.abs(Math.cos(2 * Math.PI * p)) * R;
		const waxing = p < 0.5;
		const limbSweep = waxing ? 1 : 0;
		const termSweep = waxing ? (p < 0.25 ? 0 : 1) : p > 0.75 ? 1 : 0;
		return `M ${C} ${C - R} A ${R} ${R} 0 0 ${limbSweep} ${C} ${C + R} A ${rx.toFixed(3)} ${R} 0 0 ${termSweep} ${C} ${C - R} Z`;
	});
	const nearlyNew = $derived(Math.min(cycle % 1, 1 - (cycle % 1)) < 0.012);
</script>

<svg
	viewBox="0 0 100 100"
	class="moon-phase {className}"
	role={title ? 'img' : undefined}
	aria-hidden={title ? undefined : 'true'}
	aria-label={title}
>
	<g transform={southern ? `rotate(180 ${C} ${C})` : undefined}>
		<circle cx={C} cy={C} r={R} class="moon-phase-dark" />
		{#if !nearlyNew}
			<path d={litPath} class="moon-phase-lit" />
		{/if}
		<circle cx={C} cy={C} r={R} class="moon-phase-rim" />
	</g>
</svg>

<style>
	.moon-phase {
		display: block;
		flex-shrink: 0;
		overflow: visible;
	}
	.moon-phase-dark {
		fill: currentColor;
		opacity: 0.16;
	}
	.moon-phase-lit {
		fill: #f3e9c6;
		filter: drop-shadow(0 0 3px rgb(243 233 198 / 0.55));
	}
	.moon-phase-rim {
		fill: none;
		stroke: currentColor;
		stroke-opacity: 0.22;
		stroke-width: 1.5;
	}
</style>
