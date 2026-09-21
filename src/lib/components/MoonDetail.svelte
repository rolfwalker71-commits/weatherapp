<script lang="ts">
	import { chromeState } from '$lib/chrome.svelte';
	import { MAIN_PHASE_LABEL, addDays } from '$lib/moon';
	import { moonCalendar, moonDay, moonView, upcomingPhases } from '$lib/moon-view';
	import { clockState, weatherState } from '$lib/weather.svelte';
	import AppIcon from './AppIcon.svelte';
	import MoonPhase from './MoonPhase.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	const isDesktop = $derived(chromeState.chrome === 'desktop');
	const bundle = $derived(weatherState.bundle);
	const now = $derived(new Date(clockState.now));
	const moon = $derived(open && bundle ? moonView(bundle, now) : null);
	const phases = $derived(open && bundle ? upcomingPhases(bundle, now, 4) : []);
	const calendar = $derived(open && bundle ? moonCalendar(bundle, now, 30) : []);
	const tomorrow = $derived(
		open && bundle && calendar[0] ? moonDay(addDays(calendar[0].date, 1), bundle) : null
	);
	const tile = $derived(isDesktop ? 'rounded-md p-3 ring-1 ring-border' : 'rounded-3xl bg-muted p-3');
</script>

{#if moon && bundle}
	<div class="wx-overlay wx-overlay--hour">
		<button type="button" class="wx-sheet-backdrop" aria-label="Mondkalender schliessen" onclick={onClose}
		></button>
		<div role="dialog" aria-modal="true" aria-labelledby="moon-detail-title" class="wx-sheet">
			<div class="hero-wash" data-mood="night" data-scene="night" aria-hidden="true"></div>
			<div class="hero-on-night relative flex min-h-0 flex-1 flex-col">
				<div class="wx-sheet-head px-5 pt-5">
					{#if !isDesktop}
						<div class="mx-auto mb-4 h-1.5 w-12 rounded-full bg-current/30" aria-hidden="true"></div>
					{/if}
					<div class="mb-4 flex items-start justify-between gap-3">
						<div class="min-w-0">
							<h2 id="moon-detail-title" class="break-words text-xl font-semibold leading-snug">
								Mond · {bundle.place.name}
							</h2>
						</div>
						<button type="button" class="icon-btn shrink-0" onclick={onClose} aria-label="Schliessen">
							<AppIcon name="close" class="size-5" />
						</button>
					</div>
				</div>
				<div class="wx-sheet-body space-y-5 px-5 pb-5">
					<div class="flex items-center gap-4">
						<span class="moon-hero"><MoonPhase cycle={moon.info.cycle} southern={moon.southern} class="size-24" /></span>
						<div class="min-w-0">
							<p class="break-words text-2xl font-semibold leading-snug">{moon.info.label}</p>
							<p class="text-sm text-muted-foreground tabular-nums">
								{Math.round(moon.info.illumination * 100)} % beleuchtet · {moon.info.waxing
									? 'zunehmend'
									: 'abnehmend'}
							</p>
						</div>
					</div>

					<section aria-labelledby="moon-times-title">
						<h3 id="moon-times-title" class="mb-2 text-sm font-semibold uppercase tracking-wide opacity-70">
							Auf- und Untergang
						</h3>
						<dl class="grid grid-cols-2 gap-3">
							{#each [{ label: 'Heute', day: moon.today }, { label: 'Morgen', day: tomorrow }] as row (row.label)}
								{#if row.day}
									<div class={tile}>
										<dt class="text-sm opacity-80">{row.label}</dt>
										<dd class="mt-1 space-y-0.5">
											{#each row.day.events as event (event.kind)}
												<p class="font-medium tabular-nums">
													<span aria-hidden="true">{event.kind === 'rise' ? '↑' : '↓'}</span>
													{event.label} {event.time}
												</p>
											{/each}
											{#if row.day.note}
												<p class="text-sm leading-snug opacity-80">{row.day.note}</p>
											{/if}
										</dd>
									</div>
								{/if}
							{/each}
						</dl>
					</section>

					<section aria-labelledby="moon-phases-title">
						<h3 id="moon-phases-title" class="mb-2 text-sm font-semibold uppercase tracking-wide opacity-70">
							Nächste Phasen
						</h3>
						<ul class="grid grid-cols-2 gap-3">
							{#each phases as event (event.when)}
								<li class="{tile} flex items-center gap-3">
									<MoonPhase
										cycle={{ new: 0, first: 0.25, full: 0.5, last: 0.75 }[event.phase]}
										southern={moon.southern}
										class="size-8"
									/>
									<div class="min-w-0">
										<p class="text-sm font-medium leading-snug">{event.label}</p>
										<p class="text-sm leading-snug opacity-80 tabular-nums">{event.when}</p>
									</div>
								</li>
							{/each}
						</ul>
					</section>

					<section aria-labelledby="moon-cal-title">
						<h3 id="moon-cal-title" class="mb-2 text-sm font-semibold uppercase tracking-wide opacity-70">
							Die nächsten 30 Tage
						</h3>
						<ol class="moon-cal">
							{#each calendar as day, i (day.date)}
								<li
									class="moon-cal-day"
									class:is-today={day.isToday}
									class:is-main={day.phase != null}
									style="--i: {i}"
									title={day.phase
										? MAIN_PHASE_LABEL[day.phase]
										: `${Math.round(day.illumination * 100)} % beleuchtet`}
								>
									<span class="text-[0.6875rem] leading-none opacity-70">{day.weekday}</span>
									<MoonPhase cycle={day.cycle} southern={moon.southern} class="size-7" />
									<span class="text-xs font-medium leading-none tabular-nums">{day.day}</span>
								</li>
							{/each}
						</ol>
						<p class="mt-2 text-xs leading-snug opacity-70">
							Markiert: Neumond, Halbmond und Vollmond. Zeiten in der Ortszeit von {bundle.place.name}.
						</p>
					</section>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.moon-cal {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(2.75rem, 1fr));
		gap: 0.375rem;
	}
	.moon-cal-day {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		padding: 0.4rem 0.2rem;
		border-radius: 0.75rem;
		animation: moon-cal-in 0.35s ease-out both;
		animation-delay: calc(var(--i) * 12ms);
	}
	.moon-cal-day.is-main {
		background: rgb(243 233 198 / 0.16);
	}
	.moon-cal-day.is-today {
		box-shadow: inset 0 0 0 1.5px currentColor;
	}
	:global(html[data-chrome='desktop']) .moon-cal-day {
		border-radius: 0.375rem;
	}
	.moon-hero {
		display: block;
		animation: moon-hero-in 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}
	@keyframes moon-cal-in {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}
	@keyframes moon-hero-in {
		from {
			opacity: 0;
			transform: scale(0.85) rotate(-12deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.moon-cal-day,
		.moon-hero {
			animation: none;
		}
	}
</style>
