<script lang="ts">
	import { prepareSymbol } from '$lib/icons/svg';

	interface Props {
		raw: string;
		class?: string;
	}

	let { raw, class: className = 'size-5' }: Props = $props();
	const html = $derived(prepareSymbol(raw));
</script>

<span class="inline-flex shrink-0 text-current {className}" aria-hidden="true">{@html html}</span>
