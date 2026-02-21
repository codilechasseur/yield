# Yield — Copilot Instructions

## Project overview
Yield is a self-hosted invoicing app built with **SvelteKit** (Node adapter), **PocketBase** as the database/backend, and **Tailwind CSS v4** for styling. All data access is server-side only (`+page.server.ts` / `+server.ts`).

## Testing — always write tests for new code

### Unit tests (Vitest)
- **Location:** `src/lib/__tests__/`
- **Run:** `npm run test:unit`
- **Framework:** Vitest with Node environment and globals enabled

Write unit tests whenever you:
- Add or modify any function in `src/lib/`
- Add new pure logic anywhere (formatters, calculators, validators, helpers)

Rules:
- One `*.test.ts` file per source file, named to match (e.g. `auth.server.ts` → `auth.server.test.ts`)
- Cover the happy path, edge cases (zero, empty, null/undefined), and error paths
- Use `vi.spyOn(Date, 'now')` + `vi.restoreAllMocks()` for time-dependent logic — never use `setTimeout`
- Do not mock the module under test; test real implementations

### E2E tests (Playwright)
- **Location:** `tests/e2e/`
- **Run:** `npm run test:e2e` (requires a running PocketBase + built app — see CI workflow)
- **Framework:** Playwright, Chromium only

Write E2E tests whenever you:
- Add a new route or page
- Add a new form action (create, edit, delete flows)
- Add a new API endpoint

Rules:
- Prefer `getByRole` and `getByLabel` selectors over CSS classes or test-ids
- Each `describe` block should cover one route or feature
- Tests must work against a clean (empty) database — do not assume pre-existing records unless the test creates them

### CI
The GitHub Actions workflow (`.github/workflows/ci.yml`) runs automatically on every push/PR:
1. `svelte-check` — type errors fail the build
2. Vitest unit tests with coverage
3. `vite build`
4. Playwright E2E tests against a live PocketBase instance

**A PR is not complete until all three pass in CI.**

## Accessibility (a11y)

- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<section>`, `<header>`, etc.) rather than generic `<div>`/`<span>` elements with click handlers
- Every `<img>` must have a meaningful `alt` attribute; decorative images use `alt=""`
- All form inputs must have an associated `<label>` (via `for`/`id` or wrapping)
- Interactive elements must be keyboard-navigable and focusable; never remove `:focus` styles without a visible replacement
- Use ARIA attributes (`aria-label`, `aria-describedby`, `role`, etc.) only when semantic HTML alone is insufficient
- Colour contrast must meet WCAG AA (4.5:1 for normal text, 3:1 for large text)
- Avoid conveying information through colour alone — pair colour with text or icons

## Code conventions
- All PocketBase calls are server-side only — never import `pocketbase` in client-side code or `.svelte` script blocks
- Use `$lib/types.ts` for shared TypeScript interfaces; never inline ad-hoc types for domain objects
- Prefer `fail()` from `@sveltejs/kit` for form validation errors; use `redirect()` for post-action navigation
- Environment variables are read from `$env/dynamic/private` — never hardcode URLs or secrets
- Server-only modules must use the `.server.ts` suffix (e.g. `auth.server.ts`, `mail.server.ts`)

## PocketBase patterns

### Instantiation
Each `load` function and action creates its own PocketBase instance — there is no shared singleton:
```ts
const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
```

### Reading settings
Always use `getSmtpSettings(pb)` from `$lib/mail.server.ts` to read the `settings` collection — never query it directly. It returns `SmtpSettings | null`.

### Settings upsert pattern
The `settings` collection has at most one record. Always upsert:
```ts
const existing = await getSmtpSettings(pb);
if (existing?.id) {
    await pb.collection('settings').update(existing.id, { ... });
} else {
    await pb.collection('settings').create({ ... });
}
```

### Password cache invalidation
After writing a new `app_password_hash` to settings, always call `invalidatePasswordCache()` from `$lib/auth.server.ts`.

### Graceful degradation
`load` functions should catch PocketBase errors and return empty arrays/nulls rather than throwing, so the page renders even if the DB is temporarily unavailable:
```ts
const clients = await pb.collection('clients').getFullList().catch(() => [] as Client[]);
```

### Pagination
Use `pb.collection(...).getList(page, PER_PAGE, { sort, filter })` (not `getFullList`) for any list that could grow unbounded. `PER_PAGE = 20` is the app-wide default.

## Route / auth patterns

- Authentication is enforced globally in `src/hooks.server.ts` — do **not** add per-route auth checks
- `locals.authEnabled` (boolean) is set by the hook and available to all layouts and pages
- The PDF endpoint lives at `src/routes/api/invoice/[id]/pdf/+server.ts` and uses Puppeteer; reuse it via a fetch to `/api/invoice/[id]/pdf` rather than duplicating the generation logic
- `SmtpSettings` type is defined in `$lib/mail.server.ts`, not in `$lib/types.ts` — this is intentional because it is server-only
