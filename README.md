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

---

## Environment Variables Convention

This repository is **strictly public**. Never commit secrets, tokens, private keys, or `.env` files.
All configuration parameters are documented with dummy placeholder values in `.env.example` files:
- Root template: `.env.example`
- Workspace templates (once created): `apps/web/.env.example`, `apps/api/.env.example`

To configure your local environment, copy `.env.example` to `.env` and provide your development credentials. `.env` is ignored by git.

---

## Contributing

Please review [CONTRIBUTING.md](CONTRIBUTING.md) for branch workflow, Conventional Commits guidelines, and Developer Certificate of Origin (DCO) sign-off requirements.

---

## Security

Please report vulnerabilities privately. See [SECURITY.md](SECURITY.md) for details on GitHub Private Vulnerability Reporting. Do not open public issues for security concerns.

---

## License

This project is licensed under the [Apache-2.0 License](LICENSE) (SPDX: `Apache-2.0`). See the [NOTICE](NOTICE) file for additional attribution details.
