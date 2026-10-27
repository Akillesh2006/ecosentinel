import React from 'react';
import type { LocationDetail, LocationMeasurementsResponse, SectionId } from '../types';

interface ReportsSectionProps {
  locationDetail: LocationDetail | null;
  measurementsData: LocationMeasurementsResponse | null;
  onNavigate: (sectionId: SectionId) => void;
}

export const ReportsSection: React.FC<ReportsSectionProps> = ({
  locationDetail,
  measurementsData,
  onNavigate,
}) => {
  // Compute basic descriptive statistics if measurements exist
  const stats = React.useMemo(() => {
    if (!measurementsData || measurementsData.measurements.length === 0) {
      return null;
    }
    const values = measurementsData.measurements.map((m) => m.value).sort((a, b) => a - b);
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
    <article id="panel-reports" role="tabpanel" aria-labelledby="tab-reports">
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

          {/* Honest milestone notice */}
          <div className="chart-disclaimer" style={{ marginBottom: '1.25rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              <strong>Milestone 2A Scope:</strong> This view generates a verified, client-side statistical summary
              of the currently retrieved observations. Automated anomaly detection scoring, historical baseline
              deviation models, and persistent report storage / PDF exports are deferred to Milestones 3 &amp; 4.
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
      ) : (
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
            To view an investigation summary dossier, select an Indian monitoring station and retrieve observations
            in the Investigate tab. Automated anomaly reports will be introduced in Milestone 4.
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

      {/* Report Structure Architecture */}
      <div className="card">
        <h3 className="card-title">
          <span className="card-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </span>
          Structure of an EcoSentinel Investigation Report
        </h3>
        <p>
          Every report produced by EcoSentinel follows an explainable, standardized structure designed
          for environmental scientists, analysts, and community stakeholders:
        </p>
        <ul className="checklist">
          <li className="checklist-item">
            <span className="checklist-icon-done">1.</span>
            <span>
              <strong>Finding Summary:</strong> Clear identification of parameter, station, and time range.
            </span>
          </li>
          <li className="checklist-item">
            <span className="checklist-icon-done">2.</span>
            <span>
              <strong>Baseline Deviation:</strong> Quantitative comparison with historical seasonal and diurnal expectations (Milestone 3).
            </span>
          </li>
          <li className="checklist-item">
            <span className="checklist-icon-done">3.</span>
            <span>
              <strong>Empirical Evidence:</strong> Observation counts, distribution percentiles, and multi-sensor consistency.
            </span>
          </li>
          <li className="checklist-item">
            <span className="checklist-icon-done">4.</span>
            <span>
              <strong>Data Limitations &amp; Caveats:</strong> Explicit disclosure of missing hours, meteorological confounders (e.g. thermal inversions), and sensor precision limits.
            </span>
          </li>
          <li className="checklist-item">
            <span className="checklist-icon-done">5.</span>
            <span>
              <strong>Actionable Guidance:</strong> Suggested follow-up checks (e.g., sensor recalibration, inspection of local activity logs).
            </span>
          </li>
        </ul>
      </div>
    </article>
  );
};
