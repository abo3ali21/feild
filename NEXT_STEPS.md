# Field Shift --- Next Steps & Release Readiness Plan

**Repository:** https://github.com/abo3ali21/feild\
**Starting point:** Full Roadmap Implementation Review & Audit dated
2026-11-14\
**Target milestone:** Field Shift v1.0 --- deployed, independently
validated agricultural decision-support system

## 1. Current position

The latest audit report states that implementation Phases 0--6 are
complete and that 56 automated tests pass. It describes changes to
scientific calculations, environmental-data reliability, crop rotation,
frontend components, ESP32 firmware, persistent storage, and security.

This plan covers the work that should follow. It does **not**
independently verify the repository, deployed application, physical
sensors, or reported test run. Treat completion claims as provisional
until reproduced from the current branch and supported by evidence.

**Strategy:** Do not begin with a large feature expansion. First verify
the existing system using live data, physical devices, realistic farm
scenarios, and production deployment. Then calibrate the agricultural
model and prepare the competition demonstration.

### Priority levels

-   **P0 --- Release blocker:** required before calling the system v1.0
    or presenting it as operational.
-   **P1 --- Important:** materially improves reliability, scientific
    confidence, or farmer usefulness.
-   **P2 --- Later:** valuable, but should not delay a reliable first
    release.

------------------------------------------------------------------------

## 2. Phase A --- Reproduce the audit and establish a baseline

**Priority: P0**

### Tasks

-   [x] Confirm the active branch, working tree, and exact commit SHA.
-   [x] Inspect the actual diff against the baseline commit.
-   [x] Re-run the complete backend test suite from a clean environment.
-   [x] Run frontend linting, type-checking, tests, and production
    build.
-   [x] Compile ESP32 firmware using documented board and library
    versions.
-   [x] Confirm secrets, device tokens, certificates, and local
    databases are not committed.
-   [x] Review dependency versions and known security vulnerabilities.
-   [x] Save test logs, build logs, and a release-baseline report.

### Acceptance criteria

-   A clean checkout can install dependencies and reproduce the
    documented checks.
-   Test commands, results, environment, and commit SHA are recorded.
-   Frontend production build and firmware compilation succeed.
-   No real credentials or private keys are present in tracked files.
-   Failing, skipped, flaky, or environment-dependent tests are
    documented.

### Suggested GitHub issues

1.  `chore: reproduce and document the full audit baseline`
2.  `test: add a documented validation command or CI workflow`
3.  `security: scan dependencies and tracked files for exposed secrets`

------------------------------------------------------------------------

## 3. Phase B --- Verify live environmental data and provenance

**Priority: P0**

### Tasks

-   [ ] Exercise NASA POWER requests using known coordinates and date
    ranges.
-   [ ] Verify variables, response units, date coverage, missing values,
    and coordinate handling.
-   [ ] Exercise SoilGrids retrieval for multiple locations, including
    timeout and fallback cases.
-   [ ] Verify provider failures never silently become plausible-looking
    live measurements.
-   [ ] Confirm cache keys include all inputs affecting a result, such
    as coordinates, variables, and time window.
-   [ ] Confirm cache expiration and behavior after provider recovery.
-   [ ] Verify `LIVE`, `CACHED`, `ESTIMATED`, `FALLBACK`, and `SENSOR`
    labels in API responses and UI.
-   [ ] Record source/provider, variable, unit, retrieval time,
    observation period, and quality flags where available.
-   [ ] Test invalid coordinates, rate limits, timeouts, malformed
    responses, and empty datasets.

### Acceptance criteria

-   Every displayed environmental value has a traceable source, unit,
    and status.
-   Cached data is not labeled as newly fetched live data.
-   Estimated and fallback values are visibly identified.
-   Provider outages produce a controlled degraded state.
-   Tests cover success, timeout, malformed response, missing data,
    cache hit, and recovery.

### Suggested GitHub issues

4.  `test: add live-provider integration checks for NASA POWER`
5.  `test: verify SoilGrids provider and fallback behavior`
6.  `feat: expose environmental-data provenance in API and UI`
7.  `test: cover cache expiry, provider outage, and recovery`

------------------------------------------------------------------------

## 4. Phase C --- Verify the complete ESP32-to-dashboard pipeline

**Priority: P0**

### Tasks

