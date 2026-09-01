/** @type {import('tailwindcss').Config} */
export default {
	darkMode: 'class',
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				background: 'rgb(var(--background) / <alpha-value>)',
				foreground: 'rgb(var(--foreground) / <alpha-value>)',
				card: 'rgb(var(--card) / <alpha-value>)',
				primary: 'rgb(var(--primary) / <alpha-value>)',
				'on-primary': 'rgb(var(--on-primary) / <alpha-value>)',
				secondary: 'rgb(var(--secondary) / <alpha-value>)',
				muted: 'rgb(var(--muted) / <alpha-value>)',
				'muted-foreground': 'rgb(var(--muted-foreground) / <alpha-value>)',
				border: 'rgb(var(--border) / <alpha-value>)',
				ring: 'rgb(var(--ring) / <alpha-value>)',
				destructive: 'rgb(var(--destructive) / <alpha-value>)'
			},
			borderRadius: {
				DEFAULT: 'var(--radius)',
				panel: 'var(--radius)'
			},
			fontFamily: {
				sans: 'var(--font-sans)'
			},
			transitionTimingFunction: {
				emphasized: 'var(--ease-emphasized)'
			}
		}
	},
	plugins: []
};
