# OREXMINE

OREXMINE is a B2B mineral trading platform with a buyer-facing interactive mineral showcase and an operations console for procurement, quality, inventory, sales, payments, logistics, and compliance.

The product is currently at the foundation stage. Product scope is documented in [OREXMINE_FRD_Revised_MVP.md](OREXMINE_FRD_Revised_MVP.md).

## Getting Started

Requirements:

- Node.js 20.19+ or 22.13+ LTS is recommended. Node 23 works for the current scaffold but may produce package-manager engine warnings.
- npm 10+
- Docker Desktop, if using the local PostgreSQL Compose service.

Install dependencies:

```bash
npm install
```

Create the development environment file:

```powershell
Copy-Item .env.development.example .env.development
```

Start PostgreSQL after installing Docker Desktop:

```bash
npm run db:up:development
npm run db:generate
npm run db:push
```

Run the development server:

```bash
npm run dev
# or
yarn dev
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Open [http://localhost:3000](http://localhost:3000) in a browser.

## Environment Workflow

Development uses `.env.development` and a database named `orexmine_development`.
The Compose project and volume are also named `orexmine-development`, so local
development data cannot share the production volume accidentally.

Staging and production should each be deployed as separate application
instances with separate `DATABASE_URL` and `NEXT_PUBLIC_APP_URL` values. Set
those values in the deployment platform using `.env.production.example` as the
reference; do not commit `.env.production` or production credentials. Build the
same commit in staging first, run migrations against the staging database, and
promote that tested commit to production only after verification.

For a production-mode local build, provide production values through the
shell or deployment platform, then run:

```bash
npm run build
npm run start
```

## Available Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | Run TypeScript checks |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest tests |
| `npm run test:e2e` | Run Playwright browser tests |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:push` | Apply the Prisma schema to the local database |
| `npm run db:studio` | Open Prisma Studio |

## Project Foundation
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- Next.js, React, and TypeScript
- React Three Fiber and Three.js for interactive mineral assets
- PostgreSQL and Prisma for transactional records
- S3/R2-compatible object storage direction for documents and GLB assets
- Vitest, Testing Library, and Playwright for validation

The database schema currently covers organizations, users, miners, buyers, mineral assets, and inventory batches. Procurement, QC, sales orders, reservations, payments, logistics, and audit entities will be added as implementation proceeds.