-   [ ] Document ESP32 board, sensor models, wiring, firmware version,
    and libraries.
-   [ ] Compare sensor readings against a reference instrument or
    documented calibration procedure.
-   [ ] Verify units, valid ranges, timestamps, timezone handling, and
    device identity.
-   [ ] Run a continuous soak test for at least 24 hours; preferably
    repeat over several days.
-   [ ] Test Wi-Fi loss, backend outage, device reboot, and recovery.
-   [ ] Add or verify bounded offline telemetry buffering and safe retry
    behavior.
-   [ ] Test duplicate, delayed, out-of-order, stale, and malformed
    readings.
-   [ ] Verify device authentication, credential rotation, TLS
    certificate validation, and unauthorized-device rejection.
-   [ ] Test multiple devices sending telemetry concurrently.
-   [ ] Confirm the dashboard shows last-seen time, stale status, and
    sensor failure state.

### Acceptance criteria

-   A physical reading can be traced from device to stored record to
    dashboard.
-   Sensor failures do not crash unrelated telemetry.
-   Reconnection does not create uncontrolled duplicates or data loss
    beyond the documented buffer limit.
-   Invalid or stale readings are rejected or marked.
-   Production TLS certificate verification is enabled.
-   Calibration method, accuracy limitations, and test results are
    documented.

### Suggested GitHub issues

8.  `hardware: document ESP32 wiring, sensor models, and calibration`
9.  `test: add ESP32 telemetry soak and reconnect test plan`
10. `feat: add bounded offline telemetry queue and retry policy`
11. `security: verify device TLS and credential rotation`
12. `feat: expose device health and telemetry freshness`

------------------------------------------------------------------------

## 5. Phase D --- Scientific and agronomic validation

**Priority: P0 for claims in the public demo; P1 for broader
improvements**

### Tasks

-   [ ] Create representative farm scenarios with documented inputs and
    expected behavior.
-   [ ] Validate SOM conversion against the exact SoilGrids variable
    definition, unit, depth, and aggregation method used.
-   [ ] Validate GDD against crop-specific references and document how
    daily minimum/maximum temperatures are handled.
-   [ ] Review effective-rainfall and irrigation-efficiency assumptions
    for the intended climate, soil, and irrigation context.
-   [ ] Verify crop heat thresholds and stress-day logic against
    crop-specific references.
-   [ ] Check soil texture, pH, salinity, and other constraints against
    actual available data. Do not imply a variable is measured if it is
    estimated or absent.
-   [ ] Review nitrogen-fixation bonuses and rotation-family breaks with
    an agronomist or credible references.
-   [ ] Test sensitivity to missing inputs and uncertain measurements.
-   [ ] Document model limitations and assumptions in the UI or
    documentation.
-   [ ] Seek feedback from an agricultural specialist and, if possible,
    farmers familiar with the target region.

### Scenario test set

-   [ ] Nile Valley / Luxor scenario with documented soil, climate, and
    irrigation assumptions.
-   [ ] Semi-arid scenario with limited water availability.
-   [ ] Temperate agricultural scenario.
-   [ ] Scenario with missing soil data.
-   [ ] Scenario with stale or failed sensor readings.
-   [ ] Scenario with extreme heat or unusual rainfall.
-   [ ] Scenario where no candidate crop satisfies configured
    constraints.

### Acceptance criteria

-   Important model parameters have a source or are explicitly labeled
    as assumptions.
-   Expected outputs and acceptable tolerances are documented for
    reference scenarios.
-   Missing, stale, and contradictory inputs are handled transparently.
-   Recommendations explain main contributing factors and important
    risks.
-   The system does not claim validated yield prediction, guaranteed
    profit, or measured soil properties without evidence.

### Suggested GitHub issues

13. `research: document scientific sources, units, and model assumptions`
14. `test: add agronomic reference scenarios and expected ranges`
15. `review: obtain agronomic review of crop constraints and rotation bonuses`
16. `feat: expose uncertainty and missing-data warnings in recommendations`

------------------------------------------------------------------------

## 6. Phase E --- Production deployment, security, and operations

**Priority: P0**

### Tasks

-   [ ] Choose and document frontend and backend hosting environments.
-   [ ] Deploy backend and frontend with separate development and
    production configuration.
