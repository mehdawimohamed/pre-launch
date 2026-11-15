# Crowdfunding Market-Test MVP

Market demand testing platform for Kickstarter-style crowdfunding in Tunisia and the wider MENA region.

> **Status: Pre-launch (under active MVP development)**
>
> **Important:** This is an experimental market test. **No real money moves** through this platform. Pledges indicate user backing and demand ("I'd back this") without financial transactions.

---

## Overview

- **Core Goal:** Measure genuine market demand for project crowdfunding in Tunisia.
- **Pledge Mechanism:** Single-click commitment per user per campaign with duplicate prevention.
- **Access & Auth:** Google OAuth login. Public campaign browsing without login; pledge counters remain hidden until authenticated.
- **Campaign Flow:** Logged-in users can draft campaigns; mandatory administrative approval before any campaign is published.
- **Multilingual Support:** Arabic (RTL embedded in LTR shell), French, and English.
- **Architecture:** Monorepo with Next.js web application, NestJS API, PostgreSQL database, and Cloudflare storage/tunnels.

---

## Local Development (Coming Soon)

Local setup instructions will become active once workspace scaffolding (Step 0.2+) is merged:

```bash
# Clone the repository
git clone https://github.com/[owner]/[repo].git
cd [repo]

# Copy environment placeholders
cp .env.example .env

# Install dependencies (requires Node Active LTS and pnpm)
pnpm install

# Run checks across workspaces
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### Local setup

1. Copy the root template: `cp .env.example .env`
2. Fill in your development credentials (database, OAuth, etc.)
3. Start the database: `docker compose -f deploy/docker-compose.dev.yml up -d` (or your local Postgres)
4. Run `pnpm install`, then `pnpm --filter @pre-launch/api prisma:generate`

The project has **one** `.env` file at the repo root. Each app resolves it from its
own location, so `pnpm dev`, `prisma migrate`, and `next dev` all read the same file
regardless of the current working directory. In CI and production, plain environment
variables are used instead — no `.env` file is needed.

---

## Environment Variables Convention

This repository is **strictly public**. Never commit secrets, tokens, private keys, or `.env` files.
All configuration parameters are documented with placeholder values in the root `.env.example`.

- **One env file:** `.env` lives at the repo root only. There are no env files inside `apps/` or `packages/`.
- **Browser safety:** Only `NEXT_PUBLIC_*` variables reach the browser; never prefix a secret with `NEXT_PUBLIC_`.
- **Production:** Variables come from the compose environment or the host, not from a file.

---

## Contributing

Please review [CONTRIBUTING.md](CONTRIBUTING.md) for branch workflow, Conventional Commits guidelines, and Developer Certificate of Origin (DCO) sign-off requirements.

---

## Security

Please report vulnerabilities privately. See [SECURITY.md](SECURITY.md) for details on GitHub Private Vulnerability Reporting. Do not open public issues for security concerns.

---

## License

This project is licensed under the [Apache-2.0 License](LICENSE) (SPDX: `Apache-2.0`). See the [NOTICE](NOTICE) file for additional attribution details.
