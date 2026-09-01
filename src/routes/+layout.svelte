<script lang="ts">
	import { pwaInfo } from 'virtual:pwa-info';
	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	import '../app.css';
	import ChromeProvider from '$lib/components/ChromeProvider.svelte';

	let { children } = $props();

	const { needRefresh, updateServiceWorker } = useRegisterSW({ immediate: true });

	const webManifest = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');
</script>

<svelte:head>
	{@html webManifest}
</svelte:head>

<ChromeProvider>
	<a
		href="#main"
		class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-3 focus:py-2 focus:text-on-primary"
	>
		Zum Inhalt
	</a>
	{@render children()}

	{#if $needRefresh}
		<div class="fixed bottom-24 left-4 right-4 z-30 lg:bottom-6 lg:left-auto lg:right-6 lg:w-96">
			<div class="flex items-center justify-between gap-3 bg-card p-4 [html[data-chrome=android]_&]:rounded-3xl [html[data-chrome=desktop]_&]:rounded-md [html[data-chrome=desktop]_&]:ring-1 [html[data-chrome=desktop]_&]:ring-border">
				<p class="text-sm leading-snug">Neue Version verfügbar.</p>
				<button
					type="button"
					class="min-h-10 rounded-full bg-primary px-4 text-sm text-on-primary [html[data-chrome=desktop]_&]:rounded-md"
					onclick={() => updateServiceWorker(true)}
				>
					Aktualisieren
				</button>
			</div>
		</div>
	{/if}
</ChromeProvider>
