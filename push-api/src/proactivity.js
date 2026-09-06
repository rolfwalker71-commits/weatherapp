/** Rule-based forecast-plan diffs for proactive push — provider fields only. */

const WET_MM = 0.4;
const DRY_PLAN_MM = 0.35;
const NEW_RAIN_MM = 0.8;
const EARLIER_MS = 60 * 60 * 1000;
const TEMP_SWING = 3.5;
const WIND_JUMP = 15;
const GUST_JUMP = 20;
const WIND_MIN = 35;
const GUST_MIN = 45;
const HORIZON_HOURS = 12;
const PRECIP_SUM_HOURS = 6;

function formatHourLabel(iso, timeZone) {
	try {
		return new Intl.DateTimeFormat('de-CH', {
			hour: '2-digit',
			minute: '2-digit',
			timeZone: timeZone || undefined
		}).format(new Date(iso));
	} catch {
		return '';
	}
}

function formatTempLabel(value) {
	return `${Math.round(value)}°`;
}

function dayKeyInZone(iso, timeZone) {
	try {
		return new Intl.DateTimeFormat('en-CA', {
			timeZone: timeZone || undefined,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		}).format(new Date(iso));
	} catch {
		return String(iso).slice(0, 10);
	}
}

function isWet(mm) {
	return mm != null && Number.isFinite(mm) && mm >= WET_MM;
}

export function buildForecastSnapshot(weather, alerts = []) {
	const hours = (weather.upcoming || []).slice(0, HORIZON_HOURS);
	const precipHours = (weather.upcoming || []).slice(0, PRECIP_SUM_HOURS);
	const onset = hours.find((hour) => isWet(hour.precipMm)) || null;
	const precipNext6Mm = precipHours.reduce((sum, hour) => sum + (hour.precipMm ?? 0), 0);
	let maxWind = null;
	let maxGust = null;
	for (const hour of hours) {
		if (Number.isFinite(hour.wind)) {
			maxWind = maxWind == null ? hour.wind : Math.max(maxWind, hour.wind);
		}
		if (Number.isFinite(hour.gusts)) {
			maxGust = maxGust == null ? hour.gusts : Math.max(maxGust, hour.gusts);
		}
	}
	const warningKeys = (alerts || [])
		.filter((alert) => alert?.id && ['moderate', 'severe', 'extreme'].includes(alert.severity))
		.map((alert) => `${alert.id}:${alert.severity}`)
		.sort();

	return {
		dayKey: dayKeyInZone(weather.current?.time || new Date().toISOString(), weather.timezone),
		precipOnsetIso: onset?.time ?? null,
		precipNext6Mm,
		maxWindKmh: maxWind,
		maxGustKmh: maxGust,
		todayMax: Number.isFinite(weather.todayMax) ? weather.todayMax : null,
		todayMin: Number.isFinite(weather.todayMin) ? weather.todayMin : null,
		todayCode: Number.isFinite(weather.todayCode) ? weather.todayCode : null,
		warningKeys
	};
}

function wasDryPlan(snap) {
	return !snap.precipOnsetIso && snap.precipNext6Mm < DRY_PLAN_MM;
}

function isWetPlan(snap) {
	return Boolean(snap.precipOnsetIso) || snap.precipNext6Mm >= NEW_RAIN_MM;
}

const SEVERITY_RANK = { moderate: 1, severe: 2, extreme: 3 };

function warningEscalations(previous, current) {
	const prevMap = new Map(
		(previous.warningKeys || []).map((key) => {
			const [id, severity] = key.split(':');
			return [id, severity];
		})
	);
	const out = [];
	for (const key of current.warningKeys || []) {
		const [id, severity] = key.split(':');
		const prev = prevMap.get(id);
		if (!prev) {
			out.push({ id, severity, kind: 'new' });
			continue;
		}
		if ((SEVERITY_RANK[severity] || 0) > (SEVERITY_RANK[prev] || 0)) {
			out.push({ id, severity, kind: 'escalate' });
		}
	}
	return out;
}

/**
 * @returns {{ kind: string, fingerprint: string, title: string, body: string } | null}
 */
