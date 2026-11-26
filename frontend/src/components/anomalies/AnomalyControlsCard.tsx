import React from 'react';
import type { AnomalyWindowPreset, LocationSummary } from '../../types';
import styles from './Anomalies.module.css';

export const ANOMALY_PARAMETERS = [
  { id: 'pm25', label: 'PM2.5', name: 'Fine Particulate Matter' },
  { id: 'pm10', label: 'PM10', name: 'Respirable Particulate Matter' },
  { id: 'no2', label: 'NO₂', name: 'Nitrogen Dioxide' },
  { id: 'so2', label: 'SO₂', name: 'Sulfur Dioxide' },
  { id: 'o3', label: 'O₃', name: 'Ozone' },
  { id: 'co', label: 'CO', name: 'Carbon Monoxide' },
];

export interface AnomalyControlsCardProps {
  stationId: number;
  stationName: string;
  availableStations: LocationSummary[];
  isLoading: boolean;
  isLoadingStations: boolean;
  parameter: string;
  windowPreset: AnomalyWindowPreset;
  referenceTime: string;
  sensorPrecisionInput: string;
  onStationSelect: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onParameterChange: (param: string) => void;
  onWindowPresetChange: (preset: AnomalyWindowPreset) => void;
  onReferenceTimeChange: (val: string) => void;
  onSensorPrecisionChange: (val: string) => void;
  onRefresh: () => void;
}

/**
 * Control card for selecting station, pollutant, rolling window, reference timestamp, and precision overrides.
 */
export const AnomalyControlsCard: React.FC<AnomalyControlsCardProps> = ({
  stationId,
  stationName,
  availableStations,
  isLoading,
  isLoadingStations,
  parameter,
  windowPreset,
  referenceTime,
  sensorPrecisionInput,
  onStationSelect,
  onParameterChange,
  onWindowPresetChange,
  onReferenceTimeChange,
  onSensorPrecisionChange,
  onRefresh,
}) => {
  return (
    <div className={`card ${styles.controlsCard}`}>
      <div className={styles.controlsHeader}>
        <div className={styles.controlsTitleGroup}>
          <span className={`card-icon ${styles.controlsIcon}`} aria-hidden="true">
            ⚡
          </span>
          <h3 className={styles.controlsTitle}>Evaluation Controls &amp; Context</h3>
        </div>

        <button
          type="button"
          className={`btn btn-secondary ${styles.refreshBtn}`}
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Screening Telemetry...' : 'Refresh Screening'}
        </button>
      </div>

      <div className={styles.controlsGrid}>
        <div className={`form-group ${styles.formGroup}`}>
          <label htmlFor="station-selector" className={styles.fieldLabel}>
            Monitoring Station
          </label>
          <select
            id="station-selector"
            className={`form-control ${styles.fullInput}`}
            value={stationId}
            onChange={onStationSelect}
            disabled={isLoading || isLoadingStations}
          >
            {availableStations.length > 0 ? (
              availableStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.locality || s.country_code})
                </option>
              ))
            ) : (
              <option value={stationId}>{stationName}</option>
            )}
          </select>
        </div>

        <div className={`form-group ${styles.formGroup}`}>
          <label htmlFor="parameter-selector" className={styles.fieldLabel}>
            Target Pollutant
          </label>
          <select
            id="parameter-selector"
            className={`form-control ${styles.fullInput}`}
            value={parameter}
            onChange={(e) => onParameterChange(e.target.value)}
            disabled={isLoading}
          >
            {ANOMALY_PARAMETERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className={`form-group ${styles.formGroup}`}>
          <label className={styles.fieldLabel}>Evaluation Window</label>
          <div className={styles.windowButtons}>
            <button
              type="button"
              className={`btn ${windowPreset === '24h' ? 'btn-primary' : 'btn-secondary'} ${styles.windowBtn}`}
              onClick={() => onWindowPresetChange('24h')}
            >
              24-Hour (18/24 min)
            </button>
            <button
              type="button"
              className={`btn ${windowPreset === '7d' ? 'btn-primary' : 'btn-secondary'} ${styles.windowBtn}`}
              onClick={() => onWindowPresetChange('7d')}
            >
              7-Day (126/168 min)
            </button>
          </div>
          <span className={styles.fieldHint}>
            {windowPreset === '24h'
              ? 'Primary screening: 24h rolling window (requires ≥18 hourly observations / 75%)'
              : 'Complete historical evaluation: 168h interval (requires ≥126 hourly observations / 75%)'}
          </span>
        </div>

        <div className={`form-group ${styles.formGroup}`}>
          <div className={styles.labelRow}>
            <label htmlFor="ref-time-input" className={styles.fieldLabel}>
              Reference Time (Optional)
            </label>
            {referenceTime && (
              <button
                type="button"
                onClick={() => onReferenceTimeChange('')}
                className={styles.clearBtn}
              >
                Clear (Live)
              </button>
            )}
          </div>
          <input
            id="ref-time-input"
            type="text"
            className={`form-control ${styles.fullInput}`}
            placeholder="e.g. 2026-11-01T12:00:00Z"
            value={referenceTime}
            onChange={(e) => onReferenceTimeChange(e.target.value)}
          />
        </div>
      </div>

      <details className={`advanced-controls ${styles.advancedDetails}`} open={Boolean(sensorPrecisionInput)}>
        <summary className={styles.advancedSummary}>
          <span>Advanced Controls &amp; Sensor Precision Calibration</span>
        </summary>
        <div className={styles.precisionWrap}>
          <div className={`form-group ${styles.formGroup}`}>
            <label htmlFor="precision-input" className={styles.fieldLabel}>
              Caller Precision Test (Optional)
            </label>
            <input
              id="precision-input"
              type="number"
              step="0.01"
              min="0"
              className={`form-control ${styles.fullInput}`}
              placeholder="e.g. 0.1 (Caller-supplied)"
              value={sensorPrecisionInput}
              onChange={(e) => onSensorPrecisionChange(e.target.value)}
            />
            <span className={styles.fieldHint}>
              Explicitly labeled as caller-supplied test input; not verified metadata.
            </span>
          </div>
        </div>
      </details>
    </div>
  );
};

