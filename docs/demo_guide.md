# Field Shift --- Demonstration & Presentation Script

This guide provides an evidence-based demonstration flow for competition judges and agricultural stakeholders.

---

## 1. Demo Overview & Time Allocation (Total: 5 Minutes)

| Segment | Duration | Focus Area | Key Visual / Action |
| :--- | :--- | :--- | :--- |
| **1. Problem & Context** | 45 sec | Climate volatility, water scarcity, crop failure risks | Show landing page, explain why farmers need transparent multi-year planning |
| **2. Farm Setup & Location** | 45 sec | Upper Egypt / Luxor arid microclimate | Select Nile Valley (Luxor), Potato starting crop, Sandy Loam soil, and Irrigation |
| **3. Live Data & Provenance** | 60 sec | Satellite & in-situ data provenance | Point out the "Live" badges for NASA POWER & SoilGrids; show hardware sensor telemetry |
| **4. Algorithmic Recommendations** | 60 sec | Deterministic crop rotation sequencing | Review the 3 recommended sequences; explain Legume precursor bonus & pest breaks |
| **5. Scenario Stress Testing** | 60 sec | Climate simulation: $+2^\circ\text{C}$ & $-20\%$ rainfall | Drag simulation sliders, rerun, and observe rotation adaptation |
| **6. Q&A & Limitations** | 30 sec | Engineering transparency | Explain model boundaries, spatial resolution, and practical extension use |

---

## 2. Step-by-Step Walkthrough

### Step 1: Farm Location & Soil Setup
1. Open `http://localhost:3000`.
2. Notice the top status pill showing **API Live** (green dot).
3. Switch language between **English** and **العربية** to demonstrate seamless RTL/LTR bilingual support.
4. Select the **Nile Valley (Luxor, Egypt)** profile:
   - Latitude: `25.7013°N`, Longitude: `32.6353°E`
   - Soil: Sandy Loam
   - Irrigation: Active

### Step 2: Crop Selection & Farmer Priority
1. Choose **Potato** as the starting crop.
2. Select **Balanced** optimization priority (balancing water efficiency, soil recovery, and climate resilience).
3. Click **"Analyse rotations"**.

### Step 3: Inspect Evidence & Dashboards
1. **Agroclimatic Dashboard:** Observe annual GDD accumulation ($3,600+^\circ\text{C}\cdot\text{d}$) and seasonal rainfall ($<25\text{ mm}$ with severe deficit flag).
2. **Soil Health Dashboard:** Observe SOM derived from SoilGrids ($1.15\%$) and alkaline soil pH ($7.8$).
3. **Data Provenance Grid:** Scroll down to the 4-column Provenance section:
   - Note the **Live** badge on NASA POWER.
   - Note the **ISRIC SoilGrids 2.0** layer depth ($0-30\text{ cm}$).
   - Note observation timestamps and data quality flags.

### Step 4: Examine Crop Rotations & Calendar
1. Review Sequence 1: **Potato $\to$ Sorghum $\to$ Chickpea**.
   - Explain why Sorghum is chosen in Year 2: high heat tolerance ($>40^\circ\text{C}$) and deep root architecture breaking potato disease cycles.
   - Explain why Chickpea is chosen in Year 3: fixes atmospheric nitrogen ($+40\text{ kg N/ha}$), restoring fertility before the next rotation cycle.
2. View the interactive **Crop Calendar** tab displaying seasonal planting and harvesting windows.
3. Review the **MCDA Weighting & Trade-off Analysis** section and the list of agronomically rejected crops.

### Step 5: Climate Stress-Test Simulation
1. Scroll to the **Scenario Simulation** section.
2. Increase temperature by $+2^\circ\text{C}$ and reduce rainfall by $-20\%$.
3. Toggle irrigation off to test rainfed resilience, or keep it on.
4. Click **"Rerun scenario simulation"** and observe how the engine re-scores and filters rotations based on heightened heat stress.

---

## 3. Fallback Contingency Plan

If live network access to external NASA APIs is blocked or intermittent during judging:
- Field Shift's built-in **RetryingClient** and **TTL cache** will automatically serve cached responses or transparently fall back to calibrated demonstration baselines.
- The UI will clearly reflect data quality status as **"Calibrated Regional Profile (Fallback)"**, demonstrating robustness and graceful degradation under real-world connectivity disruptions.
