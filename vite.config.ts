import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		host: '0.0.0.0',
		port: 5173,
		proxy: {
			'/api/push': {
				target: 'http://127.0.0.1:4426',
				rewrite: (path) => path.replace(/^\/api\/push/, '')
			},
			'/api/metar': {
				target: 'https://aviationweather.gov',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api\/metar/, '/api/data/metar')
			}
		}
	},
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			strategies: 'generateSW',
			kit: {
				adapterFallback: '200.html'
			},
			includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png', 'push-sw.js'],
			manifest: {
				name: 'Wetter Schweiz',
				short_name: 'Wetter',
				description: 'Moderne Wetter-PWA mit Fokus auf die Schweiz — weltweit nutzbar.',
				lang: 'de-CH',
				theme_color: '#006874',
				background_color: '#f4fbfb',
				display: 'standalone',
				orientation: 'portrait-primary',
				scope: '/',
				start_url: '/',
				categories: ['weather', 'utilities'],
				icons: [
					{
						src: 'pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png'
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,webmanifest}'],
				navigateFallback: '/200.html',
				navigateFallbackDenylist: [/^\/api\//],
				importScripts: ['/push-sw.js'],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'open-meteo-forecast',
							expiration: {
								maxEntries: 48,
								maxAgeSeconds: 60 * 60
							},
							networkTimeoutSeconds: 4
						}
					},
					{
						urlPattern: /^https:\/\/geocoding-api\.open-meteo\.com\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'open-meteo-geocoding',
							expiration: {
								maxEntries: 80,
								maxAgeSeconds: 60 * 60 * 24
							},
							networkTimeoutSeconds: 4
						}
					},
					{
						urlPattern: /^https:\/\/air-quality-api\.open-meteo\.com\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'open-meteo-air',
							expiration: {
								maxEntries: 32,
								maxAgeSeconds: 60 * 60
							},
							networkTimeoutSeconds: 4
						}
					},
					{
						urlPattern: /^https:\/\/api\.bigdatacloud\.net\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'reverse-geocode',
							expiration: {
								maxEntries: 32,
								maxAgeSeconds: 60 * 60 * 24
							},
							networkTimeoutSeconds: 4
						}
					},
					{
						urlPattern: /^https:\/\/api\.rainviewer\.com\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'rainviewer-catalog',
							expiration: {
								maxEntries: 8,
								maxAgeSeconds: 5 * 60
							},
							networkTimeoutSeconds: 4
						}
					},
					{
						urlPattern: /^https:\/\/tilecache\.rainviewer\.com\/.*/i,
						handler: 'StaleWhileRevalidate',
						options: {
							cacheName: 'rainviewer-tiles',
							expiration: {
								maxEntries: 180,
								maxAgeSeconds: 30 * 60
							}
						}
					},
					{
						urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*/i,
						handler: 'StaleWhileRevalidate',
						options: {
							cacheName: 'esri-basemap',
							expiration: {
								maxEntries: 220,
								maxAgeSeconds: 60 * 60 * 24 * 7
							}
						}
					},
					{
						urlPattern: /^https:\/\/view\.eumetsat\.int\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'eumetsat-lightning',
							expiration: {
								maxEntries: 80,
								maxAgeSeconds: 5 * 60
							},
							networkTimeoutSeconds: 6
						}
					},
					{
						urlPattern: /^https:\/\/lindas\.admin\.ch\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'bafu-lindas',
							expiration: {
								maxEntries: 16,
								maxAgeSeconds: 15 * 60
							},
							networkTimeoutSeconds: 5
						}
					},
					{
						urlPattern: /^https:\/\/data\.geo\.admin\.ch\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'meteoswiss-ogd',
							expiration: {
								maxEntries: 8,
								maxAgeSeconds: 60 * 60
							},
							networkTimeoutSeconds: 6
						}
					}
				]
			},
			devOptions: {
				enabled: false
			}
		})
	]
});
