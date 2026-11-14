# Field Shift --- Full Project Improvement Roadmap

**Repository:** https://github.com/abo3ali21/feild\
**Baseline branch:** `main`\
**Working branch:** `improvement/full-project-audit`\
**Purpose:** Turn the project audit findings into an ordered, testable
implementation plan.

> This roadmap is a plan, not a statement that the listed fixes have
> already been implemented. Verify the current repository before
> changing code. Some audit findings require runtime reproduction and
> domain validation.

------------------------------------------------------------------------

## Project goals

1.  Improve the scientific validity of soil, climate, water, and crop
    calculations.
2.  Make data provenance, freshness, quality, and fallback behavior
    explicit.
3.  Make crop-rotation recommendations diverse, explainable, and
    testable.
4.  Improve the frontend without unnecessarily rebuilding working parts.
5.  Make sensor ingestion, storage, security, and deployment reliable.
6.  Validate the complete product with reproducible tests and realistic
    scenarios.

## Working rules

-   Do not work directly on `main`.
-   Make one focused change per commit.
-   Add or update a test for every bug fix.
-   Preserve existing behavior unless the change intentionally alters
    it.
-   Never present estimated or demo data as live observations.
-   Do not invent agronomic parameters. Record a source, units, region,
    and assumptions for each parameter.
-   Run the relevant tests before merging.
-   Keep secrets, device keys, and production credentials out of Git.

------------------------------------------------------------------------

# Phase 0 --- Preparation and Baseline

**Objective:** Protect the existing project and establish a reproducible
starting point.

### Tasks

-   [ ] Inspect the current branch and working tree.
-   [ ] Pull the latest `main`.
-   [ ] Create `improvement/full-project-audit`.
-   [ ] Record the current commit hash.
-   [ ] Run the existing backend test suite.
-   [ ] Run frontend checks and production build.
-   [ ] Record existing failures before making changes.
-   [ ] Confirm environment variables and local setup instructions.
-   [ ] Check tracked files for secrets or real device credentials.

### Suggested commands

``` bash
git checkout main
git pull origin main
git status
git checkout -b improvement/full-project-audit
git rev-parse HEAD
```

Run backend tests using the repository's documented environment, for
example:

``` bash
cd backend
pytest -q
```

Run frontend checks using the package manager and scripts defined by the
project:

``` bash
cd frontend
npm ci
npm run build
```

If the project uses a different package manager or script names, follow
its lockfile and `package.json`.

### Deliverables

-   Baseline commit recorded.
-   Test/build results saved.
-   Known pre-existing failures documented.
-   Working branch created.

### Exit criteria

The team can reproduce the baseline and distinguish pre-existing
failures from regressions.

------------------------------------------------------------------------

# Phase 1 --- Scientific and Calculation Fixes

**Priority:** Critical\
**Objective:** Ensure that the calculations feeding recommendations use
correct units, crop-specific parameters, and transparent assumptions.

## 1.1 Soil Organic Matter conversion

**Likely file:** `backend/app/services/environment.py`

### Problem to verify

The audit identified a possible unit-conversion error in the conversion
from SoilGrids soil organic carbon (SOC) to soil organic matter (SOM).
Confirm the exact unit and scale returned by the provider before
changing the formula.

For SOC expressed in `dg/kg`:

``` python
soc_g_kg = soc_raw / 10
soc_percent = soc_g_kg / 10
som_percent = soc_percent * 1.724
```

Do not apply this formula blindly to values already converted by an
upstream adapter.

### Tasks

-   [ ] Confirm the raw SoilGrids unit and scale from provider
    documentation.
-   [ ] Centralize unit conversion in a named, tested function.
-   [ ] Represent missing SOC as missing, not as a fabricated
    measurement.
-   [ ] If an estimate is necessary, label it as estimated and preserve
    its source.
-   [ ] Check plausible ranges and reject invalid values.

### Tests

-   [ ] A known raw input produces the expected SOM percentage.
-   [ ] Missing SOC remains missing.
-   [ ] Invalid and out-of-range values are handled explicitly.
-   [ ] Conversion is not accidentally applied twice.

