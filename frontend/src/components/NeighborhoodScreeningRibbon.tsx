import React from 'react';
import type {
  ComparisonTimeSlice,
  NeighborhoodScreeningSummary,
  SpatialScreeningClassification,
} from '../types';

export interface NeighborhoodScreeningRibbonProps {
  timeSlices: ComparisonTimeSlice[];
  summary?: NeighborhoodScreeningSummary | null;
  selectedHour: string | null;
  onSelectHour: (datetimeUtc: string) => void;
  parameterDisplayName: string;
  units: string;
}

export interface ClassificationMeta {
  symbol: string;
  shortLabel: string;
  fullLabel: string;
  badgeClass: string;
  cellClass: string;
  color: string;
  description: string;
}

export function getClassificationMeta(
  classification?: SpatialScreeningClassification | null
): ClassificationMeta {
  switch (classification) {
    case 'MULTI_STATION_CONCURRENT_ELEVATION':
      return {
        symbol: '[C]',
        shortLabel: 'Concurrent',
        fullLabel: 'Multi-Station Concurrent Elevation',
        badgeClass: 'badge-screening-concurrent',
        cellClass: 'screening-cell-concurrent',
        color: '#c084fc', // purple-400
        description:
          'Reference and >= 1 comparable neighbor exhibit concurrent baseline elevation (M >= +2.5)',
      };
    case 'STATION_LOCALIZED_ELEVATION':
      return {
        symbol: '[L]',
        shortLabel: 'Localized',
        fullLabel: 'Station-Localized Elevation',
        badgeClass: 'badge-screening-localized',
        cellClass: 'screening-cell-localized',
        color: '#f59e0b', // amber-500
        description:
          'Reference station elevated (M >= +2.5), but no comparable neighbors elevated (all M < +2.5)',
      };
    case 'NEIGHBOR_ELEVATION_ONLY':
      return {
        symbol: '[N]',
        shortLabel: 'Neighbor Only',
        fullLabel: 'Neighbor Elevation Only',
        badgeClass: 'badge-screening-neighbor-only',
        cellClass: 'screening-cell-neighbor-only',
        color: '#38bdf8', // sky-400
        description:
          'Reference station normal (M < +2.5), but >= 1 comparable neighbor elevated (M >= +2.5)',
      };
    case 'BASELINE_CONSISTENT':
      return {
        symbol: '[B]',
        shortLabel: 'Consistent',
        fullLabel: 'Baseline Consistent',
        badgeClass: 'badge-screening-baseline',
        cellClass: 'screening-cell-baseline',
        color: '#10b981', // emerald-500
        description:
          'Reference and all comparable neighbors within normal baseline dispersion (all M < +2.5)',
      };
    case 'INSUFFICIENT_SPATIAL_EVIDENCE':
    default:
      return {
        symbol: '[—]',
        shortLabel: 'Insufficient',
        fullLabel: 'Insufficient Spatial Evidence',
        badgeClass: 'badge-screening-insufficient',
        cellClass: 'screening-cell-insufficient',
        color: '#64748b', // slate-500
        description:
          'Fewer than 2 comparable neighbors or missing/indeterminate reference data',
      };
  }
}

/**
 * Formats ISO timestamp to short hour string (e.g. "14:00")
 */
function formatHourShort(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString.slice(11, 16) || isoString;
    const hours = String(d.getUTCHours()).padStart(2, '0');
    return `${hours}:00`;
  } catch {
    return isoString;
  }
}

/**
 * Formats ISO timestamp to short date string (e.g. "Oct 20")
 */
function formatDateShort(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return '';
  }
}

