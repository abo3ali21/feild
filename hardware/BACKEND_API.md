# Field Shift Backend API — Hardware Integration Reference

Every endpoint below was extracted from `backend/app/main.py`, `backend/app/models/schemas.py`, and `backend/app/services/sensor_store.py` (commit `75349f2`). Values are code-verified; nothing here is assumed. Interactive docs: `http://<host>:8000/docs`.

Base URL: `http://<host>:8000` locally, or the deployed origin (Vercel Services routes `/api/*` to the backend). All paths start with `/api/v1`. Methods: GET and POST only (CORS middleware allows exactly these).

## Endpoint index

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 1 | GET | `/api/v1/health` | none | Liveness probe |
| 2 | GET | `/api/v1/crops` | none | Crop catalog (agronomic parameters) |
| 3 | GET | `/api/v1/demo-profiles` | none | Named demo farms |
| 4 | POST | `/api/v1/sensors/readings` | `X-Device-Id` + `X-Device-Key` | **ESP32 upload endpoint** |
| 5 | GET | `/api/v1/sensors/{farm_id}/latest` | `X-Internal-Token` | Latest reading per device |
| 6 | GET | `/api/v1/sensors/{farm_id}/history` | `X-Internal-Token` | Reading history window |
| 7 | GET | `/api/v1/sensors/{farm_id}/status` | `X-Internal-Token` | Device freshness/registration |
| 8 | POST | `/api/v1/farms/evaluate` | none | Run rotation recommendation |
| 9 | POST | `/api/v1/farms/simulate` | none | Scenario re-run of a stored evaluation |

---

## 1. GET /api/v1/health

Response `200`:
```json
{"status": "ok", "service": "field-shift-api", "engine": "deterministic"}
```
Use for firmware connectivity checks and dashboard online/offline pill.

## 2. GET /api/v1/crops

Response `200`: `{"crops": [Crop, ...]}`. Each `Crop` (schemas.py `Crop`):
`crop_id, common_name, family, base_temp_c, max_temp_c, minimum_gdd, minimum_water_mm, maximum_water_mm, drought_tolerance (0–1), minimum_ph, maximum_ph, root_depth ("SHALLOW"|"MEDIUM"|"DEEP"), is_legume, nitrogen_credit_kg_ha, nitrogen_removal_index (0–1), residue_score (0–1), irrigation_required, source_notes`.

## 3. GET /api/v1/demo-profiles

Response `200`: `{"profiles": [...]}` — demo farm entries without their internal `context` block. Fields include `id, name, latitude, longitude, current_crop_id, soil_texture, is_irrigated, farmer_priority`.

---

## 4. POST /api/v1/sensors/readings  ← the firmware endpoint

### Headers (required)
| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `X-Device-Id` | registered device id, e.g. `esp32-device-001` |
| `X-Device-Key` | the device's shared secret (must equal `api_key` in the backend registry) |

### Body (`SensorReadingIn`)
| Field | Type | Bounds | Notes |
|-------|------|--------|-------|
| `device_id` | string | 1–128 chars | **must equal `X-Device-Id`** or 403 |
| `temperature_c` | float \| null | −40 … 85 | BME680 |
| `humidity_percent` | float \| null | 0 … 100 | BME680 |
| `pressure_hpa` | float \| null | 300 … 1100 | BME680 |
| `gas_resistance_ohms` | float \| null | >0 … 10,000,000 | BME680 |
| `soil_moisture_raw` | int \| null | 0 … 4095 | ESP32 12-bit ADC, GPIO32 |
| `device_timestamp` | ISO-8601 datetime | see window below | NTP-synced UTC, e.g. `2026-11-14T12:00:00Z` |

At least one measurement channel must be non-null (model validator), otherwise `422`. Channels may be omitted when a sensor is disconnected.

### Timestamp rules (main.py:99–104)
- More than **15 minutes in the future** → `422` "implausibly far in the future".
- Older than **400 days** → `422` "older than the accepted backfill window".
- Firmware must wait for NTP sync before uploading (it does: `deviceTimestamp()` returns false until synced).