## 1.2 Crop-specific Growing Degree Days (GDD)

**Likely files:**

-   `backend/app/services/environment.py`
-   `backend/app/core/calculations.py`
-   `backend/app/core/engine.py`
-   `backend/app/models/schemas.py`
-   `backend/app/data/crops.json`

### Problem to address

A single base temperature or fixed recent-day window is not appropriate
for every crop and growing season.

### Tasks

-   [ ] Calculate GDD using each crop's documented base temperature.
-   [ ] Define and document the temperature method, including lower and
    upper thresholds where appropriate.
-   [ ] Handle missing daily minimum/maximum temperatures.
-   [ ] Add crop- and region-specific planting and harvest windows.
-   [ ] Calculate climate metrics over the crop's relevant season, not
    an arbitrary last-180-day slice.
-   [ ] Record the source and regional applicability of each crop
    parameter.

A basic uncapped daily calculation is:

``` python
daily_gdd = max(0, ((tmax + tmin) / 2) - base_temp)
```

This is only a starting point. Apply upper/lower temperature rules only
when supported by the chosen agronomic method and crop data.

### Tests

-   [ ] Different crop base temperatures produce different GDD values
    for the same weather.
-   [ ] Changing the date window changes the result as expected.
-   [ ] Missing days are handled and reported.
-   [ ] Boundary temperatures are tested.
-   [ ] Known sample data matches an independently calculated expected
    result.

## 1.3 Soil texture source and manual override

**Likely files:**

-   `frontend/app/page.tsx`
-   `backend/app/services/environment.py`
-   `backend/app/models/schemas.py`

### Problem to address

A frontend default may be sent as if it were a deliberate user override,
potentially replacing live soil texture.

### Tasks

-   [ ] Separate `soil_texture_override` from provider-derived
    `soil_texture`.
-   [ ] Send an override only when the user explicitly chooses one.
-   [ ] Define precedence: explicit user override, valid provider
    result, then clearly labeled estimate or unavailable state.
-   [ ] Preserve the source and status of the selected value.
-   [ ] Ensure the UI does not label manual or estimated data as live.

### Tests

-   [ ] Live texture is used when no override is supplied.
-   [ ] Explicit override takes effect.
-   [ ] Missing provider data produces a transparent fallback state.
-   [ ] Source labels match the value actually used by the engine.

## 1.4 Water availability and irrigation model

**Likely file:** `backend/app/core/engine.py`

### Problem to address

A fixed irrigation bonus (for example, multiplying rainfall by 1.25)
does not represent measured irrigation supply.

### Tasks

-   [ ] Remove arbitrary irrigation multipliers from the decision model.
-   [ ] Add irrigation amount or availability when users can provide it.
-   [ ] Record irrigation efficiency and irrigation system assumptions
    where available.
-   [ ] Separate effective rainfall from irrigation supply.
-   [ ] Add crop water requirement calculations using suitable ET0 and
    crop-coefficient data when available.
-   [ ] Account for soil water storage only when the necessary soil
    inputs exist.
-   [ ] Mark missing water inputs and avoid overstating confidence.

Conceptual balance:

``` text
Available water = effective rainfall + effective irrigation
```

Compare this with crop water demand over the same time period. Define
the exact model and units before implementation.

### Tests

-   [ ] Irrigation does not automatically guarantee a high water score.
-   [ ] Increasing valid irrigation supply changes the result
    predictably.
-   [ ] Units and time periods are consistent.
-   [ ] Missing irrigation data is not silently treated as measured
    supply.

## 1.5 Crop-specific heat stress

**Likely file:** `backend/app/core/engine.py`

### Tasks

-   [ ] Use crop-specific temperature thresholds supported by
    references.
-   [ ] Count threshold-exceedance days during the relevant crop season.
-   [ ] Consider growth stage if reliable crop-calendar data is
    available.
-   [ ] Distinguish daily maximum temperature from mean temperature.
-   [ ] Explain which observations caused a heat penalty.

### Tests

