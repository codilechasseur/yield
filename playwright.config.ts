import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? 'github' : 'list',

	use: {
		baseURL: process.env.APP_URL || 'http://localhost:4173',
		trace: 'on-first-retry'
	},

	projects: [
		// Run the auth setup first (creates password + logs in, saves storageState)
		{
			name: 'setup',
			testMatch: /auth\.setup\.ts/
		},
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				storageState: 'tests/e2e/.auth/user.json'
			},
			dependencies: ['setup']
		}
	],

	// For local runs: `npm run build` first, then Playwright will start preview
	webServer: process.env.CI
		? undefined // CI starts the server manually in the workflow
		: {
				command: 'npm run preview',
				url: 'http://localhost:4173',
				reuseExistingServer: true,
				timeout: 60_000,
				env: {
					PB_URL: process.env.PB_URL || 'http://localhost:8090'
				}
		  }
});