export function diffForecastSnapshots(previous, current, timeZone, options = {}) {
	if (!previous) return null;
	if (previous.dayKey !== current.dayKey) return null;

	const changes = [];
	const tz = timeZone || undefined;

	if (isWetPlan(previous) && wasDryPlan(current)) {
		changes.push({
			kind: 'rainCancel',
			fingerprint: `rain-cancel-${current.dayKey}`,
			title: 'Wetteränderung',
			body: 'Regen fällt aus — die Prognose ist wieder trocken.'
		});
	} else if (wasDryPlan(previous) && isWetPlan(current) && current.precipOnsetIso) {
		const when = formatHourLabel(current.precipOnsetIso, tz);
		changes.push({
			kind: 'rainNew',
			fingerprint: `rain-new-${String(current.precipOnsetIso).slice(0, 13)}`,
			title: 'Wetteränderung',
			body: when ? `Neu: Regen ab ${when}.` : 'Neu: Regen in der Prognose.'
		});
	} else if (
		previous.precipOnsetIso &&
		current.precipOnsetIso &&
		new Date(current.precipOnsetIso).getTime() <=
			new Date(previous.precipOnsetIso).getTime() - EARLIER_MS
	) {
		const when = formatHourLabel(current.precipOnsetIso, tz);
		changes.push({
			kind: 'rainEarlier',
			fingerprint: `rain-earlier-${String(current.precipOnsetIso).slice(0, 13)}`,
			title: 'Wetteränderung',
			body: when
				? `Regen ab ${when} — früher als gedacht.`
				: 'Regen kommt früher als zuvor erwartet.'
		});
	}

	const gustPrev = previous.maxGustKmh;
	const gustNow = current.maxGustKmh;
	const windPrev = previous.maxWindKmh;
	const windNow = current.maxWindKmh;
	const gustJump =
		gustPrev != null && gustNow != null && gustNow - gustPrev >= GUST_JUMP && gustNow >= GUST_MIN;
	const windJump =
		windPrev != null && windNow != null && windNow - windPrev >= WIND_JUMP && windNow >= WIND_MIN;
	if (gustJump || windJump) {
		const peak = gustJump && gustNow != null ? Math.round(gustNow) : Math.round(windNow);
		const label = gustJump ? `Böen bis ${peak} km/h` : `Wind bis ${peak} km/h`;
		changes.push({
			kind: 'windJump',
			fingerprint: `wind-${current.dayKey}-${peak}`,
			title: 'Wetteränderung',
			body: `Stärkerer Wind in der Prognose: ${label}.`
		});
	}

	if (
		previous.todayMax != null &&
		current.todayMax != null &&
		Math.abs(current.todayMax - previous.todayMax) >= TEMP_SWING
	) {
		changes.push({
			kind: 'tempSwing',
			fingerprint: `tmax-${current.dayKey}-${Math.round(current.todayMax)}`,
			title: 'Wetteränderung',
			body: `Höchsttemperatur neu ${formatTempLabel(current.todayMax)} (vorher ${formatTempLabel(previous.todayMax)}).`
		});
	} else if (
		previous.todayMin != null &&
		current.todayMin != null &&
		Math.abs(current.todayMin - previous.todayMin) >= TEMP_SWING
	) {
		changes.push({
			kind: 'tempSwing',
			fingerprint: `tmin-${current.dayKey}-${Math.round(current.todayMin)}`,
			title: 'Wetteränderung',
			body: `Tiefsttemperatur neu ${formatTempLabel(current.todayMin)} (vorher ${formatTempLabel(previous.todayMin)}).`
		});
	}

	if (options.includeWarnings) {
		const escalations = warningEscalations(previous, current);
		for (const item of escalations.slice(0, 1)) {
			changes.push({
				kind: 'warning',
				fingerprint: `fc-warn-${item.id}-${item.severity}`,
				title: 'Wetteränderung',
				body:
					item.kind === 'escalate'
						? 'Eine Warnung wurde verschärft.'
						: 'Neue Warnung in der Prognose.'
			});
		}
	}

	const priority = ['rainCancel', 'rainEarlier', 'rainNew', 'warning', 'windJump', 'tempSwing'];
	for (const kind of priority) {
		const hit = changes.find((item) => item.kind === kind);
		if (hit) return hit;
	}
	return null;
}
