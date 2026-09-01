<script lang="ts">
	import { page } from '$app/stores';
</script>

<main class="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
	<h1 class="text-3xl font-semibold tracking-tight">Etwas ist schiefgelaufen</h1>
	<p class="mt-3 leading-snug text-muted-foreground">
		{$page.status}
		{$page.error?.message ?? 'Unbekannter Fehler'}
	</p>
	<a href="/" class="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-5 text-on-primary [html[data-chrome=desktop]_&]:rounded-md">
		Zur Startseite
	</a>
</main>
