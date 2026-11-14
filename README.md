# Field Shift: Adapting Farms with NASA Data

Field Shift is a transparent decision-support application for comparing three-year crop rotations against regional climate evidence, estimated soil conditions, crop-family breaks, and a deterministic multi-criteria scoring model. It does not predict yield.

## Architecture

- `frontend/`: Next.js/TypeScript planning workflow.
- `backend/`: FastAPI API, environmental adapters, deterministic ranking engine, and sensor integration.
- `firmware/field_shift_esp32/`: ESP32 firmware for local sensor readings and authenticated uploads.
- `hardware/`: notes and source sketches for the original sensor hardware.

## Local setup (Windows PowerShell)

Requirements: Node.js 22+, Python 3.12+, and npm.

From the repository root:

```powershell
Copy-Item .env.example .env
```

Start the backend in one terminal:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Start the frontend in another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open http://localhost:3000. The root `.env` is for local reference; the backend reads environment variables from its process, and Next.js reads frontend variables at build time. If not using a dotenv loader, set variables in each terminal before starting the corresponding service. By default, the frontend uses same-origin `/api` calls; set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` if developing without the Vercel local proxy configuration.

## Deploy frontend and backend to Vercel

This repository has a root `vercel.json` configured for Vercel Services: Next.js at `/` and FastAPI mounted under `/api`. Vercel Services availability may depend on your account/plan and is subject to the platform's current beta/rollout status. Check your Vercel dashboard supports Services before using this deployment shape.

1. Push the repository to GitHub/GitLab/Bitbucket and import it into Vercel.
2. Keep the Vercel project root directory set to the repository root (do not set it to `frontend/`); the root `vercel.json` defines both services.
3. Set the project's environment variables in **Settings → Environment Variables**:
   - `DEMO_MODE=false` for Production; use `true` for Preview if you want only demo data.
   - `CORS_ORIGINS` to the exact Vercel site origin, for example `https://your-project.vercel.app` (no trailing slash). If you use a custom domain, include that origin too, comma-separated.
   - `SENSOR_INTERNAL_TOKEN` only if internal sensor query endpoints are used. Generate a long random secret and do not prefix it with `NEXT_PUBLIC_`.
   - `SENSOR_SETUP_PATH` / `SENSOR_DB_PATH` are not durable storage on serverless functions. Do not rely on local files or SQLite for production sensor persistence; configure durable external storage before enabling real sensor ingestion.
4. Do not set `NEXT_PUBLIC_API_BASE_URL` for the combined deployment. The frontend uses same-origin requests to `/api/v1/...`; Vercel routes those to the backend service.
5. Deploy, then verify `https://your-project.vercel.app/api/v1/health` and the frontend homepage. Test `/api/v1/demo-profiles` and a farm evaluation as well.
6. After adding or changing variables in Vercel, redeploy so build-time frontend settings and backend settings take effect.

The frontend and backend share one Vercel origin in this setup, so CORS is generally not needed for browser API calls. Keep `CORS_ORIGINS` restricted to the actual site origin for any cross-origin clients.

**Persistence limitation:** `EVALUATIONS`, the sensor limiter, TTL cache, SQLite, and sensor setup file are process-local or filesystem-backed. Vercel Functions may scale and recycle instances, so the current API is not production-ready for persistent sensor readings or reliable simulation across separate invocations. A persistent database/shared state service is needed for those use cases. If Vercel Services is unavailable for your account, deploy the frontend and backend as separate Vercel projects (frontend root `frontend/`, backend root `backend/` with a FastAPI entrypoint) and set the frontend's `NEXT_PUBLIC_API_BASE_URL` to the backend's public URL; configure backend `CORS_ORIGINS` to the frontend origin.

For current setup/deployment details, see [Vercel Services](https://vercel.com/docs/services), [Services routing](https://vercel.com/docs/services/routing), and [FastAPI on Vercel](https://vercel.com/docs/frameworks/backend/fastapi).

## Local environment variables

| Variable | Purpose | Local default |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | API base URL used by the browser; blank uses same-origin `/api` | blank |
| `DEMO_MODE` | Skip external data calls and use clearly labelled demo estimates | `true` |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins | `http://localhost:3000` |
| `SENSOR_DB_PATH` | SQLite path for local sensor readings | `./sensor_readings.db` |
| `SENSOR_SETUP_PATH` | Device/farm association JSON | `backend/app/data/sensor_setup.json` |
| `SENSOR_INTERNAL_TOKEN` | Secret for internal sensor query routes | unset; query routes reject requests |
| `SENSOR_MAX_AGE_HOURS` | Freshness window for sensor scoring | `24` |
| `SENSOR_WATER_INFLUENCE` | Bounded soil-moisture effect on water score; `0` disables | `0.10` |
| `SENSOR_RATE_LIMIT_PER_MINUTE` | Per-device submission limit in this process | `10` |

Never commit real credentials. `.env` is git-ignored; configure production secrets in Vercel's dashboard.

## API

- `GET /api/v1/health`
- `GET /api/v1/crops`
- `GET /api/v1/demo-profiles`
- `POST /api/v1/farms/evaluate`
- `POST /api/v1/farms/simulate`
- `POST /api/v1/sensors/readings`
- `GET /api/v1/sensors/{farm_id}/latest`
- `GET /api/v1/sensors/{farm_id}/history`
- `GET /api/v1/sensors/{farm_id}/status`

Interactive API documentation is available at `/docs` when the backend is running.

## Method and limitations

The engine filters crops using configurable heat, water, pH, irrigation, and family-break criteria. It scores viable three-year rotations across climate, water, soil, and diversity dimensions with transparent preset weights. Reference crop thresholds require local agronomic calibration. NASA POWER and SoilGrids are regional estimates; demo/fallback data is visibly labelled. The application is comparative decision support, not a yield forecast or substitute for local extension advice.
