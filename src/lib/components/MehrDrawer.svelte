<script lang="ts">
	import MehrList from './MehrList.svelte';
	import AppIcon from './AppIcon.svelte';
	import { chromeState } from '$lib/chrome.svelte';
	import { setDrawer, uiState } from '$lib/ui.svelte';

	const open = $derived(uiState.drawer && chromeState.chrome !== 'desktop');
</script>

{#if open}
	<div class="wx-drawer-host">
		<button
			type="button"
			class="wx-sheet-backdrop"
			aria-label="Menü schliessen"
			onclick={() => setDrawer(false)}
		></button>
		<div class="wx-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
			<div
				class="wx-sheet-head flex items-center justify-between gap-3 px-4 py-3"
				style="padding-top: max(0.75rem, env(safe-area-inset-top, 0px));"
			>
				<h2 id="drawer-title" class="text-xl font-semibold leading-snug tracking-tight">Mehr</h2>
				<button type="button" class="icon-btn" onclick={() => setDrawer(false)} aria-label="Menü schliessen">
					<AppIcon name="close" class="size-5" />
				</button>
			</div>
			<div class="wx-sheet-body px-4 pb-6">
				<MehrList />
			</div>
		</div>
	</div>
{/if}
