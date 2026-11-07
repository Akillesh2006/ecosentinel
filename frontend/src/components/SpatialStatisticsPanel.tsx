import React from 'react';
import type {
  ComparisonTimeSlice,
  StationComparisonMetadata,
  StationPartialFailure,
} from '../types';

interface SpatialStatisticsPanelProps {
  referenceStationId: number;
  stations: StationComparisonMetadata[];
  timeSlices: ComparisonTimeSlice[];
  parameterDisplayName: string;
  units: string;
  totalStationsRequested: number;
  totalValidStations: number;
  allStationsCoincidentHours: number;
  allStationsCoincidentCoveragePercentage?: number | null;
  mixedProviders: boolean;
  partialFailures: StationPartialFailure[];
  dataQualityWarnings: string[];
}

export const SpatialStatisticsPanel: React.FC<SpatialStatisticsPanelProps> = ({
  referenceStationId,
  stations,
  timeSlices,
  parameterDisplayName,
  units,
  totalStationsRequested,
  totalValidStations,
  allStationsCoincidentHours,
  allStationsCoincidentCoveragePercentage,
  mixedProviders,
  partialFailures,
  dataQualityWarnings,
}) => {
  const referenceStation = stations.find((s) => s.is_reference || s.location_id === referenceStationId);

  // Find the latest time slice with valid neighborhood statistics
  const latestMultiSlice = [...timeSlices]
    .reverse()
    .find((s) => typeof s.neighborhood_median === 'number' && s.contributing_stations >= 2);

  const formatValue = (val?: number | null, decimals: number = 1): string => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return val.toFixed(decimals);
  };

  const formatSnapshotTime = (isoUtc?: string | null, localIso?: string | null): string => {
    if (isoUtc) {
      try {
        const d = new Date(isoUtc);
        return (
          d.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }) + ' IST'
        );
      } catch {
        // Fallback
      }
    }
    if (localIso) return localIso;
    return '—';
  };

  return (
    <div className="spatial-statistics-panel" aria-label="Spatial Comparison Network Summary">
      {/* Partial Failures Warning Banner */}
      {partialFailures && partialFailures.length > 0 && (
        <div
          className="card card-warning"
          style={{
            marginBottom: '1rem',
            padding: '1rem',
            borderLeft: '4px solid var(--eco-status-elevated)',
            background: 'var(--eco-status-elevated-bg)',
          }}
          role="alert"
          aria-label="Station Comparison Partial Failures"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--eco-status-elevated)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>{partialFailures.length} Station(s) Excluded from Comparison</span>
          </div>
          <ul style={{ margin: '0.5rem 0 0 1.5rem', fontSize: '0.85rem', color: 'var(--eco-text-primary)' }}>
            {partialFailures.map((pf) => (
              <li key={pf.location_id}>
                <strong>Station ID {pf.location_id}</strong>: [{pf.error_code}] {pf.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Data Quality Warnings */}
      {dataQualityWarnings && dataQualityWarnings.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            borderLeft: '4px solid var(--eco-status-info)',
            background: 'var(--eco-status-info-bg)',
            fontSize: '0.85rem',
          }}
          role="status"
        >
          <div style={{ fontWeight: 600, color: 'var(--eco-status-info)', marginBottom: '0.25rem' }}>
            Data Quality Notice
          </div>
          {dataQualityWarnings.map((w, i) => (
            <div key={i} style={{ color: 'var(--eco-text-primary)' }}>• {w}</div>
          ))}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div
        className="kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* KPI 1: Reference Station */}
        <div className="card kpi-card">
          <div className="kpi-label">Reference Anchor</div>
          <div className="kpi-value" style={{ fontSize: '1.1rem', wordBreak: 'break-word', color: 'var(--eco-teal)' }}>
            {referenceStation?.station_name || `Station #${referenceStationId}`}
          </div>
          <div className="kpi-meta">
            {referenceStation?.provider_name || 'Provider unverified'}
            {referenceStation?.locality ? ` • ${referenceStation.locality}` : ''}
          </div>
        </div>

        {/* KPI 2: Network Ensemble Size */}
        <div className="card kpi-card">
          <div className="kpi-label">Comparison Ensemble</div>
          <div className="kpi-value">
            {totalValidStations} <span style={{ fontSize: '0.9rem', color: 'var(--eco-text-muted)' }}>/ {totalStationsRequested} requested</span>
          </div>
          <div className="kpi-meta">
            1 reference + {Math.max(0, totalValidStations - 1)} neighbors (Max 5)
          </div>
        </div>

        {/* KPI 3: Coincident Hours & All-Station Coverage */}
        <div className="card kpi-card">
          <div className="kpi-label">All-Stations Coincident</div>
          <div className="kpi-value">
            {allStationsCoincidentHours}{' '}
            <span style={{ fontSize: '0.9rem', color: 'var(--eco-text-muted)' }}>hrs</span>
          </div>
          <div className="kpi-meta">
            {allStationsCoincidentCoveragePercentage !== null && allStationsCoincidentCoveragePercentage !== undefined
              ? `${allStationsCoincidentCoveragePercentage.toFixed(1)}% window coverage`
              : 'Window coverage: —'}
          </div>
        </div>

        {/* KPI 4: Provider Homogeneity */}
        <div className="card kpi-card">
          <div className="kpi-label">Data Provider Network</div>
          <div className="kpi-value" style={{ fontSize: '1rem' }}>
            {mixedProviders ? (
              <span className="badge badge-warning" style={{ fontSize: '0.8rem' }}>
                Mixed Providers
              </span>
            ) : (
              <span className="badge badge-normal" style={{ fontSize: '0.8rem' }}>
                Uniform Provider
              </span>
            )}
          </div>
          <div className="kpi-meta" style={{ marginTop: '0.25rem' }}>
            {mixedProviders
              ? 'Multi-agency network: instrument or calibration differences may exist'
              : 'Single provider across all participating stations'}
          </div>
        </div>
      </div>

      {/* Latest Neighborhood Distribution Stats */}
      {latestMultiSlice && (
        <div className="card neighborhood-stats-card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="card-badge">Latest Coincident Snapshot</span>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--eco-text-primary)', margin: 0 }}>
                Neighborhood Distribution ({parameterDisplayName})
              </h4>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--eco-text-muted)' }}>
              {formatSnapshotTime(latestMultiSlice.datetime_utc, latestMultiSlice.datetime_local)} • {latestMultiSlice.contributing_stations} stations contributing
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
            <div style={{ background: 'var(--eco-bg-card-subtle)', padding: '0.5rem 0.75rem', borderRadius: 'var(--eco-radius-md)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--eco-text-muted)', textTransform: 'uppercase' }}>Median</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--eco-text-primary)' }}>
                {formatValue(latestMultiSlice.neighborhood_median)} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--eco-text-muted)' }}>{units}</span>
              </div>
            </div>

            <div style={{ background: 'var(--eco-bg-card-subtle)', padding: '0.5rem 0.75rem', borderRadius: 'var(--eco-radius-md)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--eco-text-muted)', textTransform: 'uppercase' }}>IQR (Q3 - Q1)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--eco-text-primary)' }}>
                {formatValue(latestMultiSlice.neighborhood_iqr)} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--eco-text-muted)' }}>{units}</span>
              </div>
            </div>

            <div style={{ background: 'var(--eco-bg-card-subtle)', padding: '0.5rem 0.75rem', borderRadius: 'var(--eco-radius-md)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--eco-text-muted)', textTransform: 'uppercase' }}>Min Obs</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--eco-text-primary)' }}>
                {formatValue(latestMultiSlice.neighborhood_min)} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--eco-text-muted)' }}>{units}</span>
              </div>
            </div>

            <div style={{ background: 'var(--eco-bg-card-subtle)', padding: '0.5rem 0.75rem', borderRadius: 'var(--eco-radius-md)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--eco-text-muted)', textTransform: 'uppercase' }}>Max Obs</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--eco-text-primary)' }}>
                {formatValue(latestMultiSlice.neighborhood_max)} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--eco-text-muted)' }}>{units}</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--eco-text-muted)', fontStyle: 'italic' }}>
            Point observation notice: Neighborhood median and interquartile range (IQR) reflect concurrent point observations from active monitors at each hour, not a continuous airshed or regional dispersion surface.
          </div>
        </div>
      )}
    </div>
  );
};
