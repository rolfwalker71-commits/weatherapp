<script lang="ts">
	import { moodIconClass } from '$lib/colors';
	import { getWmo, weatherMood } from '$lib/wmo';

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
</script>

<meta.icon class="{className} {colorClass}" aria-hidden="true" />