-   [ ] Different crop thresholds produce different penalties.
-   [ ] Heat outside the crop's season does not affect that season's
    score.
-   [ ] Missing temperature observations reduce confidence rather than
    creating false certainty.

### Phase 1 exit criteria

-   Unit conversions are verified.
-   Crop-specific climate calculations are tested.
-   Manual overrides and live data are distinguishable.
-   Water and heat scores use documented assumptions.
-   All relevant backend tests pass.

------------------------------------------------------------------------

# Phase 2 --- NASA and Environmental Data Reliability

**Priority:** Critical\
**Objective:** Make environmental data reliable, traceable, and
resilient to provider outages.

**Likely main file:** `backend/app/services/environment.py`

## 2.1 Improve NASA POWER integration

### Tasks

-   [ ] Document the NASA POWER parameters currently requested.
-   [ ] Confirm units, temporal resolution, spatial resolution, and time
    standard.
-   [ ] Retrieve data for crop-specific seasonal date ranges.
-   [ ] Validate response shape, status, missing values, and dates.
-   [ ] Preserve coordinates, requested period, retrieval time, and
    provider metadata.
-   [ ] Handle timeouts, rate limits, and provider errors.
-   [ ] Compare recent conditions with an appropriate historical
    baseline where useful.

Potential variables to assess include maximum/minimum temperature,
precipitation, relative humidity, and solar radiation. Confirm exact API
parameter names and units against NASA POWER documentation before
implementation.

Documentation: https://power.larc.nasa.gov/docs/services/api/

## 2.2 Make soil data access resilient

### Tasks

-   [ ] Confirm current availability and supported access methods for
    SoilGrids.
-   [ ] Avoid assuming its REST API is continuously available.
-   [ ] Define a provider interface so the engine does not depend on one
    transport method.
-   [ ] Evaluate supported SoilGrids access options such as WCS or
    WebDAV, subject to current service availability.
-   [ ] Consider a properly licensed and versioned local cache for
    repeat queries.
-   [ ] Define an explicit fallback provider or unavailable state.
-   [ ] Keep NASA data and non-NASA soil data clearly distinguished.

Suggested structure:

``` text
SoilDataService
    |
    +-- SoilProvider interface
    |      +-- SoilGrids provider
    |      +-- Other verified provider
    |      +-- Cached dataset provider
    |
    +-- Explicit fallback / unavailable result
```

References:

-   https://soilgrids.org/
-   https://docs.isric.org/

## 2.3 Evaluate additional Earth-observation sources

Add sources only when they materially improve the product and can be
validated.

Suggested order:

1.  **NASA SMAP:** assess soil-moisture products, spatial/temporal
    resolution, and suitability for the farm scale.
2.  **NASA GPM:** assess precipitation products and whether they add
    value beyond the current climate source.
3.  **Landsat:** assess vegetation-index use cases such as NDVI,
    including cloud masking and revisit limitations.
4.  **NASA ECOSTRESS:** optional exploration for evapotranspiration and
    thermal observations.

For every source:

-   [ ] Identify the exact product.
-   [ ] Record units and spatial/temporal resolution.
-   [ ] Confirm access method and usage terms.
-   [ ] Define quality flags and missing-data handling.
-   [ ] Validate against independent or local observations where
    possible.
-   [ ] Do not describe a non-NASA source as NASA data.

## 2.4 Implement shared caching

### Problem to address

A cache created inside each request does not provide useful reuse across
requests.

### Tasks

-   [ ] Move cache lifecycle to application/service scope.
-   [ ] Use a cache key containing provider, coordinates,
    variable/product, date range, and processing version.
-   [ ] Set a suitable TTL per data type.
-   [ ] Define invalidation behavior.
-   [ ] Use Redis or another shared cache if multiple workers/instances
    require shared state.
-   [ ] Avoid caching failed or partial responses as valid complete
    data.

## 2.5 Add a common data-provenance and quality model

Each environmental value should carry, where available:

