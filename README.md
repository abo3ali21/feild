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
  D2[(ESP32 field sensors)] --> F
  F --> C[Crop knowledge base]
  F --> E[Hard filters + MCDA engine]
  F --> D[(TTL cache / optional PostGIS)]
  E --> F --> N
~~~

The frontend is a responsive Next.js/TypeScript planning workflow with five demo farms, clear loading stages, ranked and comparison views, a methodology dialog, and scenario sliders. The backend is a Python/FastAPI service with pure calculations, configurable JSON crop data, resilient HTTP adapters, deterministic ranking, and in-memory evaluation state for simulations.

## Data sources and status

- **NASA POWER**: daily T2M maximum/minimum, corrected precipitation, humidity, and solar radiation. Live requests use four recent complete years and a 180-day seasonal window.
- **ISRIC SoilGrids**: 0–30 cm clay, sand, silt, pH, and soil organic carbon estimates.
- **SMAP**: adapter boundary only. Root-zone moisture is marked UNAVAILABLE; the app never invents a live SMAP measurement. Registered ESP32 field devices can supply labelled SENSOR moisture instead (see sensor integration).
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
| SENSOR_DB_PATH | SQLite file for persistent device registry and readings | ./sensor_readings.db (backend working dir) |
| SENSOR_SETUP_PATH | Backend-managed device/farm association JSON | backend/app/data/sensor_setup.json |
| SENSOR_INTERNAL_TOKEN | X-Internal-Token value for the sensor query endpoints | blank; sensor query endpoints reject all requests when unset |
| SENSOR_MAX_AGE_HOURS | Data-freshness window for using readings in scoring | 24 |
| SENSOR_WATER_INFLUENCE | Maximum bounded ± effect of fresh calibrated soil moisture on the water score; 0 disables | 0.10 |
| SENSOR_RATE_LIMIT_PER_MINUTE | Per-device ingestion rate limit | 10 |
| DEMO_MODE | Skip external requests and use explicit demo estimates | true |
| CORS_ORIGINS | Comma-separated allowed frontend origins | http://localhost:3000 |

No private credential is required for the demo. Never commit real values.

## API

- GET /api/v1/health — service health and deterministic-engine status.
- GET /api/v1/crops — all 15 crop reference records.
- GET /api/v1/demo-profiles — selectable demo farm metadata.
- POST /api/v1/farms/evaluate — validate a farm, build environmental context, filter candidates, and return the top three materially different rotations.
- POST /api/v1/farms/simulate — re-run an evaluation with rainfall (-40% to +20%), warming (0°C to +4°C), and irrigation changes.
- POST /api/v1/sensors/readings — authenticated ESP32 submission (`X-Device-Id`, `X-Device-Key`); the backend resolves the registered farm.
- GET /api/v1/sensors/{farm_id}/latest — most recent reading per registered device (internal; requires `X-Internal-Token`).
- GET /api/v1/sensors/{farm_id}/history — historical readings within `?hours=` (internal; requires `X-Internal-Token`).
- GET /api/v1/sensors/{farm_id}/status — device freshness against the configured window (internal; requires `X-Internal-Token`).

## ESP32 field-sensor integration

The application workflow is unchanged: the same four-step wizard and results view are served by the same endpoints. When the analysis request coordinates match a registered sensor farm, the backend automatically overlays eligible readings inside the existing pipeline before scoring. Users never enter device identifiers, and no sensor page or control exists in the UI.

### Hardware

Verified from the source sketches in `Nasa-Luxor-HAMADA-Yl3AB-2025-main.zip`:

| Component | Interface | Data |
| --- | --- | --- |
| BME680 | I²C address 0x77 (`Wire`, standard ESP32 SDA/SCL) | Air temperature °C, relative humidity %, pressure Pa (sent as hPa), gas resistance Ω |
| Soil moisture analog probe | GPIO32 (`analogRead`, 12-bit ADC 0–4095) | Raw ADC value |
| SSD1306 OLED | Hardware I²C (U8g2 page-buffer mode) | Local display, unchanged from the original firmware |

