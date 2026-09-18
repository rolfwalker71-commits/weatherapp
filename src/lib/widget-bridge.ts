import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './platform';
import type { Place, WindUnit } from './types';

/** Native side: ios/App/App/WidgetBridgePlugin.swift (writes to the widget's App Group). */
interface WidgetBridgePlugin {
	setPlace(options: {
		name: string;
		latitude: number;
		longitude: number;
		isCurrentLocation: boolean;
	}): Promise<void>;
	setWindUnit(options: { unit: WindUnit }): Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

/** Tells the home/lock screen widgets which place to show. No-op outside the iOS app. */
export function shareWidgetPlace(place: Place, isCurrentLocation: boolean): void {
	if (!isNativeApp()) return;
	void WidgetBridge.setPlace({
		name: place.name,
		latitude: place.latitude,
		longitude: place.longitude,
		isCurrentLocation
	}).catch(() => {
		/* widget is optional */
	});
}

/** Keeps the widgets on the same wind unit as Einstellungen → Einheiten. */
export function shareWidgetWindUnit(unit: WindUnit): void {
	if (!isNativeApp()) return;
	void WidgetBridge.setWindUnit({ unit }).catch(() => {
		/* widget is optional */
	});
}
