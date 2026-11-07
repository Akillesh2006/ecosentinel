import React from 'react';
import type { StationComparisonMetadata } from '../types';

interface SpatialEvidenceTableProps {
  stations: StationComparisonMetadata[];
  parameterDisplayName: string;
  units: string;
  allStationsCoincidentHours?: number;
  allStationsCoincidentCoveragePercentage?: number | null;
  expectedObservations?: number;
}

export const SpatialEvidenceTable: React.FC<SpatialEvidenceTableProps> = ({
  stations,
  parameterDisplayName,
  units,
  allStationsCoincidentHours,
  allStationsCoincidentCoveragePercentage,
  expectedObservations,
}) => {
  if (!stations || stations.length === 0) {
    return null;
  }

  const formatPercentage = (val?: number | null): string => {
    if (val === null || val === undefined || isNaN(val)) {
      return '—';
    }
    return `${val.toFixed(1)}%`;
  };

  const formatCorrelation = (st: StationComparisonMetadata) => {
    if (st.is_reference) {
      return (
        <span className="badge badge-normal" title="Self-correlation of reference station baseline">
          1.000 (Reference)
        </span>
      );
    }

    if (st.correlation_status === 'REFERENCE_STATION') {
      return (
        <span className="badge badge-normal" title="Reference station baseline">
          1.000 (Reference)
        </span>
      );
    }

    if (st.correlation_status === 'INSUFFICIENT_COINCIDENT_DATA') {
      return (
        <span
          className="badge badge-warning"
          title={`Requires at least ${st.min_correlation_samples_threshold} coincident valid observation hours (Current: ${st.coincident_with_reference_hours})`}
        >
          &lt;{st.min_correlation_samples_threshold} Coincident Hrs (N={st.coincident_with_reference_hours})
        </span>
      );
    }

    if (st.correlation_status === 'ZERO_VARIANCE_CONSTANT_SERIES') {
      return (
        <span
          className="badge badge-muted"
          title="Zero sample variance detected in at least one station time-series (flatline observations)"
        >
          Constant Series (Zero Var)
        </span>
      );
    }

    if (st.pearson_correlation_with_reference !== null && st.pearson_correlation_with_reference !== undefined) {
      const r = st.pearson_correlation_with_reference;
      const sign = r > 0 ? '+' : '';
      const rFormatted = `${sign}${r.toFixed(3)}`;
      return (
        <div className="correlation-value-cell">
          <span className="correlation-r" style={{ fontWeight: 600, fontFamily: 'monospace' }}>
            r = {rFormatted}
          </span>
          <span className="correlation-meta" style={{ fontSize: '0.75rem', color: 'var(--eco-text-muted)', marginLeft: '0.5rem' }}>
            (N={st.coincident_with_reference_hours})
          </span>
        </div>
      );
    }

    // Unavailable / null fallback
    return (
      <span className="badge badge-muted" title="Correlation unavailable">
        — (Unavailable)
      </span>
    );
  };

  return (
    <div className="card spatial-evidence-table-card" aria-label="Spatial Comparison Evidence Table">
      <div className="card-header" style={{ marginBottom: '1rem' }}>
        <div>
          <span className="card-badge" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Station Alignment &amp; Coincident Quality Dossier
          </span>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--eco-text-primary)', marginTop: '0.25rem' }}>
            Multi-Station Observation Coverage &amp; Correlation Evidence
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--eco-text-muted)', marginTop: '0.25rem' }}>
            Evaluating {parameterDisplayName} ({units}) across {stations.length} monitoring stations.
            Coverage percentages are calculated against explicit mathematical denominators.
          </p>
        </div>
      </div>

      {allStationsCoincidentHours !== undefined && allStationsCoincidentCoveragePercentage !== undefined && (
        <div className="all-stations-coverage-banner" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.75rem 1rem',
          background: 'var(--eco-bg-card-subtle)',
          borderRadius: 'var(--eco-radius-md)',
          marginBottom: '1rem',
          border: '1px solid var(--eco-border-subtle)',
          fontSize: '0.85rem'
        }}>
          <div style={{ color: 'var(--eco-teal)', fontWeight: 600 }}>
            All-Stations Coincident Coverage:
          </div>
          <div style={{ color: 'var(--eco-text-primary)', fontWeight: 600 }}>
            {formatPercentage(allStationsCoincidentCoveragePercentage)}
          </div>
          <div style={{ color: 'var(--eco-text-muted)' }}>
            ({allStationsCoincidentHours} hours where ALL {stations.length} stations have valid observations out of {expectedObservations ?? '—'} expected hours)
          </div>
        </div>
      )}

      <div className="table-responsive">
        <table className="table spatial-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--eco-border-strong)', textAlign: 'left', fontSize: '0.8rem', color: 'var(--eco-text-muted)' }}>
              <th style={{ padding: '0.75rem 0.5rem' }}>Station &amp; Siting</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Provider &amp; Sensor</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>
                Distance
                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 'normal', color: 'var(--eco-text-muted)' }}>
                  Haversine (WGS-84)
                </span>
              </th>
              <th style={{ padding: '0.75rem 0.5rem' }}>
                Station Coverage
                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 'normal', color: 'var(--eco-text-muted)' }}>
                  valid / expected × 100
                </span>
              </th>
              <th style={{ padding: '0.75rem 0.5rem' }}>
                Pairwise Overlap
                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 'normal', color: 'var(--eco-text-muted)' }}>
                  coincident / expected × 100
                </span>
              </th>
              <th style={{ padding: '0.75rem 0.5rem' }}>
                Conditional Ref Coverage
                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 'normal', color: 'var(--eco-text-muted)' }}>
                  coincident / valid_ref × 100
                </span>
              </th>
              <th style={{ padding: '0.75rem 0.5rem' }}>
                Exploratory Correlation (r)
                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 'normal', color: 'var(--eco-text-muted)' }}>
                  Pearson (Threshold ≥ 6)
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {stations.map((st) => {
              const distanceDisplay = st.is_reference
                ? '0.0 km (Reference)'
                : st.distance_from_reference_km !== null && st.distance_from_reference_km !== undefined
                ? `${st.distance_from_reference_km.toFixed(1)} km`
                : '— (Missing Coords)';

              const coordsDisplay = st.coordinates
                ? `${st.coordinates.latitude.toFixed(4)}°, ${st.coordinates.longitude.toFixed(4)}°`
                : 'Coordinates unavailable';

              return (
                <tr
                  key={st.location_id}
                  style={{
                    borderBottom: '1px solid var(--eco-border-subtle)',
                    fontSize: '0.85rem',
                    backgroundColor: st.is_reference ? 'rgba(20, 184, 166, 0.04)' : undefined,
                  }}
                >
                  {/* Station & Siting */}
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ color: 'var(--eco-text-primary)' }}>{st.station_name}</strong>
                      {st.is_reference ? (
                        <span className="badge badge-normal" style={{ fontSize: '0.7rem' }}>Ref</span>
                      ) : (
                        <span className="badge badge-muted" style={{ fontSize: '0.7rem' }}>Neighbor</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--eco-text-muted)', marginTop: '0.15rem' }}>
                      ID: {st.location_id} {st.locality ? `• ${st.locality}` : ''}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--eco-text-muted)', marginTop: '0.1rem' }} title="WGS-84 Datum">
                      {coordsDisplay}
                    </div>
                  </td>

                  {/* Provider & Sensor */}
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <div style={{ color: 'var(--eco-text-primary)' }}>{st.provider_name}</div>
                    {st.owner_name && st.owner_name !== st.provider_name && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--eco-text-muted)' }}>
                        Owner: {st.owner_name}
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--eco-text-muted)', marginTop: '0.15rem' }}>
                      Sensor #{st.sensor_id} ({units})
                    </div>
                  </td>

                  {/* Distance */}
                  <td style={{ padding: '0.75rem 0.5rem', whiteSpace: 'nowrap' }}>
                    <span style={{ color: st.is_reference ? 'var(--eco-teal)' : 'var(--eco-text-primary)' }}>
                      {distanceDisplay}
                    </span>
                  </td>

                  {/* Station Coverage */}
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--eco-text-primary)' }}>
                      {formatPercentage(st.station_coverage_percentage ?? st.coverage_percentage)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--eco-text-muted)' }}>
                      {st.total_valid_observations} / {st.expected_observations} hrs
                    </div>
                  </td>

                  {/* Pairwise Overlap Coverage */}
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--eco-text-primary)' }}>
                      {formatPercentage(st.pairwise_overlap_coverage_percentage ?? st.coincident_coverage_percentage)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--eco-text-muted)' }}>
                      {st.coincident_with_reference_hours} / {st.expected_observations} hrs
                    </div>
                  </td>

                  {/* Conditional Reference Coverage */}
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--eco-text-primary)' }}>
                      {formatPercentage(st.conditional_reference_coverage_percentage)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--eco-text-muted)' }}>
                      {st.coincident_with_reference_hours} / {stations.find((s) => s.is_reference)?.total_valid_observations ?? '—'} ref hrs
                    </div>
                  </td>

                  {/* Pearson Correlation */}
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    {formatCorrelation(st)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Explanatory Footnotes */}
      <div className="table-footnotes" style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--eco-border-subtle)', fontSize: '0.75rem', color: 'var(--eco-text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div>
          <strong>Statistical Safeguard:</strong> Pearson correlation is an exploratory sample statistic evaluated over concurrent observation intervals. It does not establish causal pollutant transfer, atmospheric plume dispersion, or shared industrial culpability.
        </div>
        <div>
          <strong>Geodetic Note:</strong> Inter-station distances are spherical great-circle distances computed via the Haversine formula (Earth radius R = 6,371.0088 km) on the WGS-84 coordinate datum.
        </div>
      </div>
    </div>
  );
};
