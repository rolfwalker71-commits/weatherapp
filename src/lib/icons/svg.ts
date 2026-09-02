export function prepareSymbol(raw: string): string {
	return raw
		.replace(/\s(width|height)="[^"]*"/g, '')
		.replace('<svg', '<svg fill="currentColor" class="block size-full" focusable="false"')
		.replace(/fill="#[^"]*"/g, 'fill="currentColor"');
}
