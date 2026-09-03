<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import { panelClass } from '$lib/platform';
	import SettingsSheet from './SettingsSheet.svelte';
	import ThemePanel from './ThemePanel.svelte';
</script>

<section aria-labelledby="einstellungen-title">
	<h1 id="einstellungen-title" class="mb-4 text-2xl font-semibold leading-snug tracking-tight">
		Einstellungen
	</h1>
	<div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
		<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
			<h2 class="mb-3 text-xl font-semibold leading-snug tracking-tight">Meldungen</h2>
			<SettingsSheet embedded />
		</section>
		<section class="{panelClass(chromeState.chrome)} p-5 sm:p-6">
			<h2 class="mb-3 text-xl font-semibold leading-snug tracking-tight">Darstellung</h2>
			<ThemePanel />
		</section>
	</div>
</section>
