<script lang="ts">
	import { onMount } from 'svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import CurrentHero from '$lib/components/CurrentHero.svelte';
	import DailyForecast from '$lib/components/DailyForecast.svelte';
	import DayDetail from '$lib/components/DayDetail.svelte';
	import FavoriteChips from '$lib/components/FavoriteChips.svelte';
	import HourDetail from '$lib/components/HourDetail.svelte';
	import HourlyForecast from '$lib/components/HourlyForecast.svelte';
	import MehrDrawer from '$lib/components/MehrDrawer.svelte';
	import MehrList from '$lib/components/MehrList.svelte';
	import NavBar from '$lib/components/NavBar.svelte';
	import NavRail from '$lib/components/NavRail.svelte';
	import NowcastCard from '$lib/components/NowcastCard.svelte';
	import SettingsSheet from '$lib/components/SettingsSheet.svelte';
	import TopicChips from '$lib/components/TopicChips.svelte';
	import TopicSheet from '$lib/components/TopicSheet.svelte';
	import WarningsCard from '$lib/components/WarningsCard.svelte';
	import WeatherRadar from '$lib/components/WeatherRadar.svelte';
	import { chromeState } from '$lib/chrome.svelte';
	import { hydrateCommute } from '$lib/commute.svelte';
	import type { DayPoint, HourPoint } from '$lib/types';
	import { closeTopic, initRoutes, setDrawer, uiState } from '$lib/ui.svelte';
	import { weatherMood } from '$lib/wmo';
	import { hydrateFromCache, locateUser, startAutoRefresh, weatherState } from '$lib/weather.svelte';

	let selectedHour = $state<HourPoint | null>(null);
	let selectedDay = $state<DayPoint | null>(null);
	const mood = $derived(
		weatherState.bundle
			? weatherMood(weatherState.bundle.current.weather_code, weatherState.bundle.current.is_day === 1)
			: 'cloud'
	);
	const section = $derived(weatherState.section);

	$effect(() => {
		weatherState.place.latitude;
		weatherState.place.longitude;
		selectedDay = null;
		selectedHour = null;
	});

	function onKey(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		if (selectedHour) {
			selectedHour = null;
			return;
		}
		if (selectedDay) {
			selectedDay = null;
			return;
		}
		if (uiState.topic) {
			closeTopic();
			return;
		}
		if (uiState.drawer) setDrawer(false);
	}

	onMount(() => {
		hydrateFromCache();
		hydrateCommute();
		const stopRoutes = initRoutes();
		void locateUser();
		const stopRefresh = startAutoRefresh();
		return () => {
			stopRoutes();
			stopRefresh();
		};
	});
</script>

<svelte:window onkeydown={onKey} />

<svelte:head>
	<title>Wetter · {weatherState.place.name}</title>
</svelte:head>

<div class="wx-page min-h-dvh bg-background text-foreground" data-mood={mood}>
	<AppHeader />
	<div class="mx-auto flex w-full max-w-[90rem]">
		<NavRail />
		<main
			id="main"
			class="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 {chromeState.chrome === 'android'
				? 'pb-[calc(8rem+env(safe-area-inset-bottom,0px))]'
				: 'lg:pb-10'}"
		>
			<div class="mb-4">
				<FavoriteChips />
			</div>

			{#if weatherState.error}
				<p
					class="mb-4 px-4 py-3 text-sm leading-snug [html[data-chrome=android]_&]:rounded-3xl [html[data-chrome=android]_&]:bg-secondary [html[data-chrome=android]_&]:text-foreground [html[data-chrome=desktop]_&]:rounded-md [html[data-chrome=desktop]_&]:bg-primary/10"
					role="status"
				>
					{weatherState.error}
				</p>
			{/if}

			{#if !weatherState.bundle && weatherState.loading}
				<div aria-busy="true">
					<div class="h-64 animate-pulse bg-card [html[data-chrome=android]_&]:rounded-3xl [html[data-chrome=desktop]_&]:rounded-md"></div>
				</div>
			{:else}
				{#if section === 'jetzt'}
					<div class="grid grid-cols-1 gap-4">
						{#if weatherState.bundle}
							<CurrentHero />
							<WarningsCard />
							<NowcastCard compact />
							<TopicChips />
						{/if}
					</div>
				{:else if section === 'stunden'}
					{#if weatherState.bundle}
						<HourlyForecast onSelect={(hour) => (selectedHour = hour)} />
					{/if}
				{:else if section === 'radar'}
					<WeatherRadar />
				{:else if section === 'woche'}
					{#if weatherState.bundle}
						<DailyForecast
							selectedDate={selectedDay?.date}
							onSelect={(day) => (selectedDay = day)}
						/>
					{/if}
				{:else if section === 'mehr'}
					<MehrList />
				{/if}
			{/if}
		</main>
	</div>

	{#if chromeState.chrome !== 'desktop'}
		<NavBar />
	{/if}
</div>

<DayDetail
	day={selectedDay}
	onClose={() => (selectedDay = null)}
	onSelectDay={(day) => (selectedDay = day)}
	onSelectHour={(hour) => (selectedHour = hour)}
/>
<HourDetail hour={selectedHour} onClose={() => (selectedHour = null)} />
<TopicSheet />
<MehrDrawer />
<SettingsSheet />