### Rate limit
`SENSOR_RATE_LIMIT_PER_MINUTE` (default **10**) per device, sliding 60 s window, checked **after** authentication. Exceeded → `429`.

### Success `200`
```json
{"status": "stored", "farm_id": "farm-demo-sahel", "duplicate": false}
```
`status` is `"stored"` or `"duplicate"`. Duplicates are detected by `UNIQUE(device_id, device_timestamp)` — re-sending the same snapshot is safe (idempotent), which is what the firmware's retry/backoff relies on.

### Errors
| Code | Condition |
|------|-----------|
| 401 | missing `X-Device-Id`/`X-Device-Key`; unknown device; wrong key |
| 403 | body `device_id` ≠ header `X-Device-Id` |
| 422 | payload validation (bounds, no channels) or timestamp window |
| 429 | per-device rate limit |

### Server-side processing
- Device→farm association comes **only** from the backend registry (`sensor_setup.json`), never from the payload.
- `soil_moisture_percent` is computed server-side: `clamp((soil_dry_adc − raw) / (soil_dry_adc − soil_wet_adc) × 100, 0, 100)` using the device's calibration (defaults wet 1500 / dry 2500 — the sketch's `WET_THRESHOLD`/`DRY_THRESHOLD`). It is a device-relative index, not volumetric water content.
- Stored row columns: `id, device_id, farm_id, temperature_c, humidity_percent, pressure_hpa, gas_resistance_ohms, soil_moisture_raw, soil_moisture_percent, device_timestamp, received_at`.

### curl example
```bash
curl -X POST http://localhost:8000/api/v1/sensors/readings \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: esp32-device-001" \
  -H "X-Device-Key: <device secret>" \
  -d '{"device_id":"esp32-device-001","temperature_c":31.2,"humidity_percent":44.0,"pressure_hpa":1008.5,"gas_resistance_ohms":52000,"soil_moisture_raw":2100,"device_timestamp":"2026-11-14T12:00:00Z"}'
```

### Device registration (no HTTP endpoint — file-based)
`backend/app/data/sensor_setup.json` (override path with `SENSOR_SETUP_PATH`):
```json
{
  "farms":   [{"farm_id": "farm-demo-sahel", "latitude": 14.120, "longitude": -16.035}],
  "devices": [{"device_id": "esp32-device-001", "farm_id": "farm-demo-sahel",
               "api_key": "<secret>", "soil_wet_adc": 1500, "soil_dry_adc": 2500,
               "planted_depth_cm": 10, "calibration_source": "..."}]
}
```
Sync validates: duplicate farm coordinates at 3-decimal precision and devices referencing unregistered farms raise errors (transactional SAVEPOINT). Keys are stored as SHA-256 hashes. **Never commit real keys** — use a git-ignored copy via `SENSOR_SETUP_PATH`.

### How readings influence recommendations
`apply_sensor_context` uses fresh soil moisture only when the evaluation's coordinates match a registered farm **rounded to 3 decimals** (`coord_key = f"{lat:.3f}:{lon:.3f}"`). Freshness window: `SENSOR_MAX_AGE_HOURS` (default 24). Influence weight: `SENSOR_WATER_INFLUENCE` (default 0.10, clamped 0–0.25). Provenance status becomes `SENSOR`.

---

## 5. GET /api/v1/sensors/{farm_id}/latest

Header `X-Internal-Token` required. **If `SENSOR_INTERNAL_TOKEN` is unset on the server, this endpoint always returns 403** (main.py:74–77).
`200`: `{"farm_id": ..., "fresh_window_hours": 24.0, "readings": [row, ...]}` — newest reading per device (partitioned by `device_id`, ordered by `device_timestamp DESC`). `404` if farm not registered.

## 6. GET /api/v1/sensors/{farm_id}/history

Header `X-Internal-Token`. Query: `hours` (default 168, >0, ≤8760), `limit` (default 1000, 1–1000).
`200`: `{"farm_id": ..., "hours": ..., "readings": [row, ...]}` ordered by `received_at DESC`, filtered on `received_at` (server receipt time, not device time). `404` unknown farm.

