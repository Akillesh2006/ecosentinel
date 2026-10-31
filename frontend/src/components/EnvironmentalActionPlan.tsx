import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  AirQualityApiError,
  IdlingAbatementResponse,
  LocationDetail,
  LocationMeasurementsResponse,
  RiskAssessmentResponse,
} from '../types';
import { fetchAbatementEstimate } from '../services/api';

interface EnvironmentalActionPlanProps {
  locationDetail: LocationDetail | null;
  measurementsData: LocationMeasurementsResponse | null;
  assessmentData?: RiskAssessmentResponse | null;
}

const DEFAULT_SUPPORTIVE_DUST_CONTROLS = [
  'Scheduled haul-road dampening using treated wastewater (zero potable water wastage)',
  'Anti-smog mist cannon atomization (10–50 µm droplets directed at active aggregate piles)',
  'Vehicle egress wheel wash-down bays to prevent roadway mud track-out',
  'Speed restrictions (≤ 15–20 km/h) on unpaved site corridors to reduce kinetic dust resuspension',
  'Impermeable tarpaulin covers on inactive bulk material and soil stockpiles',
];

export const EnvironmentalActionPlan: React.FC<EnvironmentalActionPlanProps> = ({
  locationDetail,
  measurementsData,
  assessmentData,
}) => {
  // Input states
  const [vehicleInput, setVehicleInput] = useState<string>('10');
  const [hoursInput, setHoursInput] = useState<string>('2');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Request & async safety states
  const [abatementData, setAbatementData] = useState<IdlingAbatementResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<AirQualityApiError | null>(null);

  // Request identity and abort controller refs to prevent stale response overwrites
  const requestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Facility checklist interactive state
  const [checkedControls, setCheckedControls] = useState<Record<string, boolean>>({
    [DEFAULT_SUPPORTIVE_DUST_CONTROLS[0]]: true,
    [DEFAULT_SUPPORTIVE_DUST_CONTROLS[1]]: true,
  });

  // Export feedback state
  const [copied, setCopied] = useState<boolean>(false);

  // Safeguard evaluation
  const isHistorical = Boolean(
    assessmentData &&
      (assessmentData.status === 'historical_data' || assessmentData.freshness_state === 'historical')
  );
  const isStale = Boolean(
    assessmentData &&
      (assessmentData.status === 'stale_data' || assessmentData.freshness_state === 'stale')
  );
  const isIncomplete = Boolean(
    assessmentData &&
      (!assessmentData.is_completeness_satisfied || assessmentData.status === 'insufficient_data')
  );
  const isUnsupported = Boolean(
    assessmentData && assessmentData.status === 'unsupported_parameter'
  );

  const isSuppressed = !assessmentData || isHistorical || isStale || isIncomplete || isUnsupported;

  // Validation function (Strict, no silent clamping)
  const validateInputs = useCallback((vStr: string, hStr: string): { valid: boolean; vehicles?: number; hours?: number; error?: string } => {
    const vTrimmed = vStr.trim();
    const hTrimmed = hStr.trim();

    if (!vTrimmed) {
      return { valid: false, error: 'Vehicle count must be an integer between 1 and 200.' };
    }
    const vNum = Number(vTrimmed);
    if (!Number.isInteger(vNum) || vNum < 1 || vNum > 200) {
      return { valid: false, error: 'Vehicle count must be an integer between 1 and 200.' };
    }

    if (!hTrimmed) {
      return { valid: false, error: 'Curtailed idling duration must be between 0.5 and 12.0 hours.' };
    }
    const hNum = Number(hTrimmed);
    if (isNaN(hNum) || hNum < 0.5 || hNum > 12.0) {
      return { valid: false, error: 'Curtailed idling duration must be between 0.5 and 12.0 hours.' };
    }

    return { valid: true, vehicles: vNum, hours: hNum };
  }, []);

  // Effect to trigger canonical calculation when inputs or suppression changes
  useEffect(() => {
    if (isSuppressed) {
      setAbatementData(null);
      setValidationError(null);
      setApiError(null);
      setIsLoading(false);
      return;
    }

    const valResult = validateInputs(vehicleInput, hoursInput);
    if (!valResult.valid) {
      setValidationError(valResult.error || 'Invalid inputs.');
      setAbatementData(null);
      setApiError(null);
      setIsLoading(false);
      return;
    }

    setValidationError(null);
    setApiError(null);

    // Cancel prior in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const currentReqId = ++requestIdRef.current;
    setIsLoading(true);

    fetchAbatementEstimate(valResult.vehicles!, valResult.hours!, controller.signal)
      .then((res) => {
        if (currentReqId !== requestIdRef.current) {
          // Stale response discarded
          return;
        }
        setIsLoading(false);
        if (res.error) {
          setApiError(res.error);
          setAbatementData(null);
        } else if (res.data) {
          setAbatementData(res.data);
        }
      })
      .catch(() => {
        if (currentReqId !== requestIdRef.current) return;
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [vehicleInput, hoursInput, isSuppressed, validateInputs]);

  // Handle control checkbox toggle
  const toggleControl = (controlText: string) => {
    setCheckedControls((prev) => ({
      ...prev,
      [controlText]: !prev[controlText],
    }));
  };

  // Whether displayed result matches current inputs
  const isEstimateSynchronized = Boolean(
    abatementData &&
      !validationError &&
      !isLoading &&
      abatementData.vehicles === Number(vehicleInput.trim()) &&
      abatementData.hours === Number(hoursInput.trim())
  );

  // Generate plain-text dossier export
  const handleExportDossier = () => {
    if (!assessmentData || !isEstimateSynchronized || isSuppressed || !abatementData) {
      return;
    }

    const lines: string[] = [
      '================================================================================',
      'ECOSENTINEL FACILITY ENVIRONMENTAL ACTION & EVIDENCE DOSSIER',
      'Record Type: Operational Mitigation Action Plan (Not a Statutory Compliance Certificate)',
      `Station: ${assessmentData.station_name} (#${assessmentData.location_id})`,
      `Locality: ${assessmentData.locality || 'India'} | Provider: ${measurementsData?.provider_name || 'CPCB/OpenAQ'}`,
      `Coordinates: ${locationDetail?.coordinates ? `${locationDetail.coordinates.latitude.toFixed(4)}°N, ${locationDetail.coordinates.longitude.toFixed(4)}°E` : 'N/A'}`,
      `Dossier Timestamp: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC`,
      '================================================================================',
      '',
      '[PART A: VERIFIED AMBIENT EVIDENCE & SCREENING FINDING]',
      `- Pollutant Parameter: ${assessmentData.parameter_display_name} (${assessmentData.parameter})`,
      `- Reporting Unit: ${assessmentData.units}`,
      `- Averaging Period: ${assessmentData.averaging_period_label} rolling window`,
      `- Window Range: ${assessmentData.window_start_local || assessmentData.window_start_utc} to ${assessmentData.window_end_local || assessmentData.window_end_utc}`,
      `- Calculated Rolling Average: ${assessmentData.calculated_average !== null && assessmentData.calculated_average !== undefined ? `${assessmentData.calculated_average.toFixed(2)} ${assessmentData.units}` : 'N/A'}`,
      `- Statutory Reference Benchmark: ${assessmentData.standard_name || 'CPCB NAAQS (2009)'} = ${assessmentData.standard_threshold} ${assessmentData.standard_unit || assessmentData.units}`,
      `- Screening Status: ${assessmentData.status_label.toUpperCase()} (${assessmentData.ratio_to_standard ? `${assessmentData.ratio_to_standard}x reference threshold` : 'N/A'})`,
      assessmentData.secondary_benchmark_threshold
        ? `- Secondary Health Benchmark: ${assessmentData.secondary_benchmark_name || 'WHO AQG (2021)'} = ${assessmentData.secondary_benchmark_threshold} ${assessmentData.secondary_benchmark_unit} (${(assessmentData.calculated_average! / assessmentData.secondary_benchmark_threshold).toFixed(2)}x guideline)`
        : '',
      '',
      '[PART B: DATA INTEGRITY & SENSOR PROVENANCE AUDIT]',
      `- Valid Hourly Observations: ${assessmentData.valid_observations} / ${assessmentData.expected_observations} expected (${assessmentData.completeness_percentage.toFixed(1)}% coverage)`,
      `- 75% Completeness Gate: ${assessmentData.is_completeness_satisfied ? 'SATISFIED' : 'UNSATISFIED'} (${assessmentData.completeness_rule_label})`,
      `- Excluded Negative Value Artifacts: ${assessmentData.excluded_observations} invalid points (< 0 ${assessmentData.units})`,
      `- Sensor Freshness: ${assessmentData.freshness_state.toUpperCase()} (latest sensor timestamp: ${assessmentData.sensor_datetime_last_local || assessmentData.sensor_datetime_last_utc || 'N/A'})`,
      `- Station Instrumentation: ${locationDetail?.instruments && locationDetail.instruments.length > 0 ? locationDetail.instruments.join(', ') : 'Continuous Ambient Air Quality Monitoring Station (CAAQMS)'}`,
      '',
      '[PART C: OPERATIONAL MITIGATION PROTOCOLS]',
      '1. Facility Site Actions:',
    ];

    if (assessmentData.advisories && assessmentData.advisories.length > 0) {
      assessmentData.advisories.forEach((adv, idx) => {
        lines.push(`   1.${idx + 1} [${adv.category}] ${adv.action}`);
        lines.push(`       Rationale: ${adv.rationale}`);
        lines.push(`       Uncertainty: ${adv.uncertainty}`);
      });
    } else {
      lines.push('   (No emergency mitigation orders active for current screening status)');
    }

    lines.push('');
    lines.push('2. Confirmed Dust-Control Procedural Practices (CPCB / CAQM Mandates):');
    DEFAULT_SUPPORTIVE_DUST_CONTROLS.forEach((ctrl) => {
      const isChecked = checkedControls[ctrl];
      lines.push(`   [${isChecked ? 'X' : ' '}] ${ctrl}`);
    });

    lines.push('');
    lines.push('[PART D: QUANTIFIED POTENTIAL ABATEMENT (CANONICAL BACKEND ESTIMATES)]');
    lines.push(`- Configured Operational Scope: ${abatementData.vehicles} heavy commercial vehicles curtailed for ${abatementData.hours} hours`);
    lines.push(`- Total Operational Vehicle-Hours: ${abatementData.total_vehicle_hours.toFixed(1)} vehicle-hours`);
    lines.push(`- Estimated Fuel Saved: ${abatementData.avoided_fuel_liters.toFixed(2)} L (Factor: 1.0 L/veh-h | CSIR-CRRI in-use truck study)`);
    lines.push(`- Estimated CO2 Avoided: ${abatementData.avoided_co2_kg.toFixed(2)} kg (Factor: 2.68 kg/veh-h | 2006 IPCC Guidelines stoichiometry)`);
    lines.push(`- Estimated NOx Avoided: ${abatementData.avoided_nox_kg.toFixed(3)} kg (${abatementData.avoided_nox_grams.toFixed(1)} g) (Factor: 33.8 g/veh-h | US EPA EPA420-F-08-025 Table 1)`);
    lines.push(`- Estimated PM2.5 Avoided: ${abatementData.avoided_pm25_grams.toFixed(2)} g (Factor: 1.1 g/veh-h | US EPA EPA420-F-08-025 Table 1)`);
    lines.push('');
    lines.push('Fugitive Dust Control Benchmarks:');
    lines.push(`- Surface Watering Control Efficiency: 50%–70% (US EPA AP-42 §13.2.2 for unpaved surfaces maintaining ~2x moisture)`);
    lines.push('- PM10 Mass Avoided: N/A (calculating mass avoided requires site-specific silt, vehicle weight, and VKT measurements)');
    lines.push('');
    lines.push('[PART E: STATUTORY & ATMOSPHERIC CAVEATS]');
    lines.push(`* ${abatementData.statutory_disclaimer}`);
    lines.push(`* ${abatementData.atmospheric_boundary_caveat}`);
    lines.push(`* ${abatementData.fleet_technology_caveat}`);
    lines.push(`* ${assessmentData.spatial_disclaimer}`);
    lines.push('================================================================================');

    const fullDossierText = lines.filter((l) => l !== '').join('\n');

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(fullDossierText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }).catch(() => {});
    }
  };

  return (
    <div className="card" style={{ marginTop: '1.5rem', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <div className="station-badges">
            <span className="pill-tag pill-active">Milestone 5 Operational Module</span>
            <span className="pill-tag">Evidence-Based Action Plan</span>
            <span className="pill-tag">Canonical Abatement Engine</span>
          </div>
          <h3 className="card-title" style={{ marginTop: '0.5rem', fontSize: '1.3rem' }}>
            Facility Environmental Action Plan &amp; Abatement Dossier
          </h3>
          <p style={{ margin: '0.25rem 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            Translates verified monitoring evidence into auditable on-site emissions curtailment and procedural dust-suppression controls.
          </p>
        </div>

        {/* Export Button */}
        <button
          type="button"
          className="btn-primary"
          onClick={handleExportDossier}
          disabled={isSuppressed || !isEstimateSynchronized || Boolean(validationError) || isLoading}
          aria-label="Export Facility Action Dossier to clipboard"
          style={{ alignSelf: 'flex-start' }}
        >
          {copied ? '✓ Dossier Copied to Clipboard' : 'Export Facility Action Dossier'}
        </button>
      </div>

      {/* Quality Gate Suppression Alerts */}
      {isSuppressed && (
        <div className="notice-banner" role="alert" style={{ marginBottom: '1.5rem', borderColor: 'var(--color-status-warning)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem', flexShrink: 0, color: 'var(--color-status-warning)' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <strong>Operational Action Planning Suppressed:</strong>{' '}
            {!assessmentData && 'No active air quality assessment loaded. Select a station and parameter in the Investigate tab.'}
            {isHistorical && 'Retrospective evaluation of historical baseline data. Live operational mitigation planning and emissions abatement calculations are strictly suppressed for past records to prevent acting on retrospective data.'}
            {isStale && !isHistorical && 'Sensor observations have not updated within the past 24 hours. Live mitigation directives and abatement estimates are suppressed to prevent acting on outdated evidence.'}
            {isIncomplete && !isStale && !isHistorical && `Evaluation window contains insufficient hourly observations (${assessmentData?.valid_observations}/${assessmentData?.expected_observations} hours, ${assessmentData?.completeness_percentage}%). EcoSentinel requires at least 75% completeness before activating operational mitigation directives.`}
            {isUnsupported && 'Parameter reporting units cannot be evaluated against statutory reference standards.'}
          </div>
        </div>
      )}

      {/* Active Operational Context Banner (When Fresh & Complete) */}
      {!isSuppressed && assessmentData && (
        <div
          className="chart-disclaimer"
          style={{
            marginBottom: '1.5rem',
            borderColor: assessmentData.status === 'above_reference' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)',
            backgroundColor: assessmentData.status === 'above_reference' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>
            {assessmentData.status === 'above_reference' ? (
              <>
                <strong>Active Mitigation Directive:</strong> Rolling ambient {assessmentData.parameter_display_name} at {assessmentData.station_name} exceeds statutory CPCB NAAQS limits by <strong>{assessmentData.ratio_to_standard}x</strong> ({assessmentData.calculated_average} {assessmentData.units} vs limit {assessmentData.standard_threshold} {assessmentData.units}). Implement the operational fleet and dust-control protocols below.
              </>
            ) : (
              <>
                <strong>Voluntary Baseline Efficiency Planner:</strong> Current ambient {assessmentData.parameter_display_name} is within statutory reference levels ({assessmentData.calculated_average} {assessmentData.units} ≤ {assessmentData.standard_threshold} {assessmentData.units}). This planner allows evaluating voluntary facility fleet anti-idling efficiency and dust-suppression practices.
              </>
            )}
          </span>
        </div>
      )}

      {/* Section 1: Canonical Heavy Diesel Anti-Idling Calculator */}
      <div style={{ opacity: isSuppressed ? 0.5 : 1, pointerEvents: isSuppressed ? 'none' : 'auto' }}>
        <h4 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="card-icon" aria-hidden="true" style={{ width: '24px', height: '24px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </span>
          1. Heavy Diesel Commercial Vehicle Anti-Idling Calculator
        </h4>

        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          Configures verifiable operational anti-idling protocols at logistics yards, loading docks, and vehicle staging bays.
          Calculates canonical engineering estimates using verified backend constants.
        </p>

        {/* Input Form Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label htmlFor="input-vehicle-count" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Eligible Commercial Vehicles (1–200):
            </label>
            <input
              id="input-vehicle-count"
              type="number"
              min="1"
              max="200"
              step="1"
              value={vehicleInput}
              disabled={isSuppressed}
              onChange={(e) => setVehicleInput(e.target.value)}
              className="search-input"
              style={{ width: '100%' }}
              aria-describedby={validationError ? 'abatement-validation-error' : undefined}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Staged freight trucks or buses subject to anti-idling enforcement
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label htmlFor="input-idling-hours" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Curtailed Idling Duration per Vehicle (0.5–12.0 h):
            </label>
            <input
              id="input-idling-hours"
              type="number"
              min="0.5"
              max="12.0"
              step="0.5"
              value={hoursInput}
              disabled={isSuppressed}
              onChange={(e) => setHoursInput(e.target.value)}
              className="search-input"
              style={{ width: '100%' }}
              aria-describedby={validationError ? 'abatement-validation-error' : undefined}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Planned engine shutdown duration per shift (hours)
            </span>
          </div>
        </div>

        {/* Validation Error Notice (Explicit rejection, no silent clamping) */}
        {validationError && (
          <div
            id="abatement-validation-error"
            role="alert"
            style={{
              padding: '0.65rem 1rem',
              backgroundColor: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid var(--color-status-error)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-status-error)',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              fontWeight: 500,
            }}
          >
            ⚠️ {validationError}
          </div>
        )}

        {/* API Error Notice */}
        {apiError && !validationError && (
          <div
            role="alert"
            style={{
              padding: '0.65rem 1rem',
              backgroundColor: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid var(--color-status-error)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-status-error)',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            ⚠️ Backend Calculation Error ({apiError.error_code}): {apiError.message}
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading && !validationError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            <div className="spinner" style={{ width: '16px', height: '16px' }} />
            <span>Updating canonical potential abatement estimates...</span>
          </div>
        )}

        {/* Results Metrics Strip */}
        {isEstimateSynchronized && abatementData && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-accent-primary)' }}>
                Estimated Potential Emissions Avoided ({abatementData.total_vehicle_hours.toFixed(1)} total vehicle-hours):
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Engineering estimate · Not an observed ambient measurement
              </span>
            </div>

            <div className="metrics-strip">
              <div className="metric-cell">
                <span className="metric-label">Diesel Fuel Saved</span>
                <span className="metric-value font-mono">{abatementData.avoided_fuel_liters.toFixed(2)} L</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  1.0 L/veh-h (CSIR-CRRI)
                </span>
              </div>

              <div className="metric-cell">
                <span className="metric-label">CO₂ Curtailment</span>
                <span className="metric-value font-mono">{abatementData.avoided_co2_kg.toFixed(2)} kg</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  2.68 kg/veh-h (IPCC balance)
                </span>
              </div>

              <div className="metric-cell">
                <span className="metric-label">NOₓ Tailpipe Avoidance</span>
                <span className="metric-value font-mono">
                  {abatementData.avoided_nox_kg >= 1.0
                    ? `${abatementData.avoided_nox_kg.toFixed(3)} kg`
                    : `${abatementData.avoided_nox_grams.toFixed(1)} g`}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  33.8 g/veh-h (US EPA model)
                </span>
              </div>

              <div className="metric-cell">
                <span className="metric-label">PM2.5 Tailpipe Avoidance</span>
                <span className="metric-value font-mono">{abatementData.avoided_pm25_grams.toFixed(2)} g</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  1.1 g/veh-h (US EPA model)
                </span>
              </div>
            </div>

            {/* Scientific Caveats & Technology Disclosures */}
            <div className="chart-disclaimer" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>
                <strong>Factor Provenance &amp; Technology Disclosure:</strong> Fuel factor (1.0 L/h) originates from CSIR-CRRI empirical measurements on in-use trucks in Delhi. Pollutant factors (NOx 33.8 g/h, PM2.5 1.1 g/h) are derived from US EPA OTAQ model baselines and are <em>not in-use Indian tailpipe measurements</em>. Factors assume hot-stabilized curb idle without power take-off (PTO) or A/C loads and do not apply equally across all vehicle weights or Bharat Stage (BS) standards (BS-VI vehicles equipped with operational DPFs have substantially lower PM emissions during driving, whereas older BS-III/IV mechanical injection fleets produce higher particulate matter and unburned hydrocarbons).
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Fugitive Dust Suppression Protocol */}
      <div style={{ marginTop: '1.5rem', opacity: isSuppressed ? 0.5 : 1, pointerEvents: isSuppressed ? 'none' : 'auto' }}>
        <h4 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="card-icon" aria-hidden="true" style={{ width: '24px', height: '24px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          </span>
          2. Fugitive Dust Mitigation Guidance (CPCB / US EPA AP-42)
        </h4>

        <div className="empty-state-meta-box" style={{ width: '100%', marginBottom: '1rem' }}>
          <div className="meta-item">
            <span className="meta-label">Surface Watering Control Efficiency</span>
            <span className="meta-val" style={{ color: 'var(--color-accent-primary)', fontWeight: 600 }}>
              50% – 70% lift-off reduction
            </span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Primary Regulatory Standard</span>
            <span className="meta-val">US EPA AP-42 §13.2.2 &amp; CPCB Guidelines (Nov 2017)</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Calculated PM10 Mass Avoided</span>
            <span className="meta-val font-mono">N/A (Geotechnical data unmeasured)</span>
          </div>
        </div>

        <div className="chart-disclaimer" style={{ marginBottom: '1rem' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>
            <strong>Efficiency Scope &amp; Mass Boundary:</strong> The 50%–70% control efficiency applies <em>strictly to unpaved-road surface watering</em> maintaining approximately twice baseline surface moisture under US EPA AP-42 §13.2.2 conditions. Effectiveness declines as moisture evaporates and traffic continues. Kilograms of PM10 avoided are not calculated because reliable mass quantification requires site-specific surface silt percentage, vehicle gross weights, and vehicle-kilometres travelled.
          </span>
        </div>

        {/* Interactive Checklist of Supportive Controls */}
        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
          Site Operational Controls (Check confirmed measures for inclusion in Facility Dossier):
        </p>

        <ul className="checklist" style={{ marginBottom: '1.25rem' }}>
          {DEFAULT_SUPPORTIVE_DUST_CONTROLS.map((controlText, idx) => (
            <li key={idx} className="checklist-item" style={{ alignItems: 'center' }}>
              <input
                type="checkbox"
                id={`dust-ctrl-${idx}`}
                checked={Boolean(checkedControls[controlText])}
                disabled={isSuppressed}
                onChange={() => toggleControl(controlText)}
                style={{ width: '18px', height: '18px', cursor: isSuppressed ? 'default' : 'pointer' }}
              />
              <label htmlFor={`dust-ctrl-${idx}`} style={{ cursor: isSuppressed ? 'default' : 'pointer', fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
                {controlText}
              </label>
            </li>
          ))}
        </ul>

        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          *Note: Supportive operational controls represent mandatory procedural practices under CPCB/CAQM rules to prevent dust re-suspension and mud track-out; they do not add separate additive percentage reductions.
        </p>
      </div>

      {/* Mandatory Statutory & Atmospheric Disclaimers */}
      <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-subtle)', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
        <p style={{ marginBottom: '0.5rem' }}>
          <strong>Statutory Disclaimer:</strong> This operational action plan and abatement dossier represent an internal facility planning tool and do NOT constitute a statutory compliance certificate, legal regulatory determination, or official enforcement order under the <em>Air (Prevention and Control of Pollution) Act, 1981</em>.
        </p>
        <p>
          <strong>Atmospheric Scale Principle:</strong> Avoided emissions represent direct localized source reduction within the facility perimeter. Localized source curtailments eliminate on-site worker and boundary exposure, but will not predict or guarantee an immediate measurable concentration reduction at distant municipal ambient monitors governed by planetary boundary layer dynamics, thermal inversions, and regional background advection.
        </p>
      </div>
    </div>
  );
};

