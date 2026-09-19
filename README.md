# Field Shift: Adapting Farms with NASA Data

Field Shift is a hackathon-ready decision-support application for agricultural extension workers and rainfed farmers. It compares deterministic, three-year crop rotations against regional climate evidence, estimated soil conditions, crop-family breaks, and an explicit multi-criteria scoring model. It does **not** predict yield and does not use an LLM to calculate recommendations.

## Architecture

~~~mermaid
flowchart LR
  U[Extension worker / farmer] --> N[Next.js frontend]
  N --> F[FastAPI backend]
  F --> P[NASA POWER adapter]
  F --> S[ISRIC SoilGrids adapter]
  F -. optional .-> M[SMAP adapter]
  F --> C[Crop knowledge base]
  F --> E[Hard filters + MCDA engine]
  F --> D[(TTL cache / optional PostGIS)]
  E --> F --> N
~~~

The frontend is a responsive Next.js/TypeScript planning workflow with five demo farms, clear loading stages, ranked and comparison views, a methodology dialog, and scenario sliders. The backend is a Python/FastAPI service with pure calculations, configurable JSON crop data, resilient HTTP adapters, deterministic ranking, and in-memory evaluation state for simulations.

## Data sources and status

- **NASA POWER**: daily T2M maximum/minimum, corrected precipitation, humidity, and solar radiation. Live requests use four recent complete years and a 180-day seasonal window.
- **ISRIC SoilGrids**: 0–30 cm clay, sand, silt, pH, and soil organic carbon estimates.
- **SMAP**: adapter boundary only. Root-zone moisture is marked UNAVAILABLE; the app never invents a live SMAP measurement.
- **Demo fallback**: five regional tendency profiles. Fallback and estimated data are always visibly labelled.

Crop thresholds are configurable MVP reference parameters with notes. They must be calibrated with local agronomic expertise before operational use.

## Local setup

Requirements: Node.js 22+, Python 3.12+, and npm or pnpm.

~~~bash
cp .env.example .env

cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
~~~

In another terminal:

~~~bash
cd frontend
npm ci
npm run dev
~~~

Open http://localhost:3000. The frontend automatically activates its labelled demonstration fallback if the backend cannot be reached.

For containers:

~~~bash
docker compose up --build
~~~

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| NEXT_PUBLIC_API_BASE_URL | Browser-visible FastAPI base URL | http://localhost:8000 |
| NEXT_PUBLIC_MAPBOX_TOKEN | Reserved for an optional Mapbox implementation | blank |
| DATABASE_URL | Reserved for PostgreSQL/PostGIS persistence | blank; bundled JSON/in-memory fallback |
| NASA_EARTHDATA_TOKEN | Reserved for an authenticated SMAP adapter | blank |
| DEMO_MODE | Skip external requests and use explicit demo estimates | true |
| CORS_ORIGINS | Comma-separated allowed frontend origins | http://localhost:3000 |

No private credential is required for the demo. Never commit real values.

## API

- GET /api/v1/health — service health and deterministic-engine status.
- GET /api/v1/crops — all 15 crop reference records.
- GET /api/v1/demo-profiles — selectable demo farm metadata.
- POST /api/v1/farms/evaluate — validate a farm, build environmental context, filter candidates, and return the top three materially different rotations.
- POST /api/v1/farms/simulate — re-run an evaluation with rainfall (-40% to +20%), warming (0°C to +4°C), and irrigation changes.

Interactive OpenAPI documentation is available at http://localhost:8000/docs.

## Deterministic methodology

1. Climate and soil adapters return live, cached, estimated, unavailable, or fallback status.
2. Hard filters remove crops that fail minimum seasonal GDD, material pH tolerance, critical rainfed water, irrigation dependence, extreme repeated heat, or crop-family break rules.
3. Candidate three-year permutations prohibit adjacent/repeated families inside configured break intervals.
4. Each viable sequence receives normalized climate, water, soil, and diversity scores in [0, 1].
5. Preset MCDA weights produce an overall score displayed as 0–100.

~~~text
overall = climate_weight × climate_score
        + water_weight × water_score
        + soil_weight × soil_score
        + diversity_weight × diversity_score
~~~

Water scoring combines normalized rainfall fit, anomaly, irrigation, drought tolerance, and texture factors; it never adds volumetric soil moisture directly to rainfall millimetres. Stable tie-breaking makes rankings reproducible.

## Demo profiles

Choose a profile in the first step and continue through conditions, goal, and review:

1. Semi-Arid Sahel, Senegal
2. Iowa Corn Belt, USA
3. Punjab / Indus Basin, Pakistan
4. Andean smallholder, Peru
5. Western Australian Wheat Belt

Profiles store regional tendencies, not fixed winners. In demo mode, both the API and browser fallback label output as demonstration or estimated data.

## Tests and checks

~~~bash
cd backend
pytest -q

cd ../frontend
npm run lint
npx tsc --noEmit
npm run build
~~~

The suite covers GDD, rainfall anomaly, weight normalization, pH and family filtering, water and score bounds, stable ranking, fallbacks, external timeouts, all five demos, and all required API workflows.

## Deployment

- **Frontend**: import frontend/ into Vercel and set NEXT_PUBLIC_API_BASE_URL to the public API origin.
- **Backend**: deploy backend/ as a Docker service on Render or Fly.io. Set DEMO_MODE=false, configure exact CORS_ORIGINS, and use /api/v1/health as the health check.
- **Combined local demo**: use Docker Compose.

Logs contain evaluation IDs and profile labels, not farm secrets. External clients use bounded timeouts, schema checks, and exponential backoff.

## Known limitations

- A generic 180-day season is used until crop calendars are made location-aware.
- SoilGrids and NASA POWER are regional estimates and may miss field-scale drainage or microclimate.
- Simulation warms the existing seasonal context; it is not a future daily weather forecast.
- Evaluation state and cache are process-local in the MVP. Configure PostgreSQL/PostGIS and a shared cache for multi-instance production.
- Market prices, pest outbreaks, field boundaries, exact fertilizer prescriptions, and yield prediction are out of scope.

## Responsible use

> Field Shift provides comparative decision support based on regional satellite observations and configurable agronomic rules. Verify recommendations with local extension guidance, field observations, seed availability, and soil testing before planting.

The interface never claims guaranteed yield increases, exact future yields, exact fertilizer prescriptions, professional certification, or field-level precision from coarse observations.
