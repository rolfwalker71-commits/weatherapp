<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import type { AppIconName } from '$lib/icons/chrome';
	import { listTileClass } from '$lib/platform';
	import { setTheme, themeState } from '$lib/theme.svelte';
	import type { ThemePreference } from '$lib/types';
	import AppIcon from './AppIcon.svelte';

	const options: { id: ThemePreference; label: string; icon: AppIconName }[] = [
		{ id: 'system', label: 'System', icon: 'themeSystem' },
		{ id: 'light', label: 'Hell', icon: 'themeLight' },
		{ id: 'dark', label: 'Dunkel', icon: 'themeDark' }
	];
</script>

<section aria-labelledby="theme-title">
	<h2 id="theme-title" class="sr-only">Darstellung</h2>
	<ul class="space-y-2">
		{#each options as option (option.id)}
			<li>
				<button
					type="button"
					class="flex min-h-12 w-full items-center gap-3 px-4 text-left {listTileClass(
						chromeState.chrome,
						themeState.preference === option.id
					)}"
					aria-pressed={themeState.preference === option.id}
					onclick={() => setTheme(option.id)}
				>
					<AppIcon
						name={option.icon}
						filled={themeState.preference === option.id}
						class="size-5 {option.id === 'dark' ? 'wx-icon-night' : option.id === 'light' ? 'wx-icon-sun' : 'wx-icon-cloud'}"
					/>
					<span class="leading-snug">{option.label}</span>
				</button>
			</li>
		{/each}
	</ul>
</section>