Firmware lives in `firmware/field_shift_esp32/`. Copy `Secrets.example.h` to `Secrets.h` (git-ignored) and set `WIFI_SSID`, `WIFI_PASSWORD`, `API_BASE_URL`, `DEVICE_ID`, and `DEVICE_KEY`. Configurable timing constants: `MEASUREMENT_INTERVAL_MS` (default 2000, the original OLED cadence), `UPLOAD_INTERVAL_MS` (default 900000), and retry backoff `RETRY_BASE_MS`/`RETRY_MAX_MS` (5 s exponential to a 5-minute ceiling). The measurement loop and OLED rendering never wait on the network; failed uploads re-send the latest snapshot with backoff, Wi-Fi reconnects non-blockingly, and `device_timestamp` comes from NTP (uploads pause until the clock is synced rather than fabricating timestamps).

### Device registration and farm association

The backend owns the `device_id → farm_id` mapping in `backend/app/data/sensor_setup.json` (override with `SENSOR_SETUP_PATH`). Add a farm entry with its coordinates and a device entry with its unique id and api key; edit the file to move a device to another farm — changes apply on the next ingestion call. Device keys are stored only as SHA-256 hashes in the SQLite registry (`SENSOR_DB_PATH`); unknown, inactive, or wrong-key devices are rejected with 401, and a payload can never claim another device's id. The committed file contains placeholders only — keep real secrets out of git.

### Reading payload

~~~json
{
  "device_id": "esp32-device-001",
  "temperature_c": 29.5,
  "humidity_percent": 55.0,
  "pressure_hpa": 1008.2,
  "gas_resistance_ohms": 12500,
  "soil_moisture_raw": 1850,
  "device_timestamp": "2026-11-12T12:30:00Z"
}
~~~

Missing channels are allowed (sensor disconnected), impossible values are rejected (422), exact `(device_id, device_timestamp)` replays are acknowledged as duplicates without a second row, and delayed or out-of-order submissions are ranked by device timestamp for retrieval while server-side `received_at` drives freshness.

### Sensor-to-model rules and calibration assumptions

- **Soil moisture** is the only measurement that affects scores. Raw ADC values are converted with the firmware's own two-point thresholds (WET 1500 / DRY 2500, configurable per device in the registry) into a **device-relative moisture index**, not a volumetric water-content percentage. Median aggregation over the freshness window reduces noise, and three-plus identical raw values are flagged as a stuck sensor and excluded. When eligible, the index applies a bounded ±`SENSOR_WATER_INFLUENCE` (default ±10%) correction to the existing water dimension only; MCDA goal weights, hard filters, climate and soil scoring, and irrigation answers are untouched. Until field-specific volumetric calibration exists, no stronger claim is made.
- **Temperature, humidity, pressure, gas resistance** are stored and validated but never scored: an instantaneous reading cannot replace the 4-year NASA POWER seasonal profile, and the model has no validated humidity/pressure/gas pathway. Gas resistance needs factory calibration and VOC interpretation; pressure is weather-scale noise at this use. They remain available through the history endpoints for future trend analysis.
- When no device is registered, offline, stale (older than `SENSOR_MAX_AGE_HOURS`, default 24 h — an operational freshness bound, not an agronomic standard), or uncalibrated, the engine uses the original data sources exactly as before. Missing data is never treated as zero and an analysis is never rejected because a device is offline.

### Sensor testing

~~~bash
cd backend
pytest tests/test_sensors.py tests/test_sensor_engine.py -q
~~~

These are simulated-payload tests over the HTTP API; they do not prove behavior of a physical ESP32. The firmware has not been compiled or bench-tested in this environment (no Arduino toolchain or device present).

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

The suite covers GDD, rainfall anomaly, weight normalization, pH and family filtering, water and score bounds, stable ranking, fallbacks, external timeouts, all five demos, all required API workflows, and ESP32 sensor ingestion, calibration, freshness, isolation, and scoring behavior.

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
