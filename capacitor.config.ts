import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'ch.rolfwalker.wetter',
	appName: 'Wetter Schweiz',
	webDir: 'build',
	backgroundColor: '#f4fbfb',
	ios: {
		contentInset: 'never',
		// The page scrolls inside .wx-shell; the document itself must not rubber-band or shift.
		scrollEnabled: false
	},
	plugins: {
		PushNotifications: {
			// Show banners while the app is open too, like Apple Weather's severe-weather alerts.
			presentationOptions: ['banner', 'list', 'sound']
		}
	}
};

export default config;