-   Provider and product.
-   Variable name.
-   Value and unit.
-   Coordinates or spatial footprint.
-   Observation period.
-   Retrieval timestamp.
-   Resolution.
-   Quality flags.
-   Missing-data information.
-   Uncertainty or confidence information.
-   Status: live, cached, estimated, demo, or unavailable.

### Tests

-   [ ] Provider response parsing tests use saved fixtures.
-   [ ] Unit conversions are tested.
-   [ ] Timeouts and malformed responses are tested.
-   [ ] Cache hits and expiration are tested.
-   [ ] Fallback status is accurate.
-   [ ] Provenance survives through the API to the frontend.

### Phase 2 exit criteria

Every input used in a recommendation can be traced to a provider or
clearly labeled estimate, with units and date coverage.

------------------------------------------------------------------------

# Phase 3 --- Crop Rotation Engine

**Priority:** High\
**Objective:** Produce genuinely distinct, agronomically defensible, and
explainable rotation plans.

**Likely files:**

-   `backend/app/core/engine.py`
-   `backend/app/core/calculations.py`
-   `backend/app/data/crops.json`
-   `backend/app/data/families.json`
-   `backend/app/models/schemas.py`

## 3.1 Improve rotation diversity and ranking

### Problem to address

Different permutations of the same crop set may appear as separate top
recommendations even when the scoring method does not distinguish their
order.

### Tasks

-   [ ] Identify whether the score is order-dependent.
-   [ ] Define when two rotations are materially equivalent.
-   [ ] Deduplicate equivalent crop sets or rotation strategies.
-   [ ] Select alternatives that differ meaningfully in crop sequence,
    families, water demand, roots, or other validated criteria.
-   [ ] Keep agronomic rotation constraints explicit and configurable.
-   [ ] Do not impose a diversity rule that rules out valid rotations
    without agronomic justification.

### Tests

-   [ ] Equivalent permutations are not presented as distinct strategies
    when their scores and implications are equivalent.
-   [ ] Different sequences remain distinct when order has a modeled
    effect.
-   [ ] All returned plans satisfy rotation constraints.
-   [ ] The top results are meaningfully different.

## 3.2 Improve soil-health modeling

Assess whether the available data supports including:

-   Soil organic carbon / organic matter.
-   Nitrogen balance.
-   Crop residue contribution.
-   Root depth or rooting profile.
-   Crop-family sequence.
-   Soil pH compatibility.
-   Multi-year effects.

### Tasks

-   [ ] Define the scientific meaning and units of each factor.
-   [ ] Avoid claiming measured nitrogen credits when only generic
    estimates exist.
-   [ ] Model year-to-year effects only when the necessary parameters
    are available.
-   [ ] Mark uncertain or missing parameters.
-   [ ] Validate the model with agronomic references or expert review.

## 3.3 Make recommendations explainable

Each recommendation should expose:

-   Overall score.
-   Factor scores and weights.
-   Inputs used by each factor.
-   Main positive contributors.
-   Main risks or penalties.
-   Missing inputs and uncertainty.
-   Rejected alternatives and their rejection reasons.

Explanations must be generated from actual scoring evidence, not generic
hard-coded claims.

## 3.4 Improve crop metadata

For each crop, review and document:

-   Common and scientific names.
-   Crop family.
-   Base and relevant upper temperature thresholds.
-   GDD requirements and method.
-   Planting/harvest calendar by region.
-   Water demand and crop coefficient where available.
-   Rooting information.
-   Soil pH range.
-   Nitrogen fixation/credit assumptions.
-   Residue properties.
-   Reference URL, publication, units, region, and confidence.

Do not fill unknown fields with invented values. Use explicit unknown or
unavailable values.

## 3.5 Validate MCDA weights

### Tasks

-   [ ] Confirm weights sum to 1 (or 100%).
-   [ ] Validate all weights are non-negative.
-   [ ] Document each priority profile.
-   [ ] Test how changing a priority changes the ranking.
-   [ ] Show the selected weights to the user.
-   [ ] Explain trade-offs between alternatives.

### Phase 3 exit criteria

The engine returns valid and meaningfully different plans, with
reproducible scores and evidence-based explanations.

