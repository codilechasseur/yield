/**
 * Brand preset registry — shared by the settings UI, the Logo component, and
 * the dynamic web manifest.
 *
 * A preset is a named token override block that lives in CSS (see
 * `src/presets.css`), scoped under `:root[data-preset='<id>']`. This file only
 * carries the metadata the UI and server need: labels, picker swatches, the
 * logo mark, and the manifest theme colour.
 *
 * To add a preset: create `src/presets/<id>.css`, import it from
 * `src/presets.css`, and register it here.
 */

export interface BrandPreset {
	id: string;
	label: string;
	description: string;
	/** Which built-in logo mark to render when no custom app logo is uploaded. */
	mark: 'chart' | 'block-cursor';
	/** Used for <meta name="theme-color"> and the web manifest. */
	themeColor: string;
	/** Picker swatch colours (light-mode values). */
	preview: { bg: string; fg: string; accent: string };
	/** True when the preset defines its own full palette, making the hue picker moot. */
	hueLocked: boolean;
	/** Overrides the hue-derived accent (top bar / accent dot) on invoice and
	 * estimate PDFs. Omit to keep the hue-based colour. */
	pdfAccent?: string;
}

export const PRESETS: BrandPreset[] = [
	{
		id: '',
		label: 'Yield',
		description: 'The default look — pick any highlight colour below.',
		mark: 'chart',
		themeColor: '#4361ee',
		preview: { bg: '#fafafd', fg: '#1a1c22', accent: '#4361ee' },
		hueLocked: false
	},
	{
		id: 'codi',
		label: 'Codi',
		description: 'Paper, ink, and signal orange. Archivo type, square corners.',
		mark: 'block-cursor',
		themeColor: '#111111',
		preview: { bg: '#f2f0eb', fg: '#111111', accent: '#ff4a17' },
		hueLocked: true,
		/* signal is for fills and shapes — the PDF top bar qualifies */
		pdfAccent: '#ff4a17'
	}
];

export function getPreset(id: string | undefined | null): BrandPreset {
	return PRESETS.find((p) => p.id === (id ?? '')) ?? PRESETS[0];
}

export interface FontOption {
	id: string;
	label: string;
	/** CSS font-family stack, for previewing in the picker. */
	stack: string;
}

/** Curated, self-hostable UI font choices ('' = whatever the preset ships). */
export const FONTS: FontOption[] = [
	{ id: '', label: 'Preset default', stack: 'var(--font-sans)' },
	{ id: 'inter', label: 'Inter', stack: "'Inter', system-ui, sans-serif" },
	{ id: 'archivo', label: 'Archivo', stack: "'Archivo', system-ui, sans-serif" },
	{ id: 'jetbrains-mono', label: 'JetBrains Mono', stack: "'JetBrains Mono', ui-monospace, monospace" },
	{ id: 'system', label: 'System', stack: 'system-ui, -apple-system, sans-serif' }
];
