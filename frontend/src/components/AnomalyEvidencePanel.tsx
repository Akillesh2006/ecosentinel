import React from 'react';
import type { AnomalyObservationPoint, PrecisionProvenance } from '../types';
import styles from './anomalies/Anomalies.module.css';

export interface AnomalyEvidencePanelProps {
  observation: AnomalyObservationPoint | null;
  parameterDisplayName: string;
  units: string;
  precisionProvenance?: PrecisionProvenance | string;
  sensorPrecision?: number | null;
}

export const AnomalyEvidencePanel: React.FC<AnomalyEvidencePanelProps> = ({
  observation,
  parameterDisplayName,
  units,
  precisionProvenance = 'UNKNOWN',
  sensorPrecision,
}) => {
  if (!observation) {
    return (
      <div className={`card anomaly-evidence-card empty-evidence ${styles.evidenceEmpty}`}>
        <div className={styles.evidenceEmptyText}>
          Select an observation point on the timeline to inspect mathematical evidence, leave-one-out baseline metrics, and rate-of-change diagnostics.
        </div>
      </div>
    );
  }

  const isZeroMad = observation.scale_state === 'INDETERMINATE_ZERO_MAD';
  const modZ = observation.modified_z_score;
  const localTime = observation.datetime_local || 'Local time not reported';
  const utcTime = observation.datetime_utc;

  const modZColorClass =
    modZ !== null && modZ !== undefined
      ? Math.abs(modZ) >= 3.5
        ? styles.kpiValueAnomaly
        : Math.abs(modZ) >= 2.5
        ? styles.kpiValueElevated
        : styles.kpiValueNormal
      : styles.kpiDenominator;

  return (
    <div className="card anomaly-evidence-card" aria-label="Observation Evidence Detail">
      <div className={`card-header ${styles.evidenceHeader}`}>
        <div>
          <span className={`card-badge ${styles.evidenceEyebrow}`}>Empirical Evidence Dossier</span>
          <h3 className={styles.evidenceTitle}>Observation Analysis &amp; Baseline Metrics</h3>
          <div className={styles.evidenceTimestamps}>
            Local: {localTime} • UTC: {new Date(utcTime).toUTCString()}
          </div>
        </div>

        <div className={styles.evidenceBadges}>
          <span
            className={`badge badge-${
              observation.anomaly_type === 'STATISTICAL_SPIKE'
                ? 'anomaly'
                : observation.anomaly_type === 'STATISTICAL_DROP'
                ? 'info'
                : observation.anomaly_type === 'MODERATE_ELEVATION'
                ? 'warning'
                : 'normal'
            } ${styles.evidenceBadge}`}
          >
            {observation.anomaly_type || 'NORMAL'}
          </span>
          {observation.is_cpcb_exceedance && (
            <span className={`badge badge-anomaly ${styles.evidenceCpcbBadge}`}>
              CPCB Exceedance
            </span>
          )}
        </div>
      </div>

      <div className={styles.evidenceMetricGrid}>
        <div className="metric-cell">
          <span className="metric-label">Observed {parameterDisplayName}</span>
          <span className={`metric-value ${styles.kpiValuePrimary}`}>
            {observation.observed_value}{' '}
            <span className={styles.evidenceUnit}>{units}</span>
          </span>
        </div>

        <div className="metric-cell">
          <span className="metric-label">Modified Z-Score (M)</span>
          {isZeroMad ? (
            <span className={`metric-value ${styles.evidenceValueCompact} ${styles.kpiValueElevated}`}>
              Indeterminate
            </span>
          ) : modZ !== null && modZ !== undefined ? (
            <span className={`metric-value ${modZColorClass}`}>
              {modZ > 0 ? '+' : ''}
              {modZ.toFixed(2)} M
            </span>
          ) : (
            <span className={`metric-value ${styles.evidenceValueCompact} ${styles.kpiDenominator}`}>
              N/A
            </span>
          )}
          <span className={styles.evidenceSubnote}>Absolute threshold: |M| ≥ 3.5</span>
        </div>

        <div className="metric-cell">
          <span className="metric-label">Leave-One-Out Median</span>
          <span className={`metric-value ${styles.kpiValueTeal}`}>
            {observation.independent_median !== null && observation.independent_median !== undefined
              ? `${observation.independent_median.toFixed(1)} ${units}`
              : 'N/A'}
          </span>
          <span className={styles.evidenceSubnote}>Excludes evaluated point</span>
        </div>

        <div className="metric-cell">
          <span className="metric-label">Normalized MAD (NMAD)</span>
          <span className={`metric-value ${styles.kpiValueTeal}`}>
            {observation.independent_nmad !== null && observation.independent_nmad !== undefined
              ? `${observation.independent_nmad.toFixed(2)} ${units}`
              : 'N/A'}
          </span>
          <span className={styles.evidenceSubnote}>
            MAD: {observation.independent_mad?.toFixed(2) ?? 'N/A'}
          </span>
        </div>
      </div>

      <div className={styles.formulaBar}>
        <span>
          <strong className={styles.formulaStrong}>Signed Formulation: </strong>
          <code className={styles.formulaCode}>M = (xᵢ - x̃₋ᵢ) / NMAD₋ᵢ</code> where{' '}
          <code className={styles.formulaPlainCode}>NMAD = 1.4826 × MAD</code>
        </span>
        <span className={styles.formulaLegend}>
          Spike: M ≥ +3.5 • Drop: M ≤ -3.5 • Absolute magnitude: |M| ≥ 3.5
        </span>
      </div>

      {isZeroMad && (
        <div className={`warning-item ${styles.zeroMadAlert}`}>
          <span aria-hidden="true" className={styles.zeroMadIcon}>
            ⚠️
          </span>
          <div>
            <strong>Scale Indeterminate (Zero-MAD):</strong>
            <p className={styles.zeroMadBody}>
              At least 50% of baseline observations have zero absolute deviation from the median (MAD = 0).
              Modified Z-score division by zero is suppressed to avoid numerical artifacts.
            </p>
          </div>
        </div>
      )}

      <div className={styles.subPanelsGrid}>
        <div className={styles.subPanel}>
          <div className={styles.subPanelHeader}>
            <span className={styles.subPanelTitle}>Rate-of-Change Screening</span>
            <span
              className={`badge badge-${observation.rate_of_change_status === 'EVALUATED' ? 'normal' : 'muted'} ${styles.kpiBadgeSmall}`}
            >
              {observation.rate_of_change_status || 'NOT_EVALUATED'}
            </span>
          </div>

          <div className={styles.subPanelList}>
            <div>
              Step difference (Δ):{' '}
              <strong className={styles.subPanelStrong}>
                {observation.step_change_from_prior !== null && observation.step_change_from_prior !== undefined
                  ? `${observation.step_change_from_prior > 0 ? '+' : ''}${observation.step_change_from_prior.toFixed(1)} ${units}`
                  : 'N/A (No adjacent prior observation within ≤90m)'}
              </strong>
            </div>

            <div>
              Surge classification:{' '}
              {observation.is_heuristic_step_surge ? (
                <span className={styles.subPanelSurge}>Provisional Step Surge Detected</span>
              ) : (
                <span className={styles.subPanelMuted}>Normal Hourly Transition</span>
              )}
            </div>

            {observation.rate_of_change_note && (
              <div className={styles.subPanelNote}>Note: {observation.rate_of_change_note}</div>
            )}
          </div>
        </div>

        <div className={styles.subPanel}>
          <div className={styles.subPanelHeader}>
            <span className={styles.subPanelTitle}>Sensor Invariance &amp; Diagnostics</span>
            <span
              className={`badge badge-${observation.suspected_flatline ? 'warning' : 'normal'} ${styles.kpiBadgeSmall}`}
            >
              {observation.suspected_flatline ? 'INVARIANT RUN' : 'DISPERSED'}
            </span>
          </div>

          <div className={styles.subPanelList}>
            <div>
              Status:{' '}
              <strong className={styles.subPanelStrong}>
                {observation.flatline_label || 'Normal dispersion'}
              </strong>
            </div>

            <div>
              Consecutive elevated hours:{' '}
              <strong className={styles.subPanelStrong}>
                {observation.consecutive_elevated_hours} hrs
              </strong>{' '}
              {observation.consecutive_elevated_hours >= 3 && (
                <span className={styles.sustainedHint}>(Sustained Episode)</span>
              )}
            </div>

            <div className={styles.provenanceRow}>
              <span>Precision provenance:</span>
              <span
                className={`badge badge-${
                  precisionProvenance === 'AUTHORITATIVE_METADATA'
                    ? 'normal'
                    : precisionProvenance === 'CALLER_SUPPLIED'
                    ? 'warning'
                    : 'muted'
                } ${styles.kpiBadgeSmall}`}
              >
                {precisionProvenance}
              </span>
              {sensorPrecision !== null && sensorPrecision !== undefined && (
                <span className={styles.subPanelMuted}>
                  ({sensorPrecision} {units})
                </span>
              )}
            </div>

            {precisionProvenance === 'UNKNOWN' && (
              <div className={styles.subPanelNote}>
                Sensor resolution is unknown. Invariance screening is cautious and does not diagnose physical hardware failure.
              </div>
            )}
            {precisionProvenance === 'CALLER_SUPPLIED' && (
              <div className={styles.subPanelNoteElevated}>
                Caller-supplied precision threshold is active for exploratory testing; not verified sensor metadata.
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={`${styles.decoupledBox} ${observation.is_cpcb_exceedance ? styles.decoupledBoxExceed : ''}`}
      >
        <strong className={styles.subPanelStrong}>Decoupled Assessment: </strong>
        {observation.is_cpcb_exceedance
          ? `Observation (${observation.observed_value} ${units}) exceeds the CPCB numerical benchmark for the applicable averaging-period standard.`
          : `Observation (${observation.observed_value} ${units}) remains within the CPCB numerical benchmark for the applicable averaging-period standard.`}{' '}
        Statistical anomaly screening evaluates relative deviation from baseline variance, which operates independently from statutory regulatory standards.
      </div>
    </div>
  );
};