------------------------------------------------------------------------

# Phase 4 --- Frontend and Visualization

**Priority:** High\
**Objective:** Make the data, recommendations, and their limitations
understandable to farmers and reviewers.

**Likely files:**

-   `frontend/app/page.tsx`
-   `frontend/app/i18n.ts`
-   `frontend/app/globals.css`
-   New components under `frontend/components/`
-   Shared API/types modules under `frontend/lib/`

## 4.1 Refactor the main page

Extract focused components without changing behavior unnecessarily:

``` text
frontend/
  app/
    page.tsx
    layout.tsx
    i18n.ts
  components/
    FarmMap.tsx
    FarmSetup.tsx
    ClimateDashboard.tsx
    SoilDashboard.tsx
    RotationCards.tsx
    FactorBreakdown.tsx
    CropCalendar.tsx
    DataProvenance.tsx
  lib/
    api.ts
    mock-engine.ts
    types.ts
```

Adjust this structure to the actual framework and existing project
conventions.

## 4.2 Add or improve visualizations

-   [ ] Replace the decorative map with a real map only if geographic
    interaction is needed.
-   [ ] Display farm location and the source/coverage of spatial data.
-   [ ] Add climate time-series charts.
-   [ ] Add a crop calendar for each rotation.
-   [ ] Display factor scores and their evidence.
-   [ ] Display rejected crops and rejection reasons.
-   [ ] Display data source, date range, and status near the relevant
    result.
-   [ ] Preserve Arabic/English and RTL/LTR behavior.

Potential map libraries: Leaflet or MapLibre. Choose one based on the
required map provider, licensing, and project stack.

## 4.3 Make demo and fallback states unmistakable

-   [ ] Label demo data as demo.
-   [ ] Label estimated data as estimated.
-   [ ] Show provider outages and incomplete data.
-   [ ] Do not silently substitute unrelated regional demo values for a
    custom farm.
-   [ ] Ensure simulation results preserve the selected farm, crops, and
    priority profile.
-   [ ] Show when a simulation uses a simplified model.

## 4.4 Frontend tests

-   [ ] Component tests for important result views.
-   [ ] API error and loading-state tests.
-   [ ] Arabic/English rendering tests.
-   [ ] RTL layout checks.
-   [ ] Tests that live, cached, estimated, and demo labels match API
    provenance.
-   [ ] End-to-end test for farm input through recommendation display.

### Phase 4 exit criteria

A user can understand the recommendation, its evidence, its risks, and
whether the data is live or estimated.

------------------------------------------------------------------------

# Phase 5 --- Hardware, Backend, Storage, and Deployment

**Priority:** High\
**Objective:** Make sensor ingestion secure and reliable, preserve
application state, and make deployment reproducible.

## 5.1 ESP32 firmware

**Likely file:** `firmware/field_shift_esp32/field_shift_esp32.ino`

### Tasks

-   [ ] Replace insecure TLS configuration such as `setInsecure()` with
    certificate validation.
-   [ ] Handle BME680 initialization failure without unnecessarily
    disabling other working sensors.
-   [ ] Update OLED only when needed or at a controlled interval.
-   [ ] Calibrate each soil-moisture sensor using documented dry/wet
    measurements.
-   [ ] Include device measurement timestamp and device identity.
-   [ ] Report sensor health and missing readings.
-   [ ] Handle network loss and retry behavior safely.
-   [ ] Avoid transmitting secrets in source-controlled files.

### Tests

-   [ ] Compile firmware with the intended board and library versions.
-   [ ] Test startup when each sensor is disconnected.
-   [ ] Test network loss and recovery.
-   [ ] Verify timestamp and payload format.
-   [ ] Verify TLS certificate validation.

## 5.2 Sensor ingestion and freshness

**Likely files:**

-   `backend/app/services/sensor_context.py`
-   `backend/app/services/sensor_store.py`
-   `backend/app/main.py`

### Tasks

-   [ ] Store measurement time separately from server receipt time.
-   [ ] Reject, quarantine, or mark stale readings according to a
    documented policy.
