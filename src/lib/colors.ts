export type WeatherMood = 'clear' | 'cloud' | 'rain' | 'snow' | 'storm' | 'night' | 'fog';
export type ScaleTone = 'neutral' | 'good' | 'fair' | 'warn' | 'bad' | 'extreme';

export function moodIconClass(mood: WeatherMood): string {
	return `wx-icon-${mood}`;
}

export function moodChipClass(mood: WeatherMood): string {
	return `wx-chip-${mood}`;
}

export function moodFillClass(mood: WeatherMood): string {
	return `wx-fill-${mood}`;
}

export function scaleFillClass(tone: ScaleTone): string {
	return `wx-scale-${tone}`;
}

export function scaleBarClass(tone: ScaleTone): string {
	return `wx-bar-${tone}`;
}

export function scaleIconClass(tone: ScaleTone): string {
	return `wx-scale-icon-${tone}`;
}
