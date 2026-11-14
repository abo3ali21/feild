# Field Shift frontend

This directory contains the Next.js frontend for Field Shift, a decision-support application for comparing three-year crop rotations against regional climate and soil context. The UI is implemented in `app/` with TypeScript and React; the FastAPI service and project-level setup are documented in the root `README.md`.

## Requirements

- Node.js 22.13 or newer
- npm
- The Field Shift backend for live evaluations (the UI uses a labelled demonstration fallback when it is unavailable)

## Development

From this directory:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Configure `NEXT_PUBLIC_API_BASE_URL` to point to the backend when it is not running at `http://localhost:8000`.

## Checks

```sh
npm run lint
npx tsc --noEmit
npm run build
```

For the complete architecture, backend setup, sensor integration, deployment, and responsible-use notes, see `../README.md`.