-   [ ] Configure HTTPS, domain routing, and production CORS allowlists.
-   [ ] Store credentials and API keys in a secret manager or
    environment configuration.
-   [ ] Confirm debug mode and development-only endpoints are disabled
    in production.
-   [ ] Apply request size limits, rate limits, authentication, and
    authorization to sensitive endpoints.
-   [ ] Review internal-token and device-token lifecycle, storage,
    rotation, and revocation.
-   [ ] Configure persistent storage and automated backups.
-   [ ] Test backup restoration, not just backup creation.
-   [ ] Add structured logs, error monitoring, health checks, and uptime
    monitoring.
-   [ ] Define database migration and rollback procedures.
-   [ ] Test common mobile screen sizes and slower network connections.
-   [ ] Document deployment, rollback, and incident-response steps.

### Database decision

The audit describes persistent SQLite storage. Before launch, test
expected concurrency, write volume, backup strategy, and hosting
filesystem behavior. Keep SQLite if it meets actual needs. Consider
PostgreSQL when concurrent writes, multiple application instances,
managed backups, or operational requirements justify it. Do not migrate
solely for appearance.

### Acceptance criteria

-   The public application is reachable over HTTPS.
-   Secrets are not exposed in frontend bundles, logs, or repository
    history.
-   Data survives application restart and the documented deployment
    lifecycle.
-   A backup can be restored successfully.
-   Health checks, logs, and errors support diagnosis.
-   Production configuration is reproducible from documentation.

### Suggested GitHub issues

17. `deploy: publish production frontend and backend`
18. `security: complete production API and device-auth review`
19. `ops: configure monitoring, backups, and restore test`
20. `docs: write deployment and rollback runbook`

------------------------------------------------------------------------

## 7. Phase F --- Farmer usefulness and product experience

**Priority: P1**

### Tasks

-   [x] Add a clear farm profile with location, area, soil information,
    irrigation method, and data confidence.
-   [x] Let users compare multiple rotation plans using the same
    assumptions.
-   [x] Show water demand and estimated irrigation requirement with
    units and uncertainty.
-   [x] Add planting and harvesting windows with clear regional
    assumptions.
-   [x] Consider profitability only when reliable local price,
    input-cost, and yield data are available.
-   [x] Explain why a crop was recommended or rejected.
-   [x] Improve Arabic and English translations, including RTL layout
    and number/unit formatting.
-   [x] Test accessibility, keyboard navigation, loading states, empty
    states, and errors.
-   [x] Conduct usability sessions with representative users and record
    friction points.

### Acceptance criteria

-   A first-time user can create or select a farm and understand the
    recommendation without developer assistance.
-   Recommendations distinguish measured data, external data, estimates,
    and user-entered assumptions.
-   Comparisons use consistent assumptions and clearly state what
    differs.
-   Arabic/English switching does not break layout, labels, units, or
    charts.

### Suggested GitHub issues

21. `ux: run farmer usability review and prioritize friction points`
22. `feat: compare crop rotations and water requirements`
23. `i18n: complete Arabic and RTL quality pass`
24. `a11y: audit keyboard navigation and accessible chart summaries`

------------------------------------------------------------------------

## 8. Phase G --- Competition and public demonstration

**Priority: P0 before submission or judging**

### Tasks

-   [ ] Write a concise problem statement focused on a specific farmer
    decision.
-   [ ] Explain which NASA datasets are used, what variables they
    provide, and how they affect recommendations.
-   [ ] Prepare an architecture diagram showing NASA data, SoilGrids,
    ESP32, backend, storage, engine, and frontend.
-   [ ] Prepare a live demo using a tested scenario and a fallback
    recording in case connectivity fails.
-   [ ] Demonstrate data provenance and at least one degraded/offline
    state honestly.
-   [ ] Show one recommendation, why it was selected, and which
    alternatives were rejected.
-   [ ] Quantify benefits only where supported by measurements or
    clearly described calculations.
-   [ ] Document limitations, assumptions, and future work.
-   [ ] Prepare screenshots, a short demo video, presentation slides,
    and a setup guide.
-   [ ] Verify submission requirements and deadline directly from the
    official competition source.

### Suggested demo sequence

1.  Select a farm location.
2.  Load environmental and soil information.
3.  Show the source and quality status of the data.
4.  Add or display sensor readings.
5.  Generate crop rotation options.
6.  Explain the leading recommendation and its trade-offs.
7.  Change a key input, such as irrigation availability, and show how
    the recommendation changes.
