import React from 'react';
import type { LocationSummary } from '../../types';
import styles from './Spatial.module.css';

export type WindowPreset = '24h' | '48h' | '7d';

export const SPATIAL_PARAMETERS = [
  { id: 'pm25', label: 'PM2.5', name: 'Fine Particulate Matter' },
  { id: 'pm10', label: 'PM10', name: 'Respirable Particulate Matter' },
  { id: 'no2', label: 'NO₂', name: 'Nitrogen Dioxide' },
  { id: 'so2', label: 'SO₂', name: 'Sulfur Dioxide' },
  { id: 'o3', label: 'O₃', name: 'Ozone' },
  { id: 'co', label: 'CO', name: 'Carbon Monoxide' },
];

export interface SpatialControlsCardProps {
  referenceStationId: number;
  referenceStationName: string;
  availableStations: LocationSummary[];
  isLoadingStations: boolean;
  parameter: string;
  radiusKm: number;
  windowPreset: WindowPreset;
  onReferenceChange: (newId: number) => void;
  onParameterChange: (newParam: string) => void;
  onRadiusChange: (newRadius: number) => void;
  onWindowPresetChange: (preset: WindowPreset) => void;
}

/**
 * Spatial analysis control panel for anchor station, pollutant, Haversine radius, and comparison window.
 */
export const SpatialControlsCard: React.FC<SpatialControlsCardProps> = ({
  referenceStationId,
  referenceStationName,
  availableStations,
  isLoadingStations,
  parameter,
  radiusKm,
  windowPreset,
  onReferenceChange,
  onParameterChange,
  onRadiusChange,
  onWindowPresetChange,
}) => {
  return (
    <div className={`card spatial-controls-card ${styles.controlsCard}`}>
      <div className={styles.controlsGrid}>
        <div className="form-group">
          <label htmlFor="ref-station-select" className={styles.fieldLabel}>
            Reference Station (Anchor)
          </label>
          <select
            id="ref-station-select"
            className={`form-control ${styles.selectInput}`}
            value={referenceStationId}
            onChange={(e) => onReferenceChange(Number(e.target.value))}
            disabled={isLoadingStations}
          >
            {availableStations.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.locality || 'India'})
              </option>
            ))}
            {availableStations.length === 0 && (
              <option value={referenceStationId}>{referenceStationName}</option>
            )}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="spatial-param-select" className={styles.fieldLabel}>
            Target Pollutant
          </label>
          <select
            id="spatial-param-select"
            className={`form-control ${styles.selectInput}`}
            value={parameter}
            onChange={(e) => onParameterChange(e.target.value)}
          >
            {SPATIAL_PARAMETERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <div className={styles.radiusHeader}>
            <label htmlFor="spatial-radius-input" className={styles.radiusLabel}>
              Search Radius: <strong className={styles.radiusValue}>{radiusKm} km</strong>
            </label>
            <div className={styles.presetGroup}>
              {[15, 25, 50].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRadiusChange(r)}
                  className={`btn-preset ${radiusKm === r ? `active ${styles.presetBtnActive}` : ''} ${styles.presetBtn}`}
                >
                  {r}k
                </button>
              ))}
            </div>
          </div>
          <input
            id="spatial-radius-input"
            type="range"
            min="1"
            max="100"
            step="1"
            value={radiusKm}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className={styles.radiusSlider}
            aria-label="Search Radius in Kilometers"
          />
        </div>

        <div className="form-group">
          <label className={styles.fieldLabel}>Comparison Window</label>
          <div className={styles.windowRow}>
            {(['24h', '48h', '7d'] as WindowPreset[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onWindowPresetChange(w)}
                className={`${styles.windowBtn} ${windowPreset === w ? styles.windowBtnActive : ''}`}
              >
                {w.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
