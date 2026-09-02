<script lang="ts">
	import { ICONS, type AppIconName } from '$lib/icons/chrome';

	interface Props {
		name: AppIconName;
		filled?: boolean;
		class?: string;
	}

	let { name, filled = false, class: className = 'size-5' }: Props = $props();

	const Icon = $derived(ICONS[name]);
</script>

<Icon class="{className} {filled ? 'fill-current' : ''}" aria-hidden="true" />
