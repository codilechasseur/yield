import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		// SvelteKit adds nonces/hashes for its own inline scripts; the theme boot
		// script in app.html carries %sveltekit.nonce%. Styles stay 'unsafe-inline'
		// because components use style attributes and admins can add custom CSS.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
				'font-src': ['self', 'data:', 'https://fonts.gstatic.com'],
				'img-src': ['self', 'data:', 'blob:'],
				'connect-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;
