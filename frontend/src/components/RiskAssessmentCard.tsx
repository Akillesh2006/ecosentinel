import React, { useState } from 'react';
import type { AirQualityApiError, RiskAssessmentResponse } from '../types';

interface RiskAssessmentCardProps {
  assessment: RiskAssessmentResponse | null;
  isLoading: boolean;
  error: AirQualityApiError | null;
  onRetry?: () => void;
}

export const RiskAssessmentCard: React.FC<RiskAssessmentCardProps> = ({
  assessment,
  isLoading,
  error,
  onRetry,
}) => {
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="risk-card" role="region" aria-label="Operational Risk Assessment" aria-busy="true">
        <div className="loading-state-box" style={{ margin: 0, padding: '1.5rem' }}>
          <div className="spinner" aria-hidden="true" />
          <p>Evaluating physical observations against statutory CPCB NAAQS standards...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="risk-card" role="region" aria-label="Operational Risk Assessment">
        <div className="error-alert-box" style={{ margin: 0 }}>
          <div className="error-alert-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Assessment Error ({error.error_code})
          </div>
          <p>{error.message}</p>
          {onRetry && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onRetry}
              style={{ marginTop: '0.5rem', alignSelf: 'flex-start' }}
            >
              Retry Assessment
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!assessment) {
    return null;
  }

  const {
    status,
    status_label,
    parameter_display_name,
    station_name,
    units,
    calculated_average,
    standard_name,
    standard_threshold,
    standard_unit,
    averaging_period_label,
    valid_observations,
    expected_observations,
    missing_observations,
    completeness_percentage,
    is_completeness_satisfied,
    sensor_datetime_last_local,
    sensor_datetime_last_utc,
    freshness_state,
    freshness_message,
    ratio_to_standard,
    screening_limitations,
    secondary_benchmark_name,
    secondary_benchmark_threshold,
    secondary_benchmark_unit,
    secondary_benchmark_notes,
    data_quality_warnings,
    advisories,
    regulatory_disclaimer,
    spatial_disclaimer,
  } = assessment;

  // Determine visual styling modifier
  let cardClass = 'risk-card';
  let badgeClass = 'risk-status-badge';
  if (status === 'above_reference') {
    cardClass += ' risk-card-above';
    badgeClass += ' risk-badge-above';
  } else if (status === 'below_reference') {
    cardClass += ' risk-card-below';
    badgeClass += ' risk-badge-below';
  } else if (status === 'insufficient_data') {
    cardClass += ' risk-card-insufficient';
    badgeClass += ' risk-badge-insufficient';
  } else if (status === 'stale_data') {
    cardClass += ' risk-card-stale';
    badgeClass += ' risk-badge-stale';
  } else if (status === 'historical_data') {
    cardClass += ' risk-card-historical';
    badgeClass += ' risk-badge-historical';
  } else {
    badgeClass += ' risk-badge-unavailable';
  }

  const handleCopyChecklist = () => {
    if (!advisories || advisories.length === 0) return;

    const lines: string[] = [
      `EcoSentinel Operational Mitigation Checklist`,
      `Station: ${station_name} | Parameter: ${parameter_display_name}`,
      `Screening Status: ${status_label} (${ratio_to_standard ? `${ratio_to_standard}x reference limit` : ''})`,
      `Standard Reference: ${standard_name || 'CPCB NAAQS'} (${averaging_period_label}: ${standard_threshold} ${standard_unit})`,
      `Data Completeness: ${valid_observations}/${expected_observations} observations (${completeness_percentage}%)`,
      `Timestamp: ${sensor_datetime_last_local || sensor_datetime_last_utc || 'N/A'}`,
      ``,
      `--- Action Items ---`,
    ];

    advisories.forEach((adv, i) => {
      lines.push(`${i + 1}. [${adv.category.toUpperCase()}] ${adv.action}`);
      lines.push(`   Rationale: ${adv.rationale}`);
      lines.push(`   Uncertainty: ${adv.uncertainty}`);
      lines.push(``);
    });

    lines.push(`--- Caveats & Disclaimers ---`);
    lines.push(`* ${regulatory_disclaimer}`);
    lines.push(`* ${spatial_disclaimer}`);

    const text = lines.join('\n');
    if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        const promise = navigator.clipboard.writeText(text);
        if (promise && typeof promise.then === 'function') {
          promise
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            })
            .catch(() => {
              // Silently handle clipboard rejection in unprivileged environments
            });
        }
      } catch {
        // Silently handle synchronous clipboard errors
      }
    }
  };

  return (
    <div className={cardClass} role="region" aria-label="Operational Risk Assessment">
      {/* Header Row */}
      <div className="risk-card-header">
        <div className="risk-card-title-group">
          <div className="risk-card-heading">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Operational Risk Screening: {parameter_display_name}
          </div>
          <div className="risk-card-subheading">
            Location: <strong>{station_name}</strong> · Evaluated against statutory <strong>{standard_name || 'CPCB NAAQS'}</strong> ({averaging_period_label})
          </div>
        </div>

        <div className={badgeClass} aria-live="polite">
          <span className="pill-dot" aria-hidden="true" />
          <span>{status_label}</span>
        </div>
      </div>

      {/* Freshness Banner if not fresh */}
      {freshness_state !== 'fresh' && (
        <div className="warning-item" role="status">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>
            <strong>Data Freshness Notice:</strong> {freshness_message} Operational mitigation alerts are suppressed for non-current data streams.
          </span>
        </div>
      )}

      {/* Data Quality Warnings */}
      {Boolean(data_quality_warnings && data_quality_warnings.length > 0) && (
        <div className="warning-item" role="status">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            {data_quality_warnings.map((warn, idx) => (
              <div key={idx}>{warn}</div>
            ))}
          </div>
        </div>
      )}

      {/* Quantitative Screening Metrics Grid */}
      <div className="risk-grid">
        <div className="risk-grid-cell">
          <span className="risk-cell-label">Calculated {averaging_period_label} Mean</span>
          <span className="risk-cell-val font-mono">
            {calculated_average !== null && calculated_average !== undefined
              ? `${calculated_average} ${units}`
              : 'N/A'}
          </span>
          <span className="risk-cell-sub">
            {calculated_average !== null && calculated_average !== undefined
              ? ratio_to_standard
                ? `${ratio_to_standard}x reference limit`
                : 'Evaluated'
              : !is_completeness_satisfied
              ? 'Completeness gate failed (< 75%)'
              : 'Calculation unavailable'}
          </span>
        </div>

        <div className="risk-grid-cell">
          <span className="risk-cell-label">Statutory Reference (CPCB)</span>
          <span className="risk-cell-val font-mono">
            {standard_threshold !== null && standard_threshold !== undefined
              ? `${standard_threshold} ${standard_unit}`
              : 'N/A'}
          </span>
          <span className="risk-cell-sub">{standard_name} ({averaging_period_label})</span>
        </div>

        <div className="risk-grid-cell">
          <span className="risk-cell-label">Hourly Data Completeness</span>
          <span className="risk-cell-val font-mono">
            {completeness_percentage.toFixed(1)}%
          </span>
          <span className="risk-cell-sub">
            {valid_observations} / {expected_observations} hours ({missing_observations} missing)
          </span>
        </div>

        <div className="risk-grid-cell">
          <span className="risk-cell-label">Secondary Health Guideline</span>
          <span className="risk-cell-val font-mono">
            {secondary_benchmark_threshold !== null && secondary_benchmark_threshold !== undefined
              ? `${secondary_benchmark_threshold} ${secondary_benchmark_unit}`
              : secondary_benchmark_notes
              ? 'Non-comparable'
              : 'None configured'}
          </span>
          <span className="risk-cell-sub">
            {secondary_benchmark_name || 'WHO Guidelines'}
          </span>
        </div>
      </div>

      {/* Screening Limitations Explanation */}
      <div className="chart-disclaimer" style={{ marginBottom: '1rem' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>
          <strong>Evidence Basis:</strong> {screening_limitations}
        </span>
      </div>

      {/* Practical Mitigation Advisories Section (Rendered when above reference and fresh) */}
      {advisories && advisories.length > 0 && (
        <div className="risk-advisories-container">
          <div className="risk-advisories-header">
            <div className="risk-advisories-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Operational Mitigation Protocols ({advisories.length} Evidence-Backed Actions)
            </div>

            <button
              type="button"
              className={`checklist-copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopyChecklist}
              aria-label="Copy action checklist to clipboard"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                {copied ? (
                  <polyline points="20 6 9 17 4 12" />
                ) : (
                  <>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </>
                )}
              </svg>
              <span>{copied ? 'Checklist Copied!' : 'Copy Action Checklist'}</span>
            </button>
          </div>

          <div className="advisories-list">
            {advisories.map((adv, index) => (
              <div key={index} className="advisory-item-card">
                <div className="advisory-header-row">
                  <span className="advisory-category-pill">{adv.category}</span>
                </div>
                <div className="advisory-action-text">{adv.action}</div>
                <div className="advisory-detail-text">
                  <strong>Operational Rationale:</strong> {adv.rationale}
                </div>
                <div className="advisory-uncertainty-text">
                  <strong>Uncertainty & Attribution:</strong> {adv.uncertainty}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimers & Limitations */}
      <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.75rem', fontSize: '0.775rem', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
        <p style={{ marginBottom: '0.35rem' }}>
          <strong>Statutory Compliance Boundary:</strong> {regulatory_disclaimer}
        </p>
        <p>
          <strong>Spatial Boundary:</strong> {spatial_disclaimer}
        </p>
      </div>
    </div>
  );
};
