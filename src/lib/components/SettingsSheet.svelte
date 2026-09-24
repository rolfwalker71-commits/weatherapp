<script lang="ts">
	import { onMount } from 'svelte';
	import AppIcon from './AppIcon.svelte';
	import { chromeState } from '$lib/chrome.svelte';
	import { settingsUi } from '$lib/commute.svelte';
	import { loadNotifyPrefs, PREF_META, saveNotifyPrefs } from '$lib/notify-prefs';
	import {
		disablePush,
		enablePush,
		fetchDeviceState,
		fetchPushStatus,
		sendTestPush,
		syncPreferences,
		type DeviceState,
		type PushStatus
	} from '$lib/push-client';
	import type { NotifyPrefs } from '$lib/types';
	import { isNativeApp } from '$lib/platform';
	import { weatherState } from '$lib/weather.svelte';

	interface Props {
		embedded?: boolean;
	}

	let { embedded = false }: Props = $props();

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	let prefs = $state<NotifyPrefs>(loadNotifyPrefs());
	let status = $state<PushStatus | null>(null);
	let message = $state('');
	let messageOk = $state(true);
	let busy = $state(false);
	let device = $state<DeviceState | null>(null);
	const registered = $derived(device?.state === 'registered');

	onMount(() => {
		prefs = loadNotifyPrefs();
		void fetchPushStatus().then((next) => (status = next));
		void refreshDevice();
	});

	async function refreshDevice() {
		device = await fetchDeviceState();
	}

	function when(iso: string | null | undefined): string {
		if (!iso) return '';
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return '';
		const sameDay = date.toDateString() === new Date().toDateString();
		return new Intl.DateTimeFormat('de-CH', {
			...(sameDay ? {} : { weekday: 'short', day: 'numeric', month: 'short' }),
			hour: '2-digit',
			minute: '2-digit'
		}).format(date);
	}

	function onWindowKey(event: KeyboardEvent) {
		if (!embedded && event.key === 'Escape' && settingsUi.open) settingsUi.open = false;
	}

	async function toggle(id: keyof NotifyPrefs) {
		const nextOn = !prefs[id];
		prefs = { ...prefs, [id]: nextOn };
		saveNotifyPrefs(prefs);
		void syncPreferences(prefs, currentPlace()).catch(() => {
			/* local prefs already saved */
		});
		if (!nextOn) return;
		busy = true;
		const result = await enablePush(prefs, currentPlace());
		message = result.message;
		messageOk = result.ok;
		status = await fetchPushStatus();
		await refreshDevice();
		busy = false;
	}

	function currentPlace() {
		return {
			latitude: weatherState.place.latitude,
			longitude: weatherState.place.longitude,
			name: weatherState.place.name,
			timezone: weatherState.bundle?.timezone
		};
	}

	async function subscribe() {
		busy = true;
		const result = await enablePush(prefs, currentPlace());
		message = result.message;
		messageOk = result.ok;
		status = await fetchPushStatus();
		await refreshDevice();
		busy = false;
	}

	async function test() {
		busy = true;
		const result = await sendTestPush();
		message = result.message;
		messageOk = result.ok;
		// Give the push service a moment, then show the recorded delivery result.
		setTimeout(() => void refreshDevice(), 2500);
		busy = false;
	}

	async function unsubscribe() {
		busy = true;
		await disablePush();
		message = 'Abonnement entfernt.';
		messageOk = true;
		await refreshDevice();
		busy = false;
	}
</script>

<svelte:window onkeydown={onWindowKey} />

