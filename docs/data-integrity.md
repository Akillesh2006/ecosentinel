# EcoSentinel Environmental Data Integrity Principles

## 1. Core Mission and Ethical Constraints

EcoSentinel is an evidence-based environmental intelligence platform. Because environmental and air-quality data directly impacts public understanding, policy decisions, and community wellbeing, maintaining strict scientific and statistical integrity is paramount.

---

## 2. Key Principles

### Principle 1: Never Fabricate or Synthesize Environmental Statistics as Real Observations
- The application will **never** generate, display, or extrapolate fake air-quality metrics under the guise of live or historical observations.
- In early stages or placeholder views, empty states with clear explanatory text must be used rather than placeholder numbers that look plausible.

### Principle 2: Strict Separation of Synthetic Demonstration Data
- When synthetic data is created for benchmarking, algorithm validation, or UI testing, it must be explicitly and visibly tagged:
  - In data structures: `is_synthetic: true`
  - In user interfaces: A prominent banner or badge indicating "Demonstration / Synthetic Data".
  - In API responses: Explicit metadata identifying synthetic origin.

### Principle 3: Statistical Anomaly ≠ Proof of Pollution or Causation
- A detected statistical deviation indicates only that an observed value differs significantly from an established baseline under defined statistical criteria (e.g., standard deviations, quantile thresholds).
- A statistical anomaly:
  - **Does not prove pollution** (e.g., changes may stem from atmospheric inversions, humidity shifts, construction dust, or pollen).
  - **Does not identify causation or responsible parties** (source attribution requires specialized chemical speciation, dispersion modeling, and emission inventory verification).
- All reports and UI surfaces must present findings with explanatory language stating observed changes rather than unwarranted causal conclusions.

### Principle 4: Full Transparency of Baseline & Evidence
Every finding presented by EcoSentinel must detail:
1. **What changed**: The exact parameter, magnitude of deviation, and physical measurement unit.
2. **When it occurred**: Clear UTC timestamps for the onset, peak, and duration of the event.
3. **Historical baseline comparison**: Which baseline window was selected (e.g., same hour of day over preceding 30 days, seasonal median), sample count, and expected bounds.
4. **Supporting evidence**: Raw observation counts, sensor confidence scores, and adjacent station measurements if available.
5. **Limitations and missing data**: Percentage of missing data points in the analysis window, sensor calibration status, and potential confounding variables.

---

## 3. Transparency Checklist for Future Milestones

Before releasing analytical features or visual reporting:
- [ ] Is the data source attributed with timestamp and sensor identifier?
- [ ] Are measurement units ($\mu\text{g}/\text{m}^3$, $\text{ppm}$, $\text{ppb}$) clearly specified?
- [ ] Are missing data intervals explicitly displayed rather than silently interpolated?
- [ ] Is uncertainty or confidence interval represented?
- [ ] Does the UI avoid speculative language about polluters or health impacts unless supported by certified regulatory standards?
