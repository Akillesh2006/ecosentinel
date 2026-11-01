import React from 'react';
import type { AnomalyObservationPoint, PrecisionProvenance } from '../types';

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
      <div className="card anomaly-evidence-card empty-evidence" style={{ padding: '1.5rem', textAlign: 'center' }}>
        <div style={{ color: 'var(--eco-text-muted)', fontSize: '0.875rem' }}>
          Select an observation point on the timeline to inspect mathematical evidence, leave-one-out baseline metrics, and rate-of-change diagnostics.
        </div>
      </div>
    );
  }

  const isZeroMad = observation.scale_state === 'INDETERMINATE_ZERO_MAD';
  const modZ = observation.modified_z_score;

  // Formatting timestamps
  const localTime = observation.datetime_local || 'Local time not reported';
  const utcTime = observation.datetime_utc;

  return (
    <div className="card anomaly-evidence-card" aria-label="Observation Evidence Detail">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <div>
          <span className="card-badge" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Empirical Evidence Dossier
          </span>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--eco-text-primary)', marginTop: '0.25rem' }}>
            Observation Analysis &amp; Baseline Metrics
          </h3>
          <div style={{ fontSize: '0.775rem', color: 'var(--eco-text-muted)', marginTop: '0.15rem' }}>
            Local: {localTime} • UTC: {new Date(utcTime).toUTCString()}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span
            className={`badge badge-${
              observation.anomaly_type === 'STATISTICAL_SPIKE'
                ? 'anomaly'
                : observation.anomaly_type === 'STATISTICAL_DROP'
                ? 'info'
                : observation.anomaly_type === 'MODERATE_ELEVATION'
                ? 'warning'
                : 'normal'
            }`}
            style={{ fontWeight: 600, padding: '0.3rem 0.65rem' }}
          >
            {observation.anomaly_type || 'NORMAL'}
          </span>
          {observation.is_cpcb_exceedance && (
            <span
              className="badge badge-anomaly"
              style={{ fontWeight: 600, padding: '0.3rem 0.65rem', background: 'transparent', border: '1px dashed var(--eco-status-anomaly)' }}
            >
              CPCB Exceedance
            </span>
          )}
        </div>
      </div>

      {/* Main Observed Metric Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.85rem',
          padding: '0.85rem',
          background: 'var(--eco-bg-card-subtle)',
          borderRadius: 'var(--eco-radius-md)',
          marginBottom: '1rem',
          border: '1px solid var(--eco-border-subtle)',
        }}
      >
        <div className="metric-cell">
          <span className="metric-label">Observed {parameterDisplayName}</span>
          <span className="metric-value" style={{ color: 'var(--eco-text-primary)' }}>
            {observation.observed_value}{' '}
            <span style={{ fontSize: '0.8rem', color: 'var(--eco-text-muted)' }}>{units}</span>
          </span>
        </div>

        <div className="metric-cell">
          <span className="metric-label">Modified Z-Score (M)</span>
          {isZeroMad ? (
            <span className="metric-value" style={{ fontSize: '0.9rem', color: 'var(--eco-status-elevated)' }}>
              Indeterminate
            </span>
          ) : modZ !== null && modZ !== undefined ? (
            <span
              className="metric-value"
              style={{
                color:
                  Math.abs(modZ) >= 3.5
                    ? 'var(--eco-status-anomaly)'
                    : Math.abs(modZ) >= 2.5
                    ? 'var(--eco-status-elevated)'
                    : 'var(--eco-status-normal)',
              }}
            >
              {modZ > 0 ? '+' : ''}
              {modZ.toFixed(2)} M
            </span>
          ) : (
            <span className="metric-value" style={{ color: 'var(--eco-text-muted)', fontSize: '0.9rem' }}>
              N/A
            </span>
          )}
          <span style={{ fontSize: '0.725rem', color: 'var(--eco-text-muted)' }}>
            Absolute threshold: |M| ≥ 3.5
          </span>
        </div>

        <div className="metric-cell">
          <span className="metric-label">Leave-One-Out Median</span>
          <span className="metric-value" style={{ color: 'var(--eco-teal)' }}>
            {observation.independent_median !== null && observation.independent_median !== undefined
              ? `${observation.independent_median.toFixed(1)} ${units}`
              : 'N/A'}
          </span>
          <span style={{ fontSize: '0.725rem', color: 'var(--eco-text-muted)' }}>
            Excludes evaluated point
          </span>
        </div>

        <div className="metric-cell">
          <span className="metric-label">Normalized MAD (NMAD)</span>
          <span className="metric-value" style={{ color: 'var(--eco-teal)' }}>
            {observation.independent_nmad !== null && observation.independent_nmad !== undefined
              ? `${observation.independent_nmad.toFixed(2)} ${units}`
              : 'N/A'}
          </span>
          <span style={{ fontSize: '0.725rem', color: 'var(--eco-text-muted)' }}>
            MAD: {observation.independent_mad?.toFixed(2) ?? 'N/A'}
          </span>
        </div>
      </div>

      {/* Signed Modified Z-score Mathematical Formulation */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem 0.85rem',
          background: 'var(--eco-bg-input)',
          borderRadius: 'var(--eco-radius-sm)',
          border: '1px solid var(--eco-border-subtle)',
          fontSize: '0.75rem',
          color: 'var(--eco-text-secondary)',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.35rem',
        }}
      >
        <span>
          <strong style={{ color: 'var(--eco-text-primary)' }}>Signed Formulation: </strong>
          <code style={{ fontFamily: 'var(--eco-font-mono)', color: 'var(--eco-teal)' }}>
            M = (xᵢ - x̃₋ᵢ) / NMAD₋ᵢ
          </code>{' '}
          where <code style={{ fontFamily: 'var(--eco-font-mono)' }}>NMAD = 1.4826 × MAD</code>
        </span>
        <span style={{ color: 'var(--eco-text-muted)', fontSize: '0.7rem' }}>
          Spike: M ≥ +3.5 • Drop: M ≤ -3.5 • Absolute magnitude: |M| ≥ 3.5
        </span>
      </div>

      {/* Zero MAD Explanation if applicable */}
      {isZeroMad && (
        <div
          className="warning-item"
          style={{
            background: 'var(--eco-status-elevated-bg)',
            borderColor: 'var(--eco-status-elevated-border)',
            marginBottom: '1rem',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: '1rem' }}>⚠️</span>
          <div>
            <strong>Scale Indeterminate (Zero-MAD):</strong>
            <p style={{ marginTop: '0.2rem', fontSize: '0.775rem' }}>
              At least 50% of baseline observations have zero absolute deviation from the median (MAD = 0).
              Modified Z-score division by zero is suppressed to avoid numerical artifacts.
            </p>
          </div>
        </div>
      )}

      {/* Analytical Detail Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {/* Rate of Change Screening */}
        <div
          style={{
            padding: '0.85rem',
            background: 'var(--eco-bg-input)',
            borderRadius: 'var(--eco-radius-md)',
            border: '1px solid var(--eco-border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--eco-text-primary)' }}>
              Rate-of-Change Screening
            </span>
            <span
              className={`badge badge-${observation.rate_of_change_status === 'EVALUATED' ? 'normal' : 'muted'}`}
              style={{ fontSize: '0.7rem' }}
            >
              {observation.rate_of_change_status || 'NOT_EVALUATED'}
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--eco-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div>
              Step difference (Δ):{' '}
              <strong style={{ color: 'var(--eco-text-primary)' }}>
                {observation.step_change_from_prior !== null && observation.step_change_from_prior !== undefined
                  ? `${observation.step_change_from_prior > 0 ? '+' : ''}${observation.step_change_from_prior.toFixed(1)} ${units}`
                  : 'N/A (No adjacent prior observation within ≤90m)'}
              </strong>
            </div>

            <div>
              Surge classification:{' '}
              {observation.is_heuristic_step_surge ? (
                <span style={{ color: 'var(--eco-status-anomaly)', fontWeight: 600 }}>
                  Provisional Step Surge Detected
                </span>
              ) : (
                <span style={{ color: 'var(--eco-text-muted)' }}>
                  Normal Hourly Transition
                </span>
              )}
            </div>

            {observation.rate_of_change_note && (
              <div style={{ fontSize: '0.725rem', color: 'var(--eco-text-muted)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                Note: {observation.rate_of_change_note}
              </div>
            )}
          </div>
        </div>

        {/* Invariance & Sensor Diagnostics */}
        <div
          style={{
            padding: '0.85rem',
            background: 'var(--eco-bg-input)',
            borderRadius: 'var(--eco-radius-md)',
            border: '1px solid var(--eco-border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--eco-text-primary)' }}>
              Sensor Invariance &amp; Diagnostics
            </span>
            <span
              className={`badge badge-${observation.suspected_flatline ? 'warning' : 'normal'}`}
              style={{ fontSize: '0.7rem' }}
            >
              {observation.suspected_flatline ? 'INVARIANT RUN' : 'DISPERSED'}
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--eco-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div>
              Status:{' '}
              <strong style={{ color: 'var(--eco-text-primary)' }}>
                {observation.flatline_label || 'Normal dispersion'}
              </strong>
            </div>

            <div>
              Consecutive elevated hours:{' '}
              <strong style={{ color: 'var(--eco-text-primary)' }}>
                {observation.consecutive_elevated_hours} hrs
              </strong>{' '}
              {observation.consecutive_elevated_hours >= 3 && (
                <span style={{ color: 'var(--eco-status-elevated)', fontSize: '0.725rem' }}>
                  (Sustained Episode)
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>Precision provenance:</span>
              <span
                className={`badge badge-${
                  precisionProvenance === 'AUTHORITATIVE_METADATA'
                    ? 'normal'
                    : precisionProvenance === 'CALLER_SUPPLIED'
                    ? 'warning'
                    : 'muted'
                }`}
                style={{ fontSize: '0.675rem' }}
              >
                {precisionProvenance}
              </span>
              {sensorPrecision !== null && sensorPrecision !== undefined && (
                <span style={{ fontSize: '0.725rem', color: 'var(--eco-text-muted)' }}>
                  ({sensorPrecision} {units})
                </span>
              )}
            </div>

            {precisionProvenance === 'UNKNOWN' && (
              <div style={{ fontSize: '0.725rem', color: 'var(--eco-text-muted)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                Sensor resolution is unknown. Invariance screening is cautious and does not diagnose physical hardware failure.
              </div>
            )}
            {precisionProvenance === 'CALLER_SUPPLIED' && (
              <div style={{ fontSize: '0.725rem', color: 'var(--eco-status-elevated)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                Caller-supplied precision threshold is active for exploratory testing; not verified sensor metadata.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CPCB Decoupling Clarification */}
      <div
        style={{
          marginTop: '1rem',
          padding: '0.65rem 0.85rem',
          background: 'var(--eco-bg-surface)',
          borderRadius: 'var(--eco-radius-sm)',
          borderLeft: `3px solid ${observation.is_cpcb_exceedance ? 'var(--eco-status-anomaly)' : 'var(--eco-teal)'}`,
          fontSize: '0.775rem',
          color: 'var(--eco-text-secondary)',
          lineHeight: 1.45,
        }}
      >
        <strong style={{ color: 'var(--eco-text-primary)' }}>Decoupled Assessment: </strong>
        {observation.is_cpcb_exceedance
          ? `Observation (${observation.observed_value} ${units}) breaches statutory CPCB 24-hour limits.`
          : `Observation (${observation.observed_value} ${units}) remains within statutory CPCB 24-hour limits.`}{' '}
        Statistical anomaly screening evaluates relative deviation from baseline variance, which operates independently from statutory regulatory standards.
      </div>
    </div>
  );
};
