const SYNODIC = 29.530588853;
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

export interface MoonInfo {
	phase: number;
	illumination: number;
	label: string;
}

export function moonInfo(date = new Date()): MoonInfo {
	const age = ((date.getTime() - NEW_MOON) / 86400000) % SYNODIC;
	const phase = (age + SYNODIC) % SYNODIC;
	const illumination = 0.5 * (1 - Math.cos((2 * Math.PI * phase) / SYNODIC));
	let label = 'Zunehmender Mond';
	if (phase < 1.8) label = 'Neumond';
	else if (phase < 6.4) label = 'Zunehmende Sichel';
	else if (phase < 8.9) label = 'Zunehmender Halbmond';
	else if (phase < 13.8) label = 'Zunehmender Mond';
	else if (phase < 16.2) label = 'Vollmond';
	else if (phase < 21.1) label = 'Abnehmender Mond';
	else if (phase < 23.6) label = 'Abnehmender Halbmond';
	else if (phase < 27.8) label = 'Abnehmende Sichel';
	else label = 'Neumond';
	return { phase, illumination, label };
}
