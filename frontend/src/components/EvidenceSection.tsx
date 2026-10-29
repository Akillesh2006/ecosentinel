import React from 'react';
import type { LocationDetail, LocationMeasurementsResponse, RiskAssessmentResponse, SectionId } from '../types';

interface EvidenceSectionProps {
  locationDetail: LocationDetail | null;
  measurementsData: LocationMeasurementsResponse | null;
  assessmentData?: RiskAssessmentResponse | null;
  onNavigate: (sectionId: SectionId) => void;
  hidden?: boolean;
}

export const EvidenceSection: React.FC<EvidenceSectionProps> = ({
  locationDetail,
  measurementsData,
  assessmentData,
  onNavigate,
  hidden,
}) => {
  return (
    <article
      id="panel-evidence"
      role="tabpanel"
      aria-labelledby="tab-evidence"
      hidden={hidden}
      style={{ display: hidden ? 'none' : undefined }}
    >
      <header className="section-header">
        <h2>Evidence & Data Quality Audit</h2>
        <p className="section-subtitle">
          Transparent metrics on observation density, missing data ratios, sensor provenance, and scientific
          representativeness for Indian monitoring stations.
        </p>
      </header>

      {/* Active Station Evidence Banner if loaded */}
      {measurementsData ? (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
          <h3 className="card-title">
            <span className="card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </span>
            Loaded Dataset Audit: {measurementsData.station_name} ({measurementsData.parameter_display_name})
          </h3>

          <div className="empty-state-meta-box" style={{ width: '100%', margin: '1rem 0' }}>
            <div className="meta-item">
              <span className="meta-label">Returned Observations</span>
              <span className="meta-val">{measurementsData.total_observations} points</span>
            </div>
            {Boolean(measurementsData.excluded_observations) && (
              <div className="meta-item">
                <span className="meta-label">Invalid / Negative Excluded</span>
                <span className="meta-val">{measurementsData.excluded_observations} points</span>
              </div>
            )}
            <div className="meta-item">
              <span className="meta-label">Expected Hourly Points</span>
              <span className="meta-val">{measurementsData.expected_observations || 'N/A'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Data Missingness</span>
              <span className="meta-val">
                {measurementsData.missing_percentage !== null && measurementsData.missing_percentage !== undefined
                  ? `${measurementsData.missing_percentage}% missing`
                  : measurementsData.total_observations === 0
                  ? '100% missing'
                  : '0% missing'}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Data Freshness</span>
              <span className="meta-val">
                {measurementsData.is_stale ? '⚠ Stale (> 24h old)' : '✓ Fresh'}
              </span>
            </div>
            {locationDetail && (
              <div className="meta-item">
                <span className="meta-label">Instrumentation</span>
                <span className="meta-val">
                  {locationDetail.instruments.length > 0
                    ? locationDetail.instruments.join(', ')
                    : locationDetail.is_monitor
                    ? 'Reference Monitor'
                    : 'Sensor Node'}
                </span>
              </div>
            )}
          </div>

          <div className="chart-disclaimer" style={{ marginBottom: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              <strong>Spatial Representativeness Principle:</strong> Observations represent physical sensor
              recordings at {measurementsData.station_name} ({measurementsData.locality || 'India'}).
              Monitoring stations are not equally distributed across cities, and readings at this single station
              do not represent an entire metropolitan area.
            </span>
          </div>
        </div>
      ) : null}

      {/* Milestone 3 Risk Assessment Screening Audit */}
      {assessmentData && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(59, 130, 246, 0.4)' }}>
          <h3 className="card-title">
            <span className="card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            Operational Risk Screening Audit: {assessmentData.parameter_display_name} ({assessmentData.averaging_period_label})
          </h3>
          <div className="empty-state-meta-box" style={{ width: '100%', margin: '1rem 0' }}>
            <div className="meta-item">
              <span className="meta-label">75% Completeness Gate</span>
              <span className="meta-val">
                {assessmentData.is_completeness_satisfied ? '✓ Satisfied' : '✗ Incomplete'} ({assessmentData.valid_observations}/{assessmentData.expected_observations} hours · {assessmentData.completeness_percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Invalid / Negative Excluded</span>
              <span className="meta-val">{assessmentData.excluded_observations} points</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Sensor Freshness</span>
              <span className="meta-val">{assessmentData.freshness_state.toUpperCase()}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Screening Classification</span>
              <span className="meta-val">{assessmentData.status_label}</span>
            </div>
          </div>
          <div className="chart-disclaimer" style={{ marginBottom: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              <strong>EcoSentinel Data Quality Rule:</strong> Rolling window comparisons require at least 75% valid hourly completeness (18/24 for 24h, 6/8 for 8h). If observations fall below this gate or are stale (&gt;24h), numerical averages and operational mitigation alerts are suppressed to prevent false alarms.
            </span>
          </div>
        </div>
      )}

      {!measurementsData && !assessmentData && (
        <div className="empty-state-box">
          <div className="empty-state-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h3 className="empty-state-title">No Investigation Currently Loaded</h3>
          <p className="empty-state-desc">
            To view evidence metrics and data completeness audits, select an Indian monitoring station in the
            Investigate section and retrieve measurements.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onNavigate('investigate')}
            style={{ marginTop: '0.75rem' }}
          >
            Go to Investigation
          </button>
        </div>
      )}

      {/* Audit Framework Principles Card */}
      <div className="card">
        <h3 className="card-title">
          <span className="card-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          EcoSentinel Data Quality & Evidence Framework
        </h3>
        <p>
          Environmental decisions require rigorous evaluation of data completeness and measurement veracity.
          EcoSentinel evaluates every query against four core evidentiary standards:
        </p>

        <div className="grid-2col" style={{ marginTop: '1.25rem' }}>
          <div className="card" style={{ background: 'var(--color-bg-surface)' }}>
            <h4 style={{ fontSize: '0.95rem', color: 'var(--color-accent-teal)', marginBottom: '0.5rem' }}>
              1. Bounded Completeness Audit
            </h4>
            <p style={{ fontSize: '0.85rem' }}>
              Missing data is computed explicitly based on the expected hourly observation frequency across the
              queried window. Gaps are never imputed with synthetic numbers.
            </p>
          </div>

          <div className="card" style={{ background: 'var(--color-bg-surface)' }}>
            <h4 style={{ fontSize: '0.95rem', color: 'var(--color-accent-teal)', marginBottom: '0.5rem' }}>
              2. 24-Hour Staleness Rule
            </h4>
            <p style={{ fontSize: '0.85rem' }}>
              If a station has not transmitted a valid observation within the last 24 hours, it is prominently
              flagged with a freshness notice to avoid confusing historical baselines with real-time conditions.
            </p>
          </div>

          <div className="card" style={{ background: 'var(--color-bg-surface)' }}>
            <h4 style={{ fontSize: '0.95rem', color: 'var(--color-accent-teal)', marginBottom: '0.5rem' }}>
              3. Spatial Non-Generalizability
            </h4>
            <p style={{ fontSize: '0.85rem' }}>
              Air pollution exhibits high hyper-local variation. A single sensor near a traffic artery or
              industrial cluster does not describe the air quality of a multi-million-resident metropolis.
            </p>
          </div>

          <div className="card" style={{ background: 'var(--color-bg-surface)' }}>
            <h4 style={{ fontSize: '0.95rem', color: 'var(--color-accent-teal)', marginBottom: '0.5rem' }}>
              4. Provenance & Licensing Integrity
            </h4>
            <p style={{ fontSize: '0.85rem' }}>
              Station ownership, certified monitoring status, and data provider origins are preserved and
              transparently attributed without obfuscation.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
};