export const NeighborhoodScreeningRibbon: React.FC<NeighborhoodScreeningRibbonProps> = ({
  timeSlices,
  summary,
  selectedHour,
  onSelectHour,
  parameterDisplayName,
  units,
}) => {
  const isSuppressed = summary && summary.evaluation_status !== 'EVALUATED';

  return (
    <div
      className="card neighborhood-screening-card"
      style={{ marginBottom: '1.5rem', padding: '1.25rem' }}
      data-testid="neighborhood-screening-ribbon"
    >
      {/* Header Banner */}
      <div
        className="card-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="card-badge">Phase D • Spatial Screening</span>
            <span
              className={`badge ${isSuppressed ? 'badge-warning' : 'badge-normal'}`}
              style={{ fontSize: '0.75rem' }}
            >
              {summary?.evaluation_status || 'SCREENING_ACTIVE'}
            </span>
          </div>
          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              color: 'var(--eco-text-primary)',
              marginTop: '0.35rem',
              marginBottom: '0.2rem',
            }}
          >
            Neighborhood Anomaly Screening Ribbon ({parameterDisplayName})
          </h3>
          <p
            style={{
              fontSize: '0.8rem',
              color: 'var(--eco-text-secondary)',
              margin: 0,
              maxWidth: '850px',
            }}
          >
            Empirical multi-station concordance screening comparing reference station
            ({parameterDisplayName}, {units}) Modified Z-scores against synchronous neighboring monitors.
            Click an hour cell or use keyboard navigation to inspect detailed evidence.
          </p>
        </div>

        {summary && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.75rem',
              color: 'var(--eco-text-muted)',
            }}
          >
            <span>Window: <strong>{summary.window_preset || 'Standard'}</strong></span>
            <span>•</span>
            <span>
              Evaluable: <strong>{summary.evaluable_hours_count} / {summary.total_window_hours} hrs</strong>
            </span>
          </div>
        )}
      </div>

      {/* Suppressed Window / Status Alert */}
      {isSuppressed && summary && (
        <div
          className="screening-suppression-notice"
          role="alert"
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            borderRadius: 'var(--eco-radius-md)',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: 'var(--eco-text-primary)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 600,
              color: '#f59e0b',
              marginBottom: '0.35rem',
            }}
          >
            <span>⚠️ Evaluation Suppressed: {summary.evaluation_status}</span>
          </div>
          {summary.suppression_reason && (
            <p style={{ fontSize: '0.825rem', margin: '0 0 0.5rem', lineHeight: 1.5 }}>
              {summary.suppression_reason}
            </p>
          )}

          {summary.window_exclusions &&
            summary.window_exclusions.length > 0 && (
              <div
                style={{
                  marginTop: '0.75rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid rgba(245, 158, 11, 0.2)',
                  fontSize: '0.75rem',
                }}
              >
                <span style={{ fontWeight: 600, color: '#f59e0b' }}>
                  Station Exclusions ({summary.window_exclusions.length}):
                </span>
                <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0 }}>
                  {summary.window_exclusions.map((ex) => (
                    <li key={ex.location_id}>
                      <strong>{ex.station_name} (ID: {ex.location_id}):</strong> {ex.message || ex.reason_code}
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      )}

      {/* Summary KPI Strip (When Evaluated) */}
      {!isSuppressed && summary && (
        <div
          className="screening-kpi-strip"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.25rem',
          }}
        >
          {/* Concurrent */}
          <div
            className="screening-kpi-card"
            style={{
              padding: '0.6rem 0.8rem',
              borderRadius: 'var(--eco-radius-md)',
              background: 'rgba(192, 132, 252, 0.08)',
              border: '1px solid rgba(192, 132, 252, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#c084fc', fontWeight: 600 }}>
              <span>[C] Concurrent</span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--eco-text-primary)', marginTop: '0.2rem' }}>
              {summary.concurrent_elevation_hours_count}
              <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--eco-text-muted)', marginLeft: '0.35rem' }}>
                ({summary.concurrent_elevation_percentage_of_evaluable !== null && summary.concurrent_elevation_percentage_of_evaluable !== undefined
                  ? `${summary.concurrent_elevation_percentage_of_evaluable.toFixed(1)}%`
                  : '—'})
              </span>
            </div>
          </div>

          {/* Localized */}
          <div
            className="screening-kpi-card"
            style={{
              padding: '0.6rem 0.8rem',
              borderRadius: 'var(--eco-radius-md)',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600 }}>
              <span>[L] Station-Localized</span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--eco-text-primary)', marginTop: '0.2rem' }}>
              {summary.station_localized_elevation_hours_count}
              <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--eco-text-muted)', marginLeft: '0.35rem' }}>
                ({summary.station_localized_percentage_of_evaluable !== null && summary.station_localized_percentage_of_evaluable !== undefined
                  ? `${summary.station_localized_percentage_of_evaluable.toFixed(1)}%`
                  : '—'})
              </span>
            </div>
          </div>

          {/* Neighbor Only */}
          <div
            className="screening-kpi-card"
            style={{
              padding: '0.6rem 0.8rem',
              borderRadius: 'var(--eco-radius-md)',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>
              <span>[N] Neighbor Only</span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--eco-text-primary)', marginTop: '0.2rem' }}>
              {summary.neighbor_only_elevation_hours_count}
              <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--eco-text-muted)', marginLeft: '0.35rem' }}>
                ({summary.neighbor_only_percentage_of_evaluable !== null && summary.neighbor_only_percentage_of_evaluable !== undefined
                  ? `${summary.neighbor_only_percentage_of_evaluable.toFixed(1)}%`
                  : '—'})
              </span>
            </div>
          </div>

          {/* Baseline Consistent */}
          <div
            className="screening-kpi-card"
            style={{
              padding: '0.6rem 0.8rem',
              borderRadius: 'var(--eco-radius-md)',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
              <span>[B] Baseline Consistent</span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--eco-text-primary)', marginTop: '0.2rem' }}>
              {summary.baseline_consistent_hours_count}
              <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--eco-text-muted)', marginLeft: '0.35rem' }}>
                ({summary.baseline_consistent_percentage_of_evaluable !== null && summary.baseline_consistent_percentage_of_evaluable !== undefined
                  ? `${summary.baseline_consistent_percentage_of_evaluable.toFixed(1)}%`
                  : '—'})
              </span>
            </div>
          </div>

          {/* Insufficient Evidence */}
          <div
            className="screening-kpi-card"
            style={{
              padding: '0.6rem 0.8rem',
              borderRadius: 'var(--eco-radius-md)',
              background: 'rgba(100, 116, 139, 0.08)',
              border: '1px solid rgba(100, 116, 139, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
              <span>[—] Insufficient</span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--eco-text-primary)', marginTop: '0.2rem' }}>
              {summary.insufficient_evidence_hours_count}
              <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--eco-text-muted)', marginLeft: '0.35rem' }}>
                ({summary.total_window_hours > 0
                  ? `${((summary.insufficient_evidence_hours_count / summary.total_window_hours) * 100).toFixed(1)}%`
                  : '—'})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Hourly Screening Ribbon Cells */}
      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem',
            fontSize: '0.75rem',
            color: 'var(--eco-text-muted)',
          }}
        >
          <span>Chronological Hourly Timeline ({timeSlices.length} Intervals)</span>
          <span>Click an hour to inspect underlying evidence</span>
        </div>

        <div
          className="screening-ribbon-track"
          role="listbox"
          aria-label="Hourly Neighborhood Screening Timeline"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(42px, 1fr))`,
            gap: '4px',
            padding: '4px',
            background: 'var(--eco-bg-input)',
            borderRadius: 'var(--eco-radius-md)',
            border: '1px solid var(--eco-border-subtle)',
            maxHeight: '260px',
            overflowY: 'auto',
          }}
        >
          {timeSlices.map((slice, idx) => {
            const screening = slice.screening;
            const meta = getClassificationMeta(screening?.classification);
            const isSelected = slice.datetime_utc === selectedHour;
            const hourLabel = formatHourShort(slice.datetime_utc);
            const dateLabel = formatDateShort(slice.datetime_utc);

            return (
              <div
                key={slice.datetime_utc || idx}
                role="option"
                tabIndex={0}
                aria-selected={isSelected}
                aria-label={`Hour ${slice.datetime_utc}: ${meta.fullLabel} (${meta.symbol})`}
                onClick={() => onSelectHour(slice.datetime_utc)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectHour(slice.datetime_utc);
                  }
                }}
                className={`screening-ribbon-cell ${meta.cellClass} ${
                  isSelected ? 'screening-cell-selected' : ''
                }`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px 2px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  border: isSelected
                    ? '2px solid #fff'
                    : `1px solid ${meta.color}40`,
                  background: isSelected
                    ? `${meta.color}35`
                    : `${meta.color}15`,
                  boxShadow: isSelected
                    ? `0 0 8px ${meta.color}80`
                    : 'none',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                }}
                title={`${slice.datetime_utc}\n${meta.fullLabel} ${meta.symbol}\n${
                  screening?.evidence_statement || 'No screening available'
                }`}
              >
                <span
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    color: meta.color,
                    letterSpacing: '-0.3px',
                  }}
                >
                  {meta.symbol}
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 500,
                    color: isSelected ? '#fff' : 'var(--eco-text-secondary)',
                    marginTop: '2px',
                  }}
                >
                  {hourLabel}
                </span>
                {idx === 0 || hourLabel === '00:00' ? (
                  <span
                    style={{
                      fontSize: '0.52rem',
                      color: 'var(--eco-text-muted)',
                      lineHeight: 1,
                    }}
                  >
                    {dateLabel}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend & Non-Color Cues */}
      <div
        className="screening-ribbon-legend"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--eco-border-subtle)',
          fontSize: '0.75rem',
          color: 'var(--eco-text-secondary)',
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--eco-text-primary)' }}>Legend:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <strong style={{ color: '#c084fc' }}>[C]</strong> Concurrent Elevation (Multi-station M ≥ +2.5)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <strong style={{ color: '#f59e0b' }}>[L]</strong> Station-Localized (Ref M ≥ +2.5, Neighbors normal)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <strong style={{ color: '#38bdf8' }}>[N]</strong> Neighbor Elevation Only (Ref normal, Neighbors M ≥ +2.5)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <strong style={{ color: '#10b981' }}>[B]</strong> Baseline Consistent (All M &lt; +2.5)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <strong style={{ color: '#64748b' }}>[—]</strong> Insufficient Spatial Evidence (&lt;2 valid neighbors or missing data)
        </div>
      </div>
    </div>
  );
};
