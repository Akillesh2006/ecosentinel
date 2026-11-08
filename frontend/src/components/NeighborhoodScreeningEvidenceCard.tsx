import React from 'react';
import type {
  ComparisonTimeSlice,
  StationComparisonMetadata,
  NeighborhoodScreeningSummary,
} from '../types';
import { getClassificationMeta } from './NeighborhoodScreeningRibbon';

export interface NeighborhoodScreeningEvidenceCardProps {
  slice: ComparisonTimeSlice | null;
  referenceStationName: string;
  referenceStationId: number;
  parameterDisplayName: string;
  units: string;
  stations: StationComparisonMetadata[];
  summary?: NeighborhoodScreeningSummary | null;
}

/**
 * Formats full timestamp to local and UTC strings
 */
function formatTimestampDetailed(isoString: string): { utc: string; local: string } {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { utc: isoString, local: isoString };
    const utc = d.toUTCString();
    const local = d.toLocaleString();
    return { utc, local };
  } catch {
    return { utc: isoString, local: isoString };
  }
}

export const NeighborhoodScreeningEvidenceCard: React.FC<NeighborhoodScreeningEvidenceCardProps> = ({
  slice,
  referenceStationName,
  referenceStationId,
  parameterDisplayName,
  units,
  stations,
  summary,
}) => {
  if (!slice) {
    return (
      <div
        className="card screening-evidence-card"
        style={{ marginBottom: '1.5rem', padding: '1.25rem' }}
        data-testid="screening-evidence-card"
      >
        <p style={{ color: 'var(--eco-text-muted)', margin: 0, fontSize: '0.875rem' }}>
          Select an hour from the screening ribbon above to view empirical evidence and station concordance details.
        </p>
      </div>
    );
  }

  const screening = slice.screening;
  const meta = getClassificationMeta(screening?.classification);
  const timeLabels = formatTimestampDetailed(slice.datetime_utc);

  // Reference station observed value
  const refValue = slice.station_values[referenceStationId];

  // Map neighbor metadata
  const neighborStations = stations.filter((s) => !s.is_reference);

  // Group exclusions by station ID for fast lookup
  const hourlyExclusions = screening?.timestamp_exclusions || [];
  const exclusionMap = new Map<number, string>();
  for (const ex of hourlyExclusions) {
    exclusionMap.set(ex.location_id, ex.message || ex.reason_code);
  }

  // Derive distance range for contributing comparable neighbors
  const contributingStations = neighborStations.filter((s) =>
    screening?.contributing_neighbor_ids?.includes(s.location_id)
  );
  const distances = contributingStations
    .map((s) => s.distance_from_reference_km)
    .filter((d): d is number => d !== null && d !== undefined);
  const minDistance = distances.length > 0 ? Math.min(...distances) : null;
  const maxDistance = distances.length > 0 ? Math.max(...distances) : null;

  return (
    <div
      className="card screening-evidence-card"
      style={{ marginBottom: '1.5rem', padding: '1.25rem' }}
      data-testid="screening-evidence-card"
    >
      {/* Evidence Card Header */}
      <div
        className="card-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--eco-border-subtle)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="card-badge">Selected Hour Dossier</span>
            <span
              className={`badge ${meta.badgeClass}`}
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#fff',
                background: `${meta.color}35`,
                border: `1px solid ${meta.color}`,
              }}
            >
              {meta.symbol} {meta.fullLabel}
            </span>
          </div>

          <h3
            style={{
              fontSize: '1.15rem',
              fontWeight: 600,
              color: 'var(--eco-text-primary)',
              marginTop: '0.4rem',
              marginBottom: '0.2rem',
            }}
          >
            Hourly Evidence: {timeLabels.utc} ({parameterDisplayName})
          </h3>
          {timeLabels.local !== timeLabels.utc && (
            <p style={{ fontSize: '0.75rem', color: 'var(--eco-text-muted)', margin: 0 }}>
              Local Time: {timeLabels.local}
            </p>
          )}
        </div>

        {screening && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '0.2rem',
              fontSize: '0.8rem',
            }}
          >
            <span style={{ color: 'var(--eco-text-secondary)' }}>
              Comparable Neighbors: <strong>{screening.neighbors_comparable_count}</strong>
            </span>
            <span style={{ color: 'var(--eco-text-secondary)' }}>
              Elevated Neighbors: <strong style={{ color: screening.elevated_neighbors_count > 0 ? '#c084fc' : 'inherit' }}>
                {screening.elevated_neighbors_count}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Synthesized Evidence Statement */}
      <div
        className="screening-statement-box"
        style={{
          padding: '0.85rem 1rem',
          borderRadius: 'var(--eco-radius-md)',
          background: 'var(--eco-bg-input)',
          borderLeft: `4px solid ${meta.color}`,
          marginBottom: '1.25rem',
          fontSize: '0.85rem',
          color: 'var(--eco-text-primary)',
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 600, color: meta.color, marginBottom: '0.25rem' }}>
          Empirical Screening Evidence Statement:
        </div>
        <div>
          {screening?.evidence_statement ||
            'No screening evaluation performed for this interval (insufficient or suppressed baseline).'}
        </div>
      </div>

      {/* Primary Evidence Comparison Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* Reference Station Card */}
        <div
          className="evidence-subcard"
          style={{
            padding: '1rem',
            borderRadius: 'var(--eco-radius-md)',
            background: 'var(--eco-bg-card-subtle)',
            border: '1px solid var(--eco-border-subtle)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--eco-teal)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Reference Station Anchor
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--eco-text-primary)', marginTop: '0.25rem' }}>
            {referenceStationName}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--eco-text-muted)', marginBottom: '0.75rem' }}>
            Station ID: {referenceStationId} • Anchor Monitor
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
            <div>
              <div style={{ color: 'var(--eco-text-muted)', fontSize: '0.72rem' }}>Observed Concentration</div>
              <div style={{ fontWeight: 600, color: 'var(--eco-text-primary)', fontSize: '0.95rem' }}>
                {refValue !== null && refValue !== undefined ? `${refValue.toFixed(1)} ${units}` : 'Missing / Offline'}
              </div>
            </div>

            <div>
              <div style={{ color: 'var(--eco-text-muted)', fontSize: '0.72rem' }}>Modified Z-Score (M)</div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color:
                    screening?.reference_modified_z !== null && screening?.reference_modified_z !== undefined
                      ? screening.reference_modified_z >= 2.5
                        ? '#f59e0b'
                        : '#10b981'
                      : 'var(--eco-text-muted)',
                }}
              >
                {screening?.reference_modified_z !== null && screening?.reference_modified_z !== undefined
                  ? `${screening.reference_modified_z >= 0 ? '+' : ''}${screening.reference_modified_z.toFixed(2)}`
                  : 'N/A'}
              </div>
            </div>

            <div style={{ gridColumn: 'span 2', marginTop: '0.25rem' }}>
              <div style={{ color: 'var(--eco-text-muted)', fontSize: '0.72rem' }}>Baseline Elevation Status</div>
              <div style={{ fontWeight: 600, fontSize: '0.8rem', color: screening?.is_reference_elevated ? '#f59e0b' : '#10b981' }}>
                {screening?.is_reference_elevated
                  ? 'Elevated (M ≥ +2.5 vs 24h/7d Jackknife MAD baseline)'
                  : 'Within Baseline Dispersion (M < +2.5)'}
              </div>
            </div>
          </div>
        </div>

        {/* Neighborhood Ensemble Summary Card */}
        <div
          className="evidence-subcard"
          style={{
            padding: '1rem',
            borderRadius: 'var(--eco-radius-md)',
            background: 'var(--eco-bg-card-subtle)',
            border: '1px solid var(--eco-border-subtle)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--eco-teal)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Neighborhood Ensemble (Synchronous)
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--eco-text-primary)', marginTop: '0.25rem' }}>
            Comparable Ensemble Context
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--eco-text-muted)', marginBottom: '0.75rem' }}>
            Synchronous Jackknife MAD Comparison (N ≥ 2 Required)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
            <div>
              <div style={{ color: 'var(--eco-text-muted)', fontSize: '0.72rem' }}>Comparable Monitors</div>
              <div style={{ fontWeight: 600, color: 'var(--eco-text-primary)', fontSize: '0.95rem' }}>
                {screening?.neighbors_comparable_count ?? 0}
                <span style={{ fontSize: '0.7rem', color: 'var(--eco-text-muted)', marginLeft: '0.25rem' }}>
                  (min 2 required)
                </span>
              </div>
            </div>

            <div>
              <div style={{ color: 'var(--eco-text-muted)', fontSize: '0.72rem' }}>Elevated Monitors</div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: (screening?.elevated_neighbors_count ?? 0) > 0 ? '#c084fc' : 'var(--eco-text-primary)',
                }}
              >
                {screening?.elevated_neighbors_count ?? 0}
              </div>
            </div>

            <div>
              <div style={{ color: 'var(--eco-text-muted)', fontSize: '0.72rem' }}>Contributing Monitors</div>
              <div style={{ fontWeight: 600, color: 'var(--eco-text-primary)', fontSize: '0.95rem' }}>
                {screening?.contributing_neighbor_ids?.length ?? 0}
              </div>
            </div>

            <div>
              <div style={{ color: 'var(--eco-text-muted)', fontSize: '0.72rem' }}>Geographic Distance Range</div>
              <div style={{ fontWeight: 600, color: 'var(--eco-text-primary)', fontSize: '0.95rem' }}>
                {minDistance !== null
                  ? `${minDistance.toFixed(1)} km${
                      maxDistance !== null && maxDistance !== minDistance
                        ? ` – ${maxDistance.toFixed(1)} km`
                        : ''
                    }`
                  : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Per-Neighbor Evidence Breakdown Table */}
      {neighborStations.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--eco-text-secondary)',
              marginBottom: '0.5rem',
            }}
          >
            Neighbor Station Evidence Breakdown ({neighborStations.length} Candidates Evaluated):
          </div>

          <div
            className="table-responsive"
            style={{
              overflowX: 'auto',
              borderRadius: 'var(--eco-radius-md)',
              border: '1px solid var(--eco-border-subtle)',
            }}
          >
            <table
              className="table"
              style={{
                width: '100%',
                fontSize: '0.775rem',
                borderCollapse: 'collapse',
                textAlign: 'left',
              }}
            >
              <thead>
                <tr style={{ background: 'var(--eco-bg-input)', borderBottom: '1px solid var(--eco-border-subtle)' }}>
                  <th style={{ padding: '0.5rem 0.75rem', color: 'var(--eco-text-muted)' }}>Station</th>
                  <th style={{ padding: '0.5rem 0.75rem', color: 'var(--eco-text-muted)' }}>Distance</th>
                  <th style={{ padding: '0.5rem 0.75rem', color: 'var(--eco-text-muted)' }}>Observed</th>
                  <th style={{ padding: '0.5rem 0.75rem', color: 'var(--eco-text-muted)' }}>Screening Status / Exclusion</th>
                </tr>
              </thead>
              <tbody>
                {neighborStations.map((st) => {
                  const val = slice.station_values[st.location_id];
                  const isElevated = screening?.elevated_neighbor_ids?.includes(st.location_id);
                  const exclusionReason = exclusionMap.get(st.location_id);
                  const isComparable = !exclusionReason;

                  return (
                    <tr
                      key={st.location_id}
                      style={{
                        borderBottom: '1px solid var(--eco-border-subtle)',
                        background: isElevated ? 'rgba(192, 132, 252, 0.05)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--eco-text-primary)' }}>
                        <strong>{st.station_name}</strong>
                        {st.locality && (
                          <span style={{ color: 'var(--eco-text-muted)', marginLeft: '0.35rem' }}>
                            ({st.locality})
                          </span>
                        )}
                        <span style={{ fontSize: '0.7rem', color: 'var(--eco-text-muted)', display: 'block' }}>
                          ID: {st.location_id} • {st.provider_name}
                        </span>
                      </td>

                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--eco-text-secondary)' }}>
                        {st.distance_from_reference_km !== null && st.distance_from_reference_km !== undefined
                          ? `${st.distance_from_reference_km.toFixed(1)} km`
                          : '—'}
                      </td>

                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--eco-text-primary)' }}>
                        {val !== null && val !== undefined ? (
                          <strong>{val.toFixed(1)} {units}</strong>
                        ) : (
                          <span style={{ color: 'var(--eco-text-muted)' }}>Missing</span>
                        )}
                      </td>

                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {isComparable ? (
                          <span
                            className={`badge ${isElevated ? 'badge-screening-concurrent' : 'badge-screening-baseline'}`}
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: isElevated ? '#c084fc' : '#10b981',
                              background: isElevated ? 'rgba(192, 132, 252, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              border: isElevated ? '1px solid rgba(192, 132, 252, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                              padding: '0.2rem 0.45rem',
                              borderRadius: '4px',
                            }}
                          >
                            {isElevated ? 'Elevated (M ≥ +2.5)' : 'Normal Dispersion (M < +2.5)'}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--eco-text-muted)',
                              fontStyle: 'italic',
                            }}
                          >
                            Excluded: {exclusionReason}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mandatory Scientific Disclaimer Notice */}
      <div
        className="card scientific-disclaimer-notice"
        style={{
          padding: '0.85rem 1rem',
          borderRadius: 'var(--eco-radius-md)',
          background: 'rgba(20, 184, 166, 0.05)',
          borderLeft: '4px solid var(--eco-teal)',
          borderTop: '1px solid rgba(20, 184, 166, 0.2)',
          borderRight: '1px solid rgba(20, 184, 166, 0.2)',
          borderBottom: '1px solid rgba(20, 184, 166, 0.2)',
          fontSize: '0.775rem',
          color: 'var(--eco-text-secondary)',
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--eco-teal)', marginBottom: '0.25rem' }}>
          Mandatory Scientific &amp; Regulatory Disclaimer:
        </div>
        <div>
          {summary?.screening_disclaimer ||
            'EcoSentinel screens for empirical statistical concordance across discrete, stationary monitoring points. Neighborhood screening does NOT infer continuous spatial concentration fields, atmospheric dispersion, plume trajectories, or source attribution. An elevated station score indicates an empirical anomaly relative to its own baseline, not verified pollution transport or cross-station causality.'}
        </div>
      </div>
    </div>
  );
};