-   [ ] Validate sensor ranges and impossible values.
-   [ ] Associate calibration metadata with each device.
-   [ ] Prevent a single noisy reading from disproportionately changing
    a recommendation.
-   [ ] Preserve raw readings for auditability.
-   [ ] Add device health and last-seen status.

### Tests

-   [ ] Delayed old readings are not treated as fresh.
-   [ ] Invalid readings are rejected or quarantined.
-   [ ] Missing sensor values do not crash evaluation.
-   [ ] Device authentication and rate limits are tested.

## 5.3 Persistent evaluation storage

### Problem to address

In-memory evaluation dictionaries are lost on restart and are not shared
across multiple application workers.

### Tasks

-   [ ] Design persistent tables for farms, evaluations, rotations, and
    sensor readings.
-   [ ] Move evaluation retrieval away from process-local dictionaries.
-   [ ] Add retention and cleanup policies.
-   [ ] Add migrations and backup procedures.
-   [ ] Consider PostgreSQL; add PostGIS if spatial queries justify it.
-   [ ] Use Redis only where shared caching or ephemeral coordination is
    needed.

## 5.4 API and application security

-   [ ] Apply appropriate rate limits to expensive evaluation endpoints.
-   [ ] Use constant-time comparison for secret tokens where applicable.
-   [ ] Validate request sizes and all external inputs.
-   [ ] Restrict CORS to known frontend origins.
-   [ ] Keep secrets in environment variables or a secret manager.
-   [ ] Rotate any credential that may have been committed.
-   [ ] Avoid logging secrets or sensitive device payloads.
-   [ ] Add structured error handling and useful operational logs.

## 5.5 Deployment consistency

Review and reconcile:

-   `vercel.json`
-   `frontend/vercel.json`
-   `frontend/next.config.ts`
-   API base URL configuration
-   CORS configuration
-   Backend hosting configuration
-   Environment variable documentation

### Tasks

-   [ ] Choose one documented frontend deployment configuration.
-   [ ] Set the correct backend API URL per environment.
-   [ ] Verify API path construction.
-   [ ] Test CORS from the deployed frontend.
-   [ ] Document local, staging, and production environments.
-   [ ] Add a health/readiness check.
-   [ ] Add GitHub Actions for backend tests, frontend checks, and
    builds.

### Phase 5 exit criteria

The system handles restarts, stale sensor readings, provider/network
failures, and deployment configuration without silently corrupting or
misrepresenting data.

------------------------------------------------------------------------

# Phase 6 --- Final Validation and Competition Submission

**Priority:** Final\
**Objective:** Demonstrate that the full application works and that its
claims are supported by evidence.

## 6.1 Automated validation

Run and record:

-   [ ] Backend unit tests.
-   [ ] Backend API tests.
-   [ ] Environmental provider fixture tests.
-   [ ] Calculation and unit-conversion tests.
-   [ ] Crop rotation constraint and ranking tests.
-   [ ] Sensor ingestion tests.
-   [ ] Frontend tests.
-   [ ] Type checking and linting.
-   [ ] Production frontend build.
-   [ ] Firmware compilation.
-   [ ] End-to-end workflow test.

Do not claim a test passed unless it was actually executed and its
result recorded.

## 6.2 Geographic scenarios

Test at least three distinct scenarios using real or clearly labeled,
reproducible data:

1.  **Egyptian agricultural area:** evaluate local climate, soil inputs,
    crop calendar, and water constraints.
2.  **Semi-arid scenario:** test water scarcity and heat stress.
3.  **Temperate scenario:** test different seasonal conditions and crop
    suitability.

For each scenario:

-   [ ] Record coordinates and date range.
-   [ ] Record all data sources and fallback states.
-   [ ] Record crop database version.
-   [ ] Record user priorities and overrides.
-   [ ] Save the generated recommendation and factor breakdown.
-   [ ] Compare outputs with suitable agronomic references or expert
    review.
-   [ ] Document limitations and unexpected results.

## 6.3 Competition demo

Prepare a complete user journey:

