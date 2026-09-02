<script lang="ts">
	import AirQuality from './AirQuality.svelte';
	import AppIcon from './AppIcon.svelte';
	import AlpsCard from './AlpsCard.svelte';
	import CommuteCard from './CommuteCard.svelte';
	import LakesCard from './LakesCard.svelte';
	import LifestyleCard from './LifestyleCard.svelte';
	import MetricGrid from './MetricGrid.svelte';
	import SettingsSheet from './SettingsSheet.svelte';
	import SkyCard from './SkyCard.svelte';
	import ThemePanel from './ThemePanel.svelte';
	import WindCard from './WindCard.svelte';
	import { chromeState } from '$lib/chrome.svelte';
	import { MEHR_GROUPS, TOPIC_CHIPS, type TopicId } from '$lib/nav';
	import { closeTopic, uiState } from '$lib/ui.svelte';

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const titles: Record<TopicId, string> = {
		wind: 'Wind',
		berge: 'Berge',
		seen: 'Seen',
		draussen: 'Draußen',
		luft: 'Luft',
		pendeln: 'Pendeln',
		meldungen: 'Meldungen',
		darstellung: 'Darstellung'
	};

	const topic = $derived(uiState.topic);
	const title = $derived(topic ? titles[topic] : '');
	const known = $derived(
		Boolean(
			topic &&
				[...TOPIC_CHIPS, ...MEHR_GROUPS.flatMap((group) => group.items)].some((item) => item.id === topic)
		)
	);
</script>

{#if topic && known}
	<div class="wx-overlay">
		<button
			type="button"
			class="wx-sheet-backdrop"
			aria-label="{title} schliessen"
			onclick={() => closeTopic()}
		></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="topic-title"
			class="wx-sheet"
		>
			<div class="wx-sheet-head px-5 pt-5">
				{#if !isDesktop}
					<div class="mx-auto mb-4 h-1.5 w-12 rounded-full bg-foreground/30" aria-hidden="true"></div>
				{/if}
				<div class="mb-4 flex items-start justify-between gap-3">
					<h2 id="topic-title" class="break-words text-xl font-semibold leading-snug tracking-tight">
						{title}
					</h2>
					<button type="button" class="icon-btn shrink-0" onclick={() => closeTopic()} aria-label="Schliessen">
						<AppIcon name="close" class="size-5" />
					</button>
				</div>
			</div>
			<div class="wx-sheet-body px-5 pb-5">
				<div class="space-y-4">
					{#if topic === 'wind'}
						<WindCard />
					{:else if topic === 'berge'}
						<AlpsCard />
					{:else if topic === 'seen'}
						<LakesCard />
					{:else if topic === 'draussen'}
						<LifestyleCard />
						<SkyCard />
						<MetricGrid />
					{:else if topic === 'luft'}
						<AirQuality />
					{:else if topic === 'pendeln'}
						<CommuteCard />
					{:else if topic === 'meldungen'}
						<SettingsSheet embedded />
					{:else if topic === 'darstellung'}
						<ThemePanel />
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
