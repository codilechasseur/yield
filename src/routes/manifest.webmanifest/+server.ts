import { json } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { getSmtpSettings } from '$lib/mail.server.js';
import { getPreset } from '$lib/presets.js';

/**
 * Web app manifest, generated per-instance so a rebranded install (custom
 * app name / favicon / preset) carries through to the installed PWA.
 * Replaces the former static/manifest.webmanifest.
 */
export async function GET() {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	const smtp = await getSmtpSettings(pb).catch(() => null);

	const appName = smtp?.app_name?.trim() || 'Yield';
	const preset = getPreset(smtp?.brand_preset);

	const icons = smtp?.favicon
		? [{ src: `/api/favicon?v=${encodeURIComponent(smtp.favicon)}`, sizes: 'any', purpose: 'any' }]
		: [
				{ src: '/favicon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
				{ src: '/icon-192.png', type: 'image/png', sizes: '192x192', purpose: 'any' },
				{ src: '/icon-512.png', type: 'image/png', sizes: '512x512', purpose: 'any' },
				{ src: '/icon-maskable-512.png', type: 'image/png', sizes: '512x512', purpose: 'maskable' }
			];

	return json(
		{
			name: `${appName} — Invoicing`,
			short_name: appName,
			description: 'Self-hosted invoicing',
			start_url: '/',
			scope: '/',
			display: 'standalone',
			orientation: 'any',
			background_color: preset.preview.bg,
			theme_color: preset.themeColor,
			icons,
			screenshots: [],
			categories: ['finance', 'productivity']
		},
		{
			headers: {
				'Content-Type': 'application/manifest+json',
				'Cache-Control': 'public, max-age=3600'
			}
		}
	);
}