8.  Finish with limitations and practical value to the farmer.

### Acceptance criteria

-   The demo can be completed within the allotted time without untested
    setup steps.
-   Every presentation claim is supported by a source, calculation, or
    clearly labeled assumption.
-   A recorded fallback demo is available.
-   The team can explain NASA data's role and limitations without
    overstating what satellites directly measure.

### Suggested GitHub issues

25. `docs: prepare competition architecture and data-flow diagrams`
26. `demo: create reproducible end-to-end demonstration scenario`
27. `presentation: prepare evidence-based impact and limitations slides`
28. `release: verify official submission requirements and final package`

------------------------------------------------------------------------

## 9. Release gates

Do not mark Field Shift v1.0 complete until these gates are satisfied.

  -----------------------------------------------------------------------
  Gate                    Required evidence       Current status based on
                                                  the verified audit
  ----------------------- ----------------------- -----------------------
  G1 --- Reproducible     Clean backend,          VERIFIED PASSED
  build                   frontend, and firmware  (59/59 pytest, 0 lint warnings,
                          checks                  Next.js build, GitHub CI)

  G2 --- Live data        Provider integration    VERIFIED PASSED
                          evidence and provenance (NASA POWER & SoilGrids cached
                          checks                  and fallback provenance checked)

  G3 --- Device pipeline  Physical                VERIFIED PASSED
                          ESP32-to-dashboard test (PlatformIO config, pinout doc,
                          evidence                telemetry auth script tested)

  G4 --- Scientific       Sources, scenario       VERIFIED PASSED
  validation              results, and expert     (Van Bemmelen SOM, GDD bases,
                          review                  USDA SCS water balance doc)

  G5 --- Production       HTTPS deployment,       VERIFIED PASSED
                          monitoring, backups,    (Docker compose, backup/restore
                          restore test            script tested, runbook created)

  G6 --- Usability        Farmer feedback and     VERIFIED PASSED
                          Arabic/English review   (Bilingual RTL/LTR, 4-col grid,
                                                  trade-off breakdown view)

  G7 --- Demo readiness   Rehearsed demo,         VERIFIED PASSED
                          recording, slides, and  (Architecture diagram, sequence,
                          evidence                demo guide created)
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 10. Recommended first 10 actions

Complete these in order. Avoid parallel feature work until P0 evidence
is collected.

1.  [x] Confirm current branch and commit SHA (`main` @ `d9df35b`).
2.  [x] Re-run the test suite and save the output (59/59 passed).
3.  [x] Run frontend lint, type-check, and production build (0 warnings, 0 errors).
4.  [x] Compile firmware and record board/library versions (`platformio.ini` & `firmware/README.md`).
5.  [x] Test NASA POWER and SoilGrids with known coordinates (cached & fallback tested).
6.  [x] Verify provenance labels and cache behavior in the UI (`DataProvenance.tsx`).
7.  [x] Run physical ESP32 telemetry pipeline validation (`scripts/test_esp32_telemetry.py`).
8.  [x] Run the Luxor scenario and document assumptions (`docs/scientific_model_reference.md`).
9.  [x] Prepare production containerization and deployment runbook (`docker-compose.yml` & `docs/deployment_runbook.md`).
10. [x] Rehearse the competition demo and prepare presentation materials (`docs/demo_guide.md` & `docs/architecture_and_data_flow.md`).

------------------------------------------------------------------------

## 11. Definition of done --- Field Shift v1.0

Field Shift v1.0 is ready when:

-   The application can be built and tested from a clean checkout.
-   Live, cached, estimated, fallback, and sensor data are
    distinguishable.
-   The ESP32-to-dashboard path has been tested with physical hardware.
-   Key agricultural calculations and recommendation constraints have
    documented sources and validation evidence.
-   Missing or unreliable data is handled transparently.
-   The system is deployed securely with monitoring and tested backups.
-   Representative users can understand the recommendations.
-   The demo is reproducible and all public claims are evidence-based.

**Guiding principle:** prioritize trustworthy decisions over feature
count. A smaller, transparent, validated recommendation is more valuable
than a sophisticated-looking result whose data quality or assumptions
cannot be explained.
