<script lang="ts">
	import { onMount } from 'svelte';
	import AirQuality from '$lib/components/AirQuality.svelte';
	import AlpsCard from '$lib/components/AlpsCard.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import CurrentHero from '$lib/components/CurrentHero.svelte';
	import DailyForecast from '$lib/components/DailyForecast.svelte';
	import DayDetail from '$lib/components/DayDetail.svelte';
	import EinstellungenPage from '$lib/components/EinstellungenPage.svelte';
	import FavoritesDeck from '$lib/components/FavoritesDeck.svelte';
	import PassesCard from '$lib/components/PassesCard.svelte';
	import SnowBulletinCard from '$lib/components/SnowBulletinCard.svelte';
	import VergleichPage from '$lib/components/VergleichPage.svelte';
	import WidgetView from '$lib/components/WidgetView.svelte';
	import HourDetail from '$lib/components/HourDetail.svelte';
	import HourlyForecast from '$lib/components/HourlyForecast.svelte';
	import LakesCard from '$lib/components/LakesCard.svelte';
	import MehrDrawer from '$lib/components/MehrDrawer.svelte';
	import MehrList from '$lib/components/MehrList.svelte';
	import NavBar from '$lib/components/NavBar.svelte';
	import NavRail from '$lib/components/NavRail.svelte';
	import NowcastCard from '$lib/components/NowcastCard.svelte';
	import TopicSheet from '$lib/components/TopicSheet.svelte';
	import WarningsCard from '$lib/components/WarningsCard.svelte';
	import WeatherRadar from '$lib/components/WeatherRadar.svelte';
	import WindCard from '$lib/components/WindCard.svelte';
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
	{#if section !== 'widget'}
		<AppHeader />
	{/if}
	<div class="mx-auto flex w-full max-w-[90rem]">
		{#if section !== 'widget'}
			<NavRail />
		{/if}
		<main
			id="main"
			class="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 {section === 'widget'
				? ''
				: chromeState.chrome === 'android'
					? 'pb-[calc(8rem+env(safe-area-inset-bottom,0px))]'
					: 'lg:pb-10'}"
		>
			{#if weatherState.error}
				<p
					class="mb-4 px-4 py-3 text-sm leading-snug [html[data-chrome=android]_&]:rounded-3xl [html[data-chrome=android]_&]:bg-secondary [html[data-chrome=android]_&]:text-foreground [html[data-chrome=desktop]_&]:rounded-md [html[data-chrome=desktop]_&]:bg-primary/10"
					role="status"
				>
					{weatherState.error}
				</p>
			{/if}

			{#if section === 'widget'}
				<div class="mx-auto max-w-md">
					<WidgetView />
				</div>
			{:else if section === 'favoriten'}
				<FavoritesDeck />
			{:else if section === 'vergleich'}
				<VergleichPage />
			{:else if section === 'einstellungen'}
				<EinstellungenPage />
			{:else if section === 'mehr'}
				<section aria-labelledby="mehr-title" class="mx-auto max-w-xl">
					<h1 id="mehr-title" class="mb-4 text-2xl font-semibold leading-snug tracking-tight">
						Mehr
					</h1>
					<MehrList />
				</section>
			{:else if !weatherState.bundle && weatherState.loading}
				<div id={section === 'jetzt' ? 'jetzt' : undefined} aria-busy="true">
					<div class="h-64 animate-pulse bg-card [html[data-chrome=android]_&]:rounded-3xl [html[data-chrome=desktop]_&]:rounded-md"></div>
				</div>
			{:else if section === 'jetzt'}
				{#if weatherState.bundle}
					<div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
						<div class="space-y-4">
							<CurrentHero />
							<WarningsCard />
						</div>
						<div class="space-y-4">
							<HourlyForecast embedded onSelect={(hour) => (selectedHour = hour)} />
							<NowcastCard compact />
							<WindCard />
						</div>
					</div>
				{:else}
					<section id="jetzt" hidden></section>
				{/if}
			{:else if section === 'radar'}
				<WeatherRadar />
			{:else if section === 'woche'}
				{#if weatherState.bundle}
					<div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
						<DailyForecast
							selectedDate={selectedDay?.date}
							onSelect={(day) => (selectedDay = day)}
						/>
						<div class="space-y-4">
							<SnowBulletinCard />
							<PassesCard />
							<AlpsCard />
							<LakesCard />
						</div>
					</div>
				{/if}
			{:else if section === 'luft'}
				<AirQuality page />
			{/if}
		</main>
	</div>

	{#if chromeState.chrome !== 'desktop' && section !== 'widget'}
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