{#snippet form()}
	<p
		class="mb-4 text-sm leading-snug {status?.blockedReason || !status?.configured
			? 'text-destructive'
			: ''}"
		role={status?.blockedReason || !status?.configured ? 'alert' : 'status'}
	>
		{status?.message ?? 'Prüfe Push-Server…'}
	</p>

	{#if device && device.state !== 'unknown' && device.state !== 'unsupported'}
		<div
			class="mb-4 flex items-start gap-3 px-4 py-3 {isDesktop
				? 'rounded-md ring-1 ring-border'
				: 'rounded-[1.25rem] bg-muted'}"
			role="status"
		>
			<span
				class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full {registered && !device.lastError
					? 'bg-primary text-on-primary'
					: 'bg-background'}"
			>
				<AppIcon name={registered && device.lastError ? 'warning' : 'bell'} class="size-4" filled={registered} />
			</span>
			<span class="min-w-0 text-sm leading-snug">
				{#if registered}
					<span class="block font-medium">Dieses Gerät ist angemeldet</span>
					{#if device.placeName}
						<span class="block text-muted-foreground">Meldungen für {device.placeName}</span>
					{/if}
					{#if device.lastError}
						<span class="block text-destructive">
							Letzte Zustellung fehlgeschlagen{device.lastErrorAt ? ` (${when(device.lastErrorAt)})` : ''}:
							{device.lastError}
						</span>
					{:else if device.lastSuccessAt}
						<span class="block text-muted-foreground">Zuletzt zugestellt: {when(device.lastSuccessAt)}</span>
					{:else}
						<span class="block text-muted-foreground">Noch keine Meldung zugestellt — Testmitteilung senden.</span>
					{/if}
				{:else if device.state === 'blocked'}
					<span class="block font-medium">Mitteilungen blockiert</span>
					<span class="block text-muted-foreground">
						iPhone: Einstellungen → Mitteilungen → Wetter CH. Sonst in den Website-Einstellungen des
						Browsers erlauben.
					</span>
				{:else}
					<span class="block font-medium">Dieses Gerät ist nicht angemeldet</span>
					<span class="block text-muted-foreground">Kategorie wählen und «Gerät anmelden» tippen.</span>
				{/if}
			</span>
		</div>
	{/if}

	<ul class="wx-grouped space-y-2">
		{#each PREF_META as item (item.id)}
			<li>
				<label
					class="flex min-h-12 items-center justify-between gap-3 px-4 {isDesktop
						? 'rounded-md ring-1 ring-border'
						: 'rounded-[1.25rem] bg-muted'}"
				>
					<span class="min-w-0">
						<span class="block leading-snug">{item.label}</span>
						<span class="block text-sm text-muted-foreground">{item.hint}</span>
					</span>
					<input
						type="checkbox"
						class="size-5 accent-primary"
						checked={prefs[item.id]}
						onchange={() => void toggle(item.id)}
					/>
				</label>
			</li>
		{/each}
	</ul>

	<div class="mt-4 flex flex-wrap gap-2">
		{#if registered}
			<button
				type="button"
				class="inline-flex min-h-12 items-center gap-2 bg-primary px-4 text-sm text-on-primary {isDesktop
					? 'rounded-md'
					: 'rounded-full'}"
				onclick={() => void test()}
				disabled={busy}
			>
				<AppIcon name="bell" class="size-4" /> Testmitteilung
			</button>
		{:else}
			<button
				type="button"
				class="inline-flex min-h-12 items-center gap-2 bg-primary px-4 text-sm text-on-primary {isDesktop
					? 'rounded-md'
					: 'rounded-full'}"
				onclick={() => void subscribe()}
				disabled={busy || device?.state === 'unsupported'}
			>
				<AppIcon name="bell" class="size-4" /> Gerät anmelden
			</button>
		{/if}
		{#if registered || device?.state === 'unknown'}
			<button
				type="button"
				class="min-h-12 px-4 text-sm {isDesktop ? 'rounded-md bg-muted' : 'rounded-full bg-muted'}"
				onclick={() => void unsubscribe()}
				disabled={busy}
			>
				Abmelden
			</button>
		{/if}
	</div>
	{#if message}
		<p class="mt-3 text-sm leading-snug {messageOk ? '' : 'text-destructive'}" role={messageOk ? 'status' : 'alert'}>
			{message}
		</p>
	{/if}
	<p class="mt-4 text-sm leading-snug text-muted-foreground">
		{#if isNativeApp()}
			Kategorie einschalten oder «Gerät anmelden» — iOS fragt einmal nach Erlaubnis für
			Mitteilungen. Ändern jederzeit in Einstellungen → Mitteilungen → Wetter CH.
		{:else}
			Kategorie einschalten oder «Gerät anmelden» — der Browser fragt nach Erlaubnis. Auf
			iPhone und iPad nur in der installierten App (Safari → Teilen → «Zum Home-Bildschirm»).
			Die App meldet das Gerät bei jedem Öffnen erneut an, damit es angemeldet bleibt.
		{/if}
	</p>
{/snippet}

{#if embedded}
	<div>
		<p class="mb-4 text-sm text-muted-foreground">Benachrichtigungen, lokal und in der Datenbank</p>
		{@render form()}
	</div>
{:else if settingsUi.open}
	<div class="wx-overlay wx-overlay--settings">
		<button
			type="button"
			class="wx-sheet-backdrop"
			aria-label="Einstellungen schliessen"
			onclick={() => (settingsUi.open = false)}
		></button>
		<div
			class="wx-sheet"
			role="dialog"
			aria-modal="true"
			aria-labelledby="settings-title"
		>
			<div class="wx-sheet-head px-5 pt-5 sm:px-6 sm:pt-6">
				<div class="mb-4 flex items-start justify-between gap-3">
					<div>
						<h2 id="settings-title" class="text-xl font-semibold leading-snug tracking-tight">
							Einstellungen
						</h2>
						<p class="text-sm text-muted-foreground">Benachrichtigungen, lokal und in der Datenbank</p>
					</div>
					<button
						type="button"
						class="icon-btn shrink-0"
						onclick={() => (settingsUi.open = false)}
						aria-label="Schliessen"
					>
						<AppIcon name="close" class="size-5" />
					</button>
				</div>
			</div>
			<div class="wx-sheet-body px-5 pb-5 sm:px-6 sm:pb-6">
				{@render form()}
			</div>
		</div>
	</div>
{/if}
