import type { ScaleTone } from './colors';

export interface ScaleLevel {
	label: string;
	hint: string;
	ratio: number;
	tone: ScaleTone;
}

export function europeanAqi(value: number | null | undefined): ScaleLevel {
	if (value == null || Number.isNaN(value)) {
		return { label: 'Keine Daten', hint: 'Luftqualität derzeit nicht verfügbar.', ratio: 0, tone: 'neutral' };
	}
	if (value <= 20) return { label: 'Gut', hint: 'Frische Luft — ideal für draussen.', ratio: value / 100, tone: 'good' };
	if (value <= 40) return { label: 'Mässig', hint: 'Für die meisten unproblematisch.', ratio: value / 100, tone: 'fair' };
	if (value <= 60)
		return { label: 'Heikel', hint: 'Sensible Personen sollten Anstrengung dosieren.', ratio: value / 100, tone: 'warn' };
	if (value <= 80) return { label: 'Ungesund', hint: 'Lange Outdoor-Belastung vermeiden.', ratio: value / 100, tone: 'bad' };
	if (value <= 100) return { label: 'Sehr ungesund', hint: 'Aktivität im Freien einschränken.', ratio: 1, tone: 'extreme' };
	return { label: 'Extrem', hint: 'Draussen nur wenn nötig.', ratio: 1, tone: 'extreme' };
}

export function uvLevel(value: number | null | undefined): ScaleLevel {
	if (value == null || Number.isNaN(value)) {
		return { label: 'Keine Daten', hint: '', ratio: 0, tone: 'neutral' };
	}
	if (value < 3) return { label: 'Niedrig', hint: 'Schutz in der Regel nicht nötig.', ratio: value / 11, tone: 'good' };
	if (value < 6) return { label: 'Mässig', hint: 'Sonnenschutz um die Mittagszeit.', ratio: value / 11, tone: 'fair' };
	if (value < 8) return { label: 'Hoch', hint: 'Hut, Creme und Schatten empfohlen.', ratio: value / 11, tone: 'warn' };
	if (value < 11) return { label: 'Sehr hoch', hint: 'Mittags möglichst im Schatten bleiben.', ratio: value / 11, tone: 'bad' };
	return { label: 'Extrem', hint: 'Aufenthalt in der Sonne minimieren.', ratio: 1, tone: 'extreme' };
}

export function pollenLevel(value: number | null | undefined): ScaleLevel {
	if (value == null || Number.isNaN(value)) {
		return { label: 'Keine Daten', hint: '', ratio: 0, tone: 'neutral' };
	}
	if (value < 10) return { label: 'Kein', hint: 'Kaum Pollenflug.', ratio: 0.08, tone: 'good' };
	if (value < 50) return { label: 'Schwach', hint: 'Leichter Pollenflug.', ratio: 0.28, tone: 'fair' };
	if (value < 100) return { label: 'Mässig', hint: 'Für Allergiker spürbar.', ratio: 0.55, tone: 'warn' };
	if (value < 300) return { label: 'Stark', hint: 'Fenster zu, Medikamente bereithalten.', ratio: 0.8, tone: 'bad' };
	return { label: 'Sehr stark', hint: 'Belastung hoch — draussen vorsichtig.', ratio: 1, tone: 'extreme' };
}
