<script lang="ts">
	import { ICONS, type AppIconName } from '$lib/icons/chrome';
	import SymbolMark from './SymbolMark.svelte';

	interface Props {
		name: AppIconName;
		filled?: boolean;
		class?: string;
	}

	let { name, filled = false, class: className = 'size-5' }: Props = $props();
	const pair = $derived(ICONS[name]);
	const raw = $derived(filled ? pair.fill : pair.outline);
</script>

<SymbolMark {raw} class={className} />
