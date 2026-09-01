<script lang="ts">
	import LocateFixed from '@lucide/svelte/icons/locate-fixed';
	import { chromeState } from '$lib/chrome.svelte';
	import { fabClass, fabClearance } from '$lib/platform';
	import { locateUser, weatherState } from '$lib/weather.svelte';
</script>

<button
	type="button"
	class="fixed z-20 lg:hidden {fabClass(chromeState.chrome)} {fabClearance(chromeState.chrome)}"
	onclick={() => void locateUser()}
	aria-label="Standort verwenden"
	disabled={weatherState.locating}
>
	<LocateFixed class="size-6 {weatherState.locating ? 'animate-pulse' : ''}" />
</button>
