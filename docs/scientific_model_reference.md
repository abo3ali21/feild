# Field Shift --- Scientific Model & Agronomic Reference

**Document Version:** 1.0  
**Target Decision Support Engine:** Field Shift Climate-Resilient Rotation Recommender  
**Primary Standards & References:** FAO Irrigation and Drainage Paper 56, USDA SCS NEH-4 Hydrology, ISRIC SoilGrids 2.0, NASA POWER Agroclimatology.

---

## 1. Soil Organic Matter (SOM) Derivation

### Background & SoilGrids v2 Units
ISRIC SoilGrids 2.0 provides soil organic carbon (`soc`) as the mean mass concentration in the topsoil layer ($0-30\text{ cm}$) expressed in decigrams per kilogram ($\text{dg/kg}$).

### Conversion Formula
To calculate Soil Organic Carbon percentage ($\text{SOC \%}$):
$$\text{SOC \%} = \frac{\text{soc}_{\text{dg/kg}}}{100.0}$$

Using the standard **Van Bemmelen factor** ($1.724$), assuming soil organic matter comprises approximately $58\%$ elemental carbon ($1 / 0.58 \approx 1.724$):
$$\text{SOM \%} = \text{SOC \%} \times 1.724 = \left(\frac{\text{soc}_{\text{dg/kg}}}{100.0}\right) \times 1.724$$

*Note:* Where local soils contain high carbonate or non-humified organic fractions, empirical factors may vary between $1.72$ and $2.0$. The default $1.724$ represents the internationally recognized baseline.

---

## 2. Growing Degree Days (GDD) & Heat Stress Model

### Calculation Method
Growing Degree Days quantify thermal accumulation required for crop phenological development. For each day $i$:
$$T_{\text{mean}, i} = \frac{T_{\text{max}, i} + T_{\text{min}, i}}{2}$$

$$\Delta\text{GDD}_i = \max\left(0, T_{\text{mean}, i} - T_{\text{base}}\right)$$

$$\text{Annual GDD} = \sum_{i=1}^{365} \Delta\text{GDD}_i$$

### Base Temperatures ($T_{\text{base}}$) by Crop Family
- **Temperate / Cool-Season Crops (Wheat, Barley, Potato):** $T_{\text{base}} = 5.0^\circ\text{C}$
- **Warm-Season Cereals & Legumes (Maize, Sorghum, Soybean, Groundnut, Cotton):** $T_{\text{base}} = 10.0^\circ\text{C}$

### Heat Stress Days Logic
Heat stress days count consecutive or cumulative occurrences where $T_{\text{max}} \ge 35^\circ\text{C}$ (extreme heat threshold).
- **Rainfed Ceiling:** $90$ days.
- **Irrigated Arid Ceiling:** $180$ days for drought-tolerant crops ($\text{tolerance} \ge 0.55$) in recognized desert/hyper-arid zones (such as Upper Egypt / Luxor), reflecting the microclimatic cooling effect of irrigation water evaporation and transpirational cooling.

---

## 3. Effective Water Balance & Irrigation Efficiency

### USDA Soil Conservation Service (SCS) Method
Raw seasonal precipitation does not equate to plant-available water due to surface runoff, deep percolation, and canopy interception.

$$\text{Effective Rainfall } (P_{\text{eff}}) = \begin{cases}
\max\left(0,\, P \times \frac{125 - 0.2 \times P}{125}\right) & \text{if } P \le 250\text{ mm} \\
125 + 0.1 \times P & \text{if } P > 250\text{ mm}
\end{cases}$$

### Irrigation Application Efficiency
When irrigation is available, supplemental water application $I$ is factored with a standard surface/drip field efficiency ($\eta = 75\%$):
$$W_{\text{effective}} = P_{\text{eff}} + (I \times 0.75)$$

---

## 4. Multi-Criteria Decision Analysis (MCDA) Scoring

Rotations are evaluated over a 3-year sequence ($C_1 \to C_2 \to C_3$). Candidate sequences passing all hard constraints are scored across 4 normalized dimensions ($[0.0, 1.0]$):

1. **Climate Match ($S_{\text{climate}}$):** Thermal GDD suitability and tolerance of seasonal heat extremes.
2. **Water Security ($S_{\text{water}}$):** Ratio of effective water supply to cumulative crop water requirements.
3. **Soil Health ($S_{\text{soil}}$):** Alignment with soil pH tolerance, texture preference, and SOM maintenance.
4. **Diversity & Sequence ($S_{\text{div}}$):** Family alternation, botanical diversity, and root architecture depth rotation.

### Agronomic Sequence Bonuses & Penalties
- **Legume Precursor Bonus ($+0.04$):** Awarded when a legume (e.g. Chickpea, Faba Bean, Soybean, Groundnut) immediately precedes a nitrogen-demanding crop (e.g. Maize, Wheat).
- **Root Architecture Alternation ($+0.02$):** Alternating shallow-rooted crops with deep taproot crops preserves soil structure and prevents hardpan compaction.
- **Monoculture / Family Repetition Penalty ($-0.15$):** Severe penalty if the same botanical family (e.g. Solanaceae $\to$ Solanaceae) is repeated in consecutive seasons, mitigating soil-borne pathogen cycles (e.g., *Fusarium*, *Ralstonia*).

---

## 5. Model Boundaries & Scientific Limitations

1. **Not a Yield Prediction Engine:** The model provides relative agronomic suitability and risk screening; it does not simulate daily carbon assimilation, biomass accumulation, or exact yield in metric tons per hectare.
2. **Spatial Resolution:** ISRIC SoilGrids has a $250\text{ m}$ nominal grid cell resolution. NASA POWER agroclimatology is gridded at $0.5^\circ \times 0.5^\circ$. In-situ field sensors (such as the ESP32 capacitive probe) should always be used to validate localized anomalies.
3. **Pest & Weed Pressure:** Dynamic insect pest outbreaks and localized weed infestations are not explicitly modeled; crop family rotation intervals serve as preventative cultural controls.
