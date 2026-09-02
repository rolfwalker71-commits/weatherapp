<script lang="ts">
	import { moodIconClass } from '$lib/colors';
	import { WEATHER_GLYPHS } from '$lib/icons/weather';
	import { getWmo, weatherMood } from '$lib/wmo';
	import SymbolMark from './SymbolMark.svelte';

	interface Props {
		code: number;
		isDay?: boolean;
		class?: string;
		badge?: boolean;
		hero?: boolean;
	}

	let { code, isDay = true, class: className = 'size-8' }: Props = $props();

	const meta = $derived(getWmo(code, isDay));
	const mood = $derived(weatherMood(code, isDay));
	const colorClass = $derived(moodIconClass(mood));
	const raw = $derived(WEATHER_GLYPHS[meta.glyph]);
</script>

<SymbolMark {raw} class="{className} {colorClass}" />
