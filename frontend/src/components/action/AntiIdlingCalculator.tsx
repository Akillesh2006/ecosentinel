import React from 'react';
import type { AirQualityApiError, IdlingAbatementResponse } from '../../types';
import styles from './ActionPlan.module.css';

export interface AntiIdlingCalculatorProps {
  vehicleInput: string;
  hoursInput: string;
  isSuppressed: boolean;
  validationError: string | null;
  apiError: AirQualityApiError | null;
  isLoading: boolean;
  isEstimateSynchronized: boolean;
  abatementData: IdlingAbatementResponse | null;
  onVehicleChange: (val: string) => void;
  onHoursChange: (val: string) => void;
}

/**
 * Modelled commercial diesel anti-idling abatement estimator (backend canonical factors).
 */
export const AntiIdlingCalculator: React.FC<AntiIdlingCalculatorProps> = ({
  vehicleInput,
  hoursInput,
  isSuppressed,
  validationError,
  apiError,
  isLoading,
  isEstimateSynchronized,
  abatementData,
  onVehicleChange,
  onHoursChange,
}) => {
  return (
    <div className={isSuppressed ? styles.suppressedBlock : undefined}>
      <h4 className={styles.subSectionTitle}>
        <span className={`card-icon ${styles.iconBox}`} aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="1" y="3" width="15" height="13" />
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
        </span>
        1. Heavy Diesel Commercial Vehicle Anti-Idling Calculator
      </h4>

      <p className={styles.subSectionDesc}>
        Configures verifiable operational anti-idling protocols at logistics yards, loading docks, and vehicle staging bays.
        Calculates canonical engineering estimates using verified backend constants.
      </p>

      <div className={styles.inputsGrid}>
        <div className={styles.inputGroup}>
          <label htmlFor="input-vehicle-count" className={styles.inputLabel}>
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
            onChange={(e) => onVehicleChange(e.target.value)}
            className={`search-input ${styles.fullInput}`}
            aria-describedby={validationError ? 'abatement-validation-error' : undefined}
          />
          <span className={styles.inputHint}>
            Staged freight trucks or buses subject to anti-idling enforcement
          </span>
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="input-idling-hours" className={styles.inputLabel}>
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
            onChange={(e) => onHoursChange(e.target.value)}
            className={`search-input ${styles.fullInput}`}
            aria-describedby={validationError ? 'abatement-validation-error' : undefined}
          />
          <span className={styles.inputHint}>
            Planned engine shutdown duration per shift (hours)
          </span>
        </div>
      </div>

      {validationError && (
        <div id="abatement-validation-error" role="alert" className={styles.errorBox}>
          ⚠️ {validationError}
        </div>
      )}

      {apiError && !validationError && (
        <div role="alert" className={styles.errorBox}>
          ⚠️ Backend Calculation Error ({apiError.error_code}): {apiError.message}
        </div>
      )}

      {isLoading && !validationError && (
        <div className={styles.loadingRow}>
          <div className={`spinner ${styles.spinnerSm}`} />
          <span>Updating canonical potential abatement estimates...</span>
        </div>
      )}

      {isEstimateSynchronized && abatementData && (
        <div className={styles.resultsWrap}>
          <div className={styles.resultsHeader}>
            <span className={styles.resultsTitle}>
              Estimated Potential Emissions Avoided ({abatementData.total_vehicle_hours.toFixed(1)} total vehicle-hours):
            </span>
            <span className={styles.resultsNote}>
              Engineering estimate · Not an observed ambient measurement
            </span>
          </div>

          <div className="metrics-strip">
            <div className="metric-cell">
              <span className="metric-label">Diesel Fuel Saved</span>
              <span className="metric-value font-mono">{abatementData.avoided_fuel_liters.toFixed(2)} L</span>
              <span className={styles.factorNote}>1.0 L/veh-h (CSIR-CRRI)</span>
            </div>

            <div className="metric-cell">
              <span className="metric-label">CO₂ Curtailment</span>
              <span className="metric-value font-mono">{abatementData.avoided_co2_kg.toFixed(2)} kg</span>
              <span className={styles.factorNote}>2.68 kg/veh-h (IPCC balance)</span>
            </div>

            <div className="metric-cell">
              <span className="metric-label">NOₓ Tailpipe Avoidance</span>
              <span className="metric-value font-mono">
                {abatementData.avoided_nox_kg >= 1.0
                  ? `${abatementData.avoided_nox_kg.toFixed(3)} kg`
                  : `${abatementData.avoided_nox_grams.toFixed(1)} g`}
              </span>
              <span className={styles.factorNote}>33.8 g/veh-h (US EPA model)</span>
            </div>

            <div className="metric-cell">
              <span className="metric-label">PM2.5 Tailpipe Avoidance</span>
              <span className="metric-value font-mono">{abatementData.avoided_pm25_grams.toFixed(2)} g</span>
              <span className={styles.factorNote}>1.1 g/veh-h (US EPA model)</span>
            </div>
          </div>

          <div className={`chart-disclaimer ${styles.disclaimerTop}`}>
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
  );
};

