import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { execSync } from 'child_process';

function getAppVersion(command: string): string {
	if (command === 'serve') return 'dev';
	try {
		return execSync('git describe --tags --always', { encoding: 'utf8' }).trim();
	} catch {
		return 'dev';
	}
}

export default defineConfig(({ command }) => ({
	define: {
		__APP_VERSION__: JSON.stringify(getAppVersion(command))
	},
	plugins: [tailwindcss(), sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		globals: true,
		environment: 'node',
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			include: ['src/lib/**']
		}
	}
}));