## 7. GET /api/v1/sensors/{farm_id}/status

Header `X-Internal-Token`.
`200`:
```json
{"farm_id": "...", "fresh_window_hours": 24.0,
 "devices": [{"device_id": "...", "active": true, "last_received_at": "ISO|null", "fresh": true}]}
```
`fresh` = last receipt within the freshness window. `404` unknown farm.

---

## 8. POST /api/v1/farms/evaluate

Body (`FarmRequest`):
| Field | Type | Constraints |
|-------|------|-------------|
| `latitude` | float | −90 … 90 |
| `longitude` | float | −180 … 180 |
| `current_crop_id` | string | must exist in crop catalog |
| `soil_texture` | string \| null | e.g. `SANDY_LOAM`, `LOAM`, `CLAY_LOAM` |
| `is_irrigated` | bool | default false |
| `farmer_priority` | enum | `balanced`, `drought_resilience`, `soil_recovery`, `crop_diversity` |
| `demo_profile_id` | string \| null | forces the demo profile instead of live NASA/SoilGrids |

`200` `EvaluationResponse`: `status, evaluation_id, environmental_context{annual_gdd, seasonal_rainfall_mm, historical_rainfall_mm, precipitation_anomaly_pct, rainfall_status, heat_stress_days, soil_moisture_state, soil_moisture_index (0–1|null), soil_texture, soil_ph, soil_organic_matter_pct, data_quality{climate,soil,soil_moisture}}, data_provenance[{variable,source,status}], recommended_rotations[{rank, sequence[{year,crop_id,name}], scores{overall,climate,water,soil,diversity}, explanations[], warnings[], factors{}}], rejected_examples[{passed,rule,reason}]`.
`422`: invalid crop/inputs, or no sequence passes hard filters.
Note: `evaluation_id` is kept **in server memory** for `/simulate`.

## 9. POST /api/v1/farms/simulate

Body (`SimulationRequest`): `evaluation_id` (from a prior evaluate), `rainfall_change_pct` (−40 … 20), `temperature_change_c` (0 … 4), `irrigation_available` (bool).
`200`: same `EvaluationResponse` shape with a new `evaluation_id`. `404` if the evaluation is not in memory (serverless restarts lose it). `422` if no sequence passes the scenario filters.

---

## Firmware mapping (field_shift_esp32.ino → API)

| Firmware | API |
|----------|-----|
| `API_BASE_URL` + `/api/v1/sensors/readings` | endpoint 4 |
| `DEVICE_ID` / `DEVICE_KEY` (Secrets.h) | `X-Device-Id` / `X-Device-Key` + body `device_id` |
| `latest.temperatureC` (2 dp) | `temperature_c` |
| `latest.humidity` (1 dp) | `humidity_percent` |
| `latest.pressureHpa` (1 dp) | `pressure_hpa` |
| `(long)latest.gasOhms` | `gas_resistance_ohms` |
| `latest.soilRaw` | `soil_moisture_raw` |
| NTP `strftime %Y-%m-%dT%H:%M:%SZ` | `device_timestamp` |
| `UPLOAD_INTERVAL_MS` 900000 | upload cadence (15 min; well under the 10/min limit) |
| retry backoff 5 s → 5 min | safe re-send: duplicates return `"duplicate"` |

## Environment variables affecting these endpoints

`CORS_ORIGINS` (comma list), `DEMO_MODE` (default `false` → live NASA POWER + ISRIC SoilGrids), `SENSOR_DB_PATH`, `SENSOR_SETUP_PATH`, `SENSOR_INTERNAL_TOKEN`, `SENSOR_MAX_AGE_HOURS` (24), `SENSOR_WATER_INFLUENCE` (0.10), `SENSOR_RATE_LIMIT_PER_MINUTE` (10).

## Deployment caveats (verified architecture, not tested in production)

Evaluations live in an in-memory dict and readings in local SQLite. On serverless hosts (Vercel Services) instances do not share memory or disk: `/simulate` may 404 and sensor history may reset between invocations. Durable shared storage is required before production sensor use.
