# Field Shift frontend

This directory contains the Next.js frontend for Field Shift, a decision-support application for comparing three-year crop rotations against regional climate and soil context. The UI is implemented in `app/` with TypeScript and React; the FastAPI service and project-level setup are documented in the root `README.md`.

## Requirements

- Node.js 22.13 or newer
- npm
- The Field Shift backend for live evaluations (the UI uses a labelled demonstration fallback when it is unavailable)

## Local run with the API

Install backend dependencies and start FastAPI first (see the root `README.md`), then from this directory run:

```powershell
npm ci
npm run dev
```

Open http://localhost:3000. The local Next.js rewrite proxies `/api/...` calls to `http://localhost:8000`, so no frontend `.env` is needed. The interface still falls back to clearly labelled demo results if the backend or upstream data providers are unavailable.

## Checks

```sh
npm run lint
npx tsc --noEmit
npm run build
```

For the complete architecture, backend setup, sensor integration, deployment, and responsible-use notes, see `../README.md`.