1.  Explain the agricultural problem.
2.  Enter a farm location and constraints.
3.  Retrieve and display environmental data.
4.  Show soil data and provenance.
5.  Generate crop rotation options.
6.  Explain scores and trade-offs.
7.  Run a scenario or climate simulation.
8.  Show sensor integration if hardware is available.
9.  Explain limitations and expected real-world value.

## 6.4 Submission materials

-   [ ] Updated README and architecture diagram.
-   [ ] Clear setup and deployment instructions.
-   [ ] Data-source and citation list.
-   [ ] Agronomic assumptions and limitations.
-   [ ] Screenshots or demo video.
-   [ ] Presentation slides.
-   [ ] Team roles and contribution summary.
-   [ ] Working demo URL, if deployed.
-   [ ] Final test results.

### Phase 6 exit criteria

The demo is reproducible, the claims match the implementation, the data
provenance is visible, and known limitations are honestly documented.

------------------------------------------------------------------------

# Recommended execution order

  ------------------------------------------------------------------------
                  Order Work item        Priority         Depends on
  --------------------- ---------------- ---------------- ----------------
                      1 Phase 0:         Critical         None
                        baseline and                      
                        branch                            

                      2 Verify and fix   Critical         Phase 0
                        SOC/SOM units                     

                      3 Crop-specific    Critical         Verified crop
                        GDD and crop                      metadata
                        calendars                         

                      4 Soil texture     Critical         Data schema
                        override and                      
                        provenance                        

                      5 Water balance    High             Seasonal data
                        and heat stress                   and crop
                                                          parameters

                      6 NASA POWER       Critical         Phase 0
                        validation and                    
                        data quality                      

                      7 Soil provider    Critical         Provider
                        resilience                        availability
                                                          review

                      8 Shared cache     High             Provider service
                                                          design

                      9 Rotation         High             Phase 1
                        diversity and                     calculation
                        scoring                           fixes

                     10 Explainability   High             Engine changes
                        and crop                          
                        metadata                          

                     11 Frontend         High             Stable API
                        refactor and                      contracts
                        visualizations                    

                     12 Sensor freshness High             Sensor schema
                        and firmware                      
                        security                          

                     13 Persistent       High             Backend
                        storage and                       architecture
                        deployment                        

                     14 Full validation  Final            Previous phases
                        and demo                          
  ------------------------------------------------------------------------

## Suggested commit convention

Use small, focused commits such as:

``` text
fix: correct soil organic matter conversion
fix: calculate crop-specific growing degree days
fix: respect live soil texture data
fix: model irrigation water availability
fix: deduplicate equivalent crop rotations
feat: add environmental data provenance
feat: add shared environmental cache
feat: expose recommendation factor breakdown
fix: validate sensor measurement timestamps
fix: secure ESP32 TLS connections
ci: add backend and frontend checks
docs: document agronomic assumptions and data sources
```

## Definition of done

A task is complete only when:

1.  The implementation is reviewed.
2.  A test covers the expected behavior.
3.  Relevant tests pass.
4.  Units, assumptions, and data sources are documented.
5.  The frontend/API behavior is consistent where applicable.
6.  No live/demo/estimated data status is misrepresented.
7.  The change is committed on the working branch.

## Important references

-   Field Shift repository: https://github.com/abo3ali21/feild
-   NASA POWER API: https://power.larc.nasa.gov/docs/services/api/
-   SoilGrids: https://soilgrids.org/
-   ISRIC documentation: https://docs.isric.org/
-   FAO Irrigation and Drainage Paper 56:
    https://www.fao.org/4/x0490e/x0490e00.htm
-   NASA SMAP: https://smap.jpl.nasa.gov/
-   NASA GPM: https://gpm.nasa.gov/
-   NASA Earthdata: https://www.earthdata.nasa.gov/

------------------------------------------------------------------------

**Final note:** This roadmap is based on the previously documented
static audit findings. Re-open and verify the current source files,
provider documentation, and runtime behavior before implementing each
item. The exact implementation may need adjustment as the repository
evolves.
