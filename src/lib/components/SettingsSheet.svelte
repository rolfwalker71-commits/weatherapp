<script lang="ts">
	import { onMount } from 'svelte';
	import AppIcon from './AppIcon.svelte';
	import { chromeState } from '$lib/chrome.svelte';
	import { settingsUi } from '$lib/commute.svelte';
	import { loadNotifyPrefs, PREF_META, saveNotifyPrefs } from '$lib/notify-prefs';
	import {
		disablePush,
		enablePush,
		fetchPushStatus,
		syncPreferences,
		type PushStatus
	} from '$lib/push-client';
	import type { NotifyPrefs } from '$lib/types';
	import { weatherState } from '$lib/weather.svelte';

	interface Props {
		embedded?: boolean;
	}

	let { embedded = false }: Props = $props();

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	let prefs = $state<NotifyPrefs>(loadNotifyPrefs());
	let status = $state<PushStatus | null>(null);
	let message = $state('');
	let busy = $state(false);

	onMount(() => {
		prefs = loadNotifyPrefs();
		void fetchPushStatus().then((next) => (status = next));
	});

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
		status = await fetchPushStatus();
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
		status = await fetchPushStatus();
		busy = false;
	}

	async function unsubscribe() {
		busy = true;
		await disablePush();
		message = 'Abonnement entfernt.';
		busy = false;
	}
</script>

<svelte:window onkeydown={onWindowKey} />

{#snippet form()}
	<p class="mb-4 text-sm leading-snug {status?.configured ? '' : 'text-muted-foreground'}" role="status">
		{status?.message ?? 'Prüfe Push-Server…'}
	</p>

	<ul class="space-y-2">
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
		<button
			type="button"
			class="inline-flex min-h-12 items-center gap-2 bg-primary px-4 text-sm text-on-primary {isDesktop
				? 'rounded-md'
				: 'rounded-full'}"
			onclick={() => void subscribe()}
			disabled={busy || !status?.configured || !status.hasVapid}
		>
			<AppIcon name="bell" class="size-4" /> Gerät anmelden
		</button>
		<button
			type="button"
			class="min-h-12 px-4 text-sm {isDesktop ? 'rounded-md bg-muted' : 'rounded-full bg-muted'}"
			onclick={() => void unsubscribe()}
			disabled={busy}
		>
			Abmelden
		</button>
	</div>
	{#if message}
		<p class="mt-3 text-sm leading-snug" role="status">{message}</p>
	{/if}
	<p class="mt-4 text-sm leading-snug text-muted-foreground">
		Kategorie einschalten — das Gerät wird angemeldet, Ort und Prefs werden gespeichert.
		Der Server sendet selbst, sobald Keys in der Datenbank liegen.
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
