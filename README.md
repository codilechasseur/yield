# Yield

A clean, self-hosted invoicing app for freelancers and small agencies. No subscriptions, no third-party servers — fully yours.

---

## Features

- **Clients** — manage clients with contact info, address, and preferred currency
- **Invoices** — line-item invoices with tax, notes, and status tracking (draft → sent → paid)
- **PDF export** — server-rendered A4 PDFs via Puppeteer
- **Email** — send invoices directly from the app via your own SMTP server
- **Reports** — revenue and outstanding balance summaries
- **Branding** — custom logo, colour theme, and payment info on every invoice
- **Password protection** — optional single-user login, configurable via Settings
- **Self-contained** — everything runs in Docker, zero external dependencies

---

## Stack

| Layer | Technology |
|---|---|
| Frontend / SSR | [SvelteKit 2](https://kit.svelte.dev) + Svelte 5 (runes) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Database | [PocketBase v0.36.4](https://pocketbase.io) (SQLite) |
| PDF | [Puppeteer](https://pptr.dev) (server-side, system Chromium) |
| Proxy / TLS | [Caddy 2](https://caddyserver.com) (automatic HTTPS via Let's Encrypt) |
| Runtime | Node.js 22, Docker Compose |

---

## Deployment

> The schema is applied automatically on first boot — no setup scripts required.

### Prerequisites

- A server or NAS running Docker + Docker Compose v2
- A domain name with two DNS `A` records pointing at your server's public IP:
  ```
  yourdomain.com      →  <server IP>
  pb.yourdomain.com   →  <server IP>
  ```
- Ports **80** and **443** open in your firewall

### 1. Clone and configure

```bash
git clone https://github.com/YOUR_USERNAME/yield.git
cd yield
cp .env.example .env
```

Open `.env` and fill in three values:

```env
DOMAIN=yourdomain.com
PB_ADMIN_EMAIL=admin@example.com
PB_ADMIN_PASSWORD=a-strong-password
```

### 2. Start

```bash
docker compose up -d --build
```

On first boot, Yield automatically:
1. Starts PocketBase
2. Creates the admin superuser using the credentials in your `.env`
3. Imports the full database schema (clients, invoices, settings, taxes, etc.)

### 3. Access

| URL | Service |
|---|---|
| `https://yourdomain.com` | Yield app |
| `https://pb.yourdomain.com/_/` | PocketBase admin UI |

### Updating

```bash
git pull
docker compose up -d --build
```

Data lives in the `pb_data` Docker volume and is never touched by a rebuild.

### Backups

```bash
docker run --rm \
  -v yield_pb_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/pb_data_$(date +%Y%m%d).tar.gz -C /data .
```

Restore by extracting this archive into the volume before starting the stack.

---

## First-run configuration

Open the app and go to **Settings** to:

- Upload your logo and set your business name + address
- Configure your default tax rate and currency
- Set up SMTP to send invoices by email
- Optionally enable password protection for the UI

---

## Development

### Setup

```bash
# Download PocketBase for your OS from https://pocketbase.io/docs/
./pocketbase serve --http="0.0.0.0:8090"

# Bootstrap the schema (only needed once)
PB_URL=http://localhost:8090 \
PB_ADMIN_EMAIL=admin@example.com \
PB_ADMIN_PASSWORD=your-password \
node pb_setup.js

# Install and run
cp .env.example .env
npm install --legacy-peer-deps
npm run dev
```

App runs at http://localhost:5173 · PocketBase admin at http://localhost:8090/_/

---

## Harvest Migration

You can import Harvest data either through the UI or from the command line.

### Via the UI (recommended)

Once the app is running, go to **Settings → Data Import** and upload your Harvest invoice report CSV. Clients, invoices, and line items are created automatically. The import is idempotent — existing records are skipped.

If no data exists yet, the dashboard will show a banner linking directly to the import section.

### Via the command line

```bash
PB_URL=http://localhost:8090 \
PB_ADMIN_EMAIL=admin@example.com \
PB_ADMIN_PASSWORD=your-password \
node migrate.js path/to/harvest_export.csv
```

---

## Project Structure

```
src/
├── lib/
│   ├── components/Nav.svelte     # Sidebar navigation
│   ├── pocketbase.ts             # Shared utilities (formatting, calc helpers)
│   └── types.ts                  # TypeScript interfaces
└── routes/
    ├── +page.svelte              # Dashboard (stats, recent invoices)
    ├── clients/                  # Client list, create, detail, edit
    ├── invoices/                 # Invoice list, builder, detail, editor
    ├── reports/                  # Revenue reports
    ├── settings/                 # Branding, SMTP, tax, password
    ├── taxes/                    # Tax rate management
    ├── login/                    # Password-protection login
    └── api/invoice/[id]/pdf/     # Puppeteer PDF endpoint

pb_schema.json          # PocketBase collection definitions
pb_setup.js             # Schema bootstrap script (dev / CI)
migrate.js              # Harvest CSV importer
entrypoint.sh           # PocketBase first-boot auto-init script
Dockerfile              # SvelteKit app (multi-stage, includes Chromium)
Dockerfile.pocketbase   # PocketBase (auto-initialises on first boot)
Caddyfile               # Reverse proxy + automatic TLS
docker-compose.yml
```

---

## License

MIT
