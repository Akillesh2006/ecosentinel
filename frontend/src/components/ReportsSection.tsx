import React from 'react';
import type { LocationDetail, LocationMeasurementsResponse, RiskAssessmentResponse, SectionId } from '../types';
import { EnvironmentalActionPlan } from './EnvironmentalActionPlan';

interface ReportsSectionProps {
  locationDetail: LocationDetail | null;
  measurementsData: LocationMeasurementsResponse | null;
  assessmentData?: RiskAssessmentResponse | null;
  onNavigate: (sectionId: SectionId) => void;
  hidden?: boolean;
}

export const ReportsSection: React.FC<ReportsSectionProps> = ({
  locationDetail,
  measurementsData,
  assessmentData,
  onNavigate,
  hidden,
}) => {
  // Compute basic descriptive statistics if measurements exist
  const stats = React.useMemo(() => {
    if (!measurementsData || measurementsData.measurements.length === 0) {
      return null;
    }
    const values = measurementsData.measurements
      .map((m) => m.value)
      .filter((v) => typeof v === 'number' && !isNaN(v) && v >= 0)
      .sort((a, b) => a - b);
    if (values.length === 0) return null;
    const sum = values.reduce((acc, v) => acc + v, 0);
    const mean = sum / values.length;
    const min = values[0];
    const max = values[values.length - 1];
    const mid = Math.floor(values.length / 2);
    const median = values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;

    return {
      count: values.length,
      min: min.toFixed(2),
      max: max.toFixed(2),
      mean: mean.toFixed(2),
      median: median.toFixed(2),
    };
  }, [measurementsData]);

  return (
    <article
      id="panel-reports"
      role="tabpanel"
      aria-labelledby="tab-reports"
      hidden={hidden}
      style={{ display: hidden ? 'none' : undefined }}
    >
      <header className="section-header">
        <h2>Investigation Reports & Summaries</h2>
        <p className="section-subtitle">
          Explainable, evidence-backed environmental intelligence summaries and active dataset dossiers.
        </p>
      </header>

      {/* Active dataset summary dossier if measurements are loaded */}
      {measurementsData && stats ? (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(59, 130, 246, 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <div className="station-badges">
                <span className="pill-tag pill-active">Client-Side Summary Dossier</span>
                <span className="pill-tag">{measurementsData.parameter_display_name}</span>
                <span className="pill-tag">Station #{measurementsData.location_id}</span>
              </div>
              <h3 className="card-title" style={{ marginTop: '0.5rem', fontSize: '1.3rem' }}>
                {measurementsData.station_name}
              </h3>
              <p style={{ margin: '0.25rem 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                Source: <strong>{measurementsData.provider_name}</strong> · Units: <strong>{measurementsData.units}</strong>
              </p>
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => onNavigate('investigate')}
            >
              Back to Investigation Chart
            </button>
          </div>

          {/* Descriptive Statistical Profile */}
          <div className="metrics-strip" style={{ marginBottom: '1.5rem' }}>
            <div className="metric-cell">
              <span className="metric-label">Observations</span>
              <span className="metric-value">{stats.count}</span>
            </div>
            <div className="metric-cell">
              <span className="metric-label">Mean Concentration</span>
              <span className="metric-value font-mono">{stats.mean} {measurementsData.units}</span>
            </div>
            <div className="metric-cell">
              <span className="metric-label">Median Concentration</span>
              <span className="metric-value font-mono">{stats.median} {measurementsData.units}</span>
            </div>
            <div className="metric-cell">
              <span className="metric-label">Observed Range (Min - Max)</span>
              <span className="metric-value font-mono">{stats.min} – {stats.max}</span>
            </div>
            <div className="metric-cell">
              <span className="metric-label">Data Completeness</span>
              <span className="metric-value">
                {measurementsData.total_observations === 0
                  ? '0.0%'
                  : measurementsData.missing_percentage !== null && measurementsData.missing_percentage !== undefined
                  ? `${(100 - measurementsData.missing_percentage).toFixed(1)}%`
                  : '100%'}
              </span>
            </div>
          </div>

          {/* Statistical Profile notice */}
          <div className="chart-disclaimer" style={{ marginBottom: '1.25rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              <strong>Milestone 2A Scope:</strong> This view generates a verified, client-side statistical summary
              of the currently retrieved observations. Physical observations are evaluated without data imputation or synthetic curve fitting.
            </span>
          </div>

          <div className="empty-state-meta-box" style={{ width: '100%' }}>
            <div className="meta-item">
              <span className="meta-label">Period Start</span>
              <span className="meta-val font-mono">{new Date(measurementsData.requested_from_utc).toLocaleString()}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Period End</span>
              <span className="meta-val font-mono">{new Date(measurementsData.requested_to_utc).toLocaleString()}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Latest Sensor Observation</span>
              <span className="meta-val font-mono">
                {measurementsData.sensor_datetime_last_local ||
                  (measurementsData.sensor_datetime_last_utc
                    ? new Date(measurementsData.sensor_datetime_last_utc).toUTCString()
                    : 'None recorded')}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Retrieved At</span>
              <span className="meta-val font-mono">{new Date(measurementsData.retrieved_at_utc).toISOString().replace('T', ' ').substring(0, 19)} UTC</span>
            </div>
            {locationDetail && locationDetail.coordinates && (
              <div className="meta-item">
                <span className="meta-label">Station Coordinates</span>
                <span className="meta-val font-mono">
                  {locationDetail.coordinates.latitude.toFixed(4)}°N, {locationDetail.coordinates.longitude.toFixed(4)}°E
                </span>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Operational / Retrospective Screening Dossier */}
      {assessmentData && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: assessmentData.status === 'historical_data' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(245, 158, 11, 0.4)' }}>
          <h3 className="card-title">
            <span className="card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </span>
            {assessmentData.status === 'historical_data'
              ? `Retrospective Environmental Evidence Dossier: ${assessmentData.parameter_display_name}`
              : `Operational Screening Dossier: ${assessmentData.parameter_display_name}`}
          </h3>
          <div className="empty-state-meta-box" style={{ width: '100%', margin: '1rem 0' }}>
            <div className="meta-item">
              <span className="meta-label">Standard Benchmark</span>
              <span className="meta-val">{assessmentData.standard_name || 'CPCB NAAQS'} ({assessmentData.averaging_period_label})</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Reference Threshold</span>
              <span className="meta-val">{assessmentData.standard_threshold !== null && assessmentData.standard_threshold !== undefined ? `${assessmentData.standard_threshold} ${assessmentData.standard_unit || assessmentData.units}` : 'N/A'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Screening Assessment</span>
              <span className="meta-val">{assessmentData.status_label}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Calculated Window Mean</span>
              <span className="meta-val">
                {assessmentData.calculated_average !== null && assessmentData.calculated_average !== undefined ? `${assessmentData.calculated_average.toFixed(2)} ${assessmentData.units}` : 'None (Insufficient completeness)'}
              </span>
            </div>
          </div>
          <div className="chart-disclaimer" style={{ marginBottom: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              <strong>Scientific &amp; Regulatory Distinction:</strong> Operational screening against a rolling window serves as local facility decision support and does not constitute a formal statutory regulatory compliance determination under the Air (Prevention and Control of Pollution) Act, 1981.
            </span>
          </div>
        </div>
      )}

      {/* Milestone 5 Facility Environmental Action Plan & Abatement Dossier */}
      <EnvironmentalActionPlan
        locationDetail={locationDetail}
        measurementsData={measurementsData}
        assessmentData={assessmentData}
      />

      {!measurementsData && !assessmentData && (
        /* Empty State */
        <div className="empty-state-box">
          <div className="empty-state-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <h3 className="empty-state-title">No Active Investigation Loaded</h3>
          <p className="empty-state-desc">
            To view an investigation summary dossier and facility environmental action plan, select an Indian monitoring station and retrieve observations in the Investigate tab.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onNavigate('investigate')}
            style={{ marginTop: '0.75rem' }}
          >
            Launch Air Quality Investigation
          </button>
        </div>
      )}

      {/* Five-Part Dossier Framework Architecture */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 className="card-title">
          <span className="card-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </span>
          Five-Part Environmental Action &amp; Evidence Dossier Architecture
        </h3>
        <p>
          Every dossier generated by EcoSentinel follows a transparent, evidence-first framework designed
          for facility supervisors, environmental health &amp; safety (EHS) officers, and community stakeholders:
        </p>
        <ul className="checklist">
          <li className="checklist-item">
            <span className="checklist-icon-done">Part A.</span>
            <span>
              <strong>Verified Ambient Evidence:</strong> Station metadata, pollutant identification, calculated rolling average, and statutory CPCB NAAQS / WHO benchmark comparisons.
            </span>
          </li>
          <li className="checklist-item">
            <span className="checklist-icon-done">Part B.</span>
            <span>
              <strong>Data Integrity &amp; Provenance:</strong> Hourly observation count, 75% completeness gate verification, discarded negative artifacts, and sensor freshness state.
            </span>
          </li>
          <li className="checklist-item">
            <span className="checklist-icon-done">Part C.</span>
            <span>
              <strong>Operational Mitigation Protocols:</strong> Verified facility checklists (fleet anti-idling, air intake maintenance, municipal GRAP alignment, and supportive dust controls).
            </span>
          </li>
          <li className="checklist-item">
            <span className="checklist-icon-done">Part D.</span>
            <span>
              <strong>Quantified Potential Abatement:</strong> Canonical engineering estimates (fuel, CO₂, NOₓ, PM2.5) derived from CRRI and US EPA factors, plus empirical dust watering efficiency (50%–70% AP-42 §13.2.2).
            </span>
          </li>
          <li className="checklist-item">
            <span className="checklist-icon-done">Part E.</span>
            <span>
              <strong>Statutory &amp; Atmospheric Caveats:</strong> Non-compliance certificate disclosure, planetary boundary layer separation between localized curtailment and distant monitors, and fleet technology limitations.
            </span>
          </li>
        </ul>
      </div>
    </article>
  );
};
