import React from 'react';
import type {
  ComparisonTimeSlice,
  NeighborhoodScreeningSummary,
  SpatialScreeningClassification,
} from '../types';
import { ScreeningKpiStrip } from './spatial/ScreeningKpiStrip';
import styles from './spatial/ScreeningRibbon.module.css';

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
  moduleCellClass: string;
  moduleColorClass: string;
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
        moduleCellClass: styles.cellConcurrent,
        moduleColorClass: styles.colorConcurrent,
        color: '#c084fc',
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
        moduleCellClass: styles.cellLocalized,
        moduleColorClass: styles.colorLocalized,
        color: '#f59e0b',
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
        moduleCellClass: styles.cellNeighbor,
        moduleColorClass: styles.colorNeighbor,
        color: '#38bdf8',
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
        moduleCellClass: styles.cellBaseline,
        moduleColorClass: styles.colorBaseline,
        color: '#10b981',
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
        moduleCellClass: styles.cellInsufficient,
        moduleColorClass: styles.colorInsufficient,
        color: '#64748b',
        description:
          'Fewer than 2 comparable neighbors or missing/indeterminate reference data',
      };
  }
}

function formatHourShort(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString.slice(11, 16) || isoString;
    return `${String(d.getUTCHours()).padStart(2, '0')}:00`;
  } catch {
    return isoString;
  }
}

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
      className={`card neighborhood-screening-card ${styles.card}`}
      data-testid="neighborhood-screening-ribbon"
    >
      <div className={`card-header ${styles.header}`}>
        <div>
          <div className={styles.badgeRow}>
            <span className="card-badge">Spatial Screening</span>
            <span className={`badge ${isSuppressed ? 'badge-warning' : 'badge-normal'} ${styles.statusBadge}`}>
              {summary?.evaluation_status || 'SCREENING_ACTIVE'}
            </span>
          </div>
          <h3 className={styles.title}>
            Neighborhood Anomaly Screening Ribbon ({parameterDisplayName})
          </h3>
          <p className={styles.subtitle}>
            Empirical multi-station concordance screening comparing reference station
            ({parameterDisplayName}, {units}) Modified Z-scores against synchronous neighboring monitors.
            Click an hour cell or use keyboard navigation to inspect detailed evidence.
          </p>
        </div>

        {summary && (
          <div className={styles.windowMeta}>
            <span>
              Window: <strong>{summary.window_preset || 'Standard'}</strong>
            </span>
            <span>•</span>
            <span>
              Evaluable:{' '}
              <strong>
                {summary.evaluable_hours_count} / {summary.total_window_hours} hrs
              </strong>
            </span>
          </div>
        )}
      </div>

      {isSuppressed && summary && (
        <div className={`screening-suppression-notice ${styles.suppressionBox}`} role="alert">
          <div className={styles.suppressionHeader}>
            <span>⚠️ Evaluation Suppressed: {summary.evaluation_status}</span>
          </div>
          {summary.suppression_reason && (
            <p className={styles.suppressionReason}>{summary.suppression_reason}</p>
          )}
          {summary.window_exclusions && summary.window_exclusions.length > 0 && (
            <div className={styles.exclusionsWrap}>
              <span className={styles.exclusionsTitle}>
                Station Exclusions ({summary.window_exclusions.length}):
              </span>
              <ul className={styles.exclusionsList}>
                {summary.window_exclusions.map((ex) => (
                  <li key={ex.location_id}>
                    <strong>
                      {ex.station_name} (ID: {ex.location_id}):
                    </strong>{' '}
                    {ex.message || ex.reason_code}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!isSuppressed && summary && <ScreeningKpiStrip summary={summary} />}

      <div className={styles.trackSection}>
        <div className={styles.trackMeta}>
          <span>Chronological Hourly Timeline ({timeSlices.length} Intervals)</span>
          <span>Click an hour to inspect underlying evidence</span>
        </div>

        <div
          className={`screening-ribbon-track ${styles.track}`}
          role="listbox"
          aria-label="Hourly Neighborhood Screening Timeline"
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
                className={`screening-ribbon-cell ${meta.cellClass} ${meta.moduleCellClass} ${styles.cell} ${
                  isSelected ? `screening-cell-selected ${styles.cellSelected}` : ''
                }`}
                title={`${slice.datetime_utc}\n${meta.fullLabel} ${meta.symbol}\n${
                  screening?.evidence_statement || 'No screening available'
                }`}
              >
                <span className={`${styles.cellSymbol} ${meta.moduleColorClass}`}>
                  {meta.symbol}
                </span>
                <span className={`${styles.cellHour} ${isSelected ? styles.cellHourSelected : ''}`}>
                  {hourLabel}
                </span>
                {(idx === 0 || hourLabel === '00:00') && (
                  <span className={styles.cellDate}>{dateLabel}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={`screening-ribbon-legend ${styles.legend}`}>
        <span className={styles.legendTitle}>Legend:</span>
        <div className={styles.legendItem}>
          <strong className={styles.colorConcurrent}>[C]</strong> Concurrent Elevation (Multi-station M ≥ +2.5)
        </div>
        <div className={styles.legendItem}>
          <strong className={styles.colorLocalized}>[L]</strong> Station-Localized (Ref M ≥ +2.5, Neighbors normal)
        </div>
        <div className={styles.legendItem}>
          <strong className={styles.colorNeighbor}>[N]</strong> Neighbor Elevation Only (Ref normal, Neighbors M ≥ +2.5)
        </div>
        <div className={styles.legendItem}>
          <strong className={styles.colorBaseline}>[B]</strong> Baseline Consistent (All M &lt; +2.5)
        </div>
        <div className={styles.legendItem}>
          <strong className={styles.colorInsufficient}>[—]</strong> Insufficient Spatial Evidence (&lt;2 valid neighbors or missing data)
        </div>
      </div>
    </div>
  );
};
