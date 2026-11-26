import React from 'react';
import type {
  ComparisonTimeSlice,
  StationComparisonMetadata,
  NeighborhoodScreeningSummary,
  SpatialScreeningClassification,
} from '../types';
import { getClassificationMeta } from './NeighborhoodScreeningRibbon';
import { NeighborEvidenceBreakdownTable } from './spatial/NeighborEvidenceBreakdownTable';
import styles from './spatial/ScreeningEvidence.module.css';

export interface NeighborhoodScreeningEvidenceCardProps {
  slice: ComparisonTimeSlice | null;
  referenceStationName: string;
  referenceStationId: number;
  parameterDisplayName: string;
  units: string;
  stations: StationComparisonMetadata[];
  summary?: NeighborhoodScreeningSummary | null;
}

function formatTimestampDetailed(isoString: string): { utc: string; local: string } {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { utc: isoString, local: isoString };
    return { utc: d.toUTCString(), local: d.toLocaleString() };
  } catch {
    return { utc: isoString, local: isoString };
  }
}

function getToneClasses(classification?: SpatialScreeningClassification | null) {
  switch (classification) {
    case 'MULTI_STATION_CONCURRENT_ELEVATION':
      return { badge: styles.badgeConcurrent, statement: styles.statementConcurrent, text: styles.textConcurrent };
    case 'STATION_LOCALIZED_ELEVATION':
      return { badge: styles.badgeLocalized, statement: styles.statementLocalized, text: styles.textElevated };
    case 'NEIGHBOR_ELEVATION_ONLY':
      return { badge: styles.badgeNeighbor, statement: styles.statementNeighbor, text: styles.textNormal };
    case 'BASELINE_CONSISTENT':
      return { badge: styles.badgeBaseline, statement: styles.statementBaseline, text: styles.textNormal };
    default:
      return { badge: styles.badgeInsufficient, statement: styles.statementInsufficient, text: styles.textMuted };
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
      <div className={`card screening-evidence-card ${styles.card}`} data-testid="screening-evidence-card">
        <p className={styles.emptyText}>
          Select an hour from the screening ribbon above to view empirical evidence and station concordance details.
        </p>
      </div>
    );
  }

  const screening = slice.screening;
  const meta = getClassificationMeta(screening?.classification);
  const tone = getToneClasses(screening?.classification);
  const timeLabels = formatTimestampDetailed(slice.datetime_utc);

  const refValue = slice.station_values[referenceStationId];
  const neighborStations = stations.filter((s) => !s.is_reference);

  const hourlyExclusions = screening?.timestamp_exclusions || [];
  const exclusionMap = new Map<number, string>();
  for (const ex of hourlyExclusions) {
    exclusionMap.set(ex.location_id, ex.message || ex.reason_code);
  }

  const contributingStations = neighborStations.filter((s) =>
    screening?.contributing_neighbor_ids?.includes(s.location_id)
  );
  const distances = contributingStations
    .map((s) => s.distance_from_reference_km)
    .filter((d): d is number => d !== null && d !== undefined);
  const minDistance = distances.length > 0 ? Math.min(...distances) : null;
  const maxDistance = distances.length > 0 ? Math.max(...distances) : null;

  return (
    <div className={`card screening-evidence-card ${styles.card}`} data-testid="screening-evidence-card">
      <div className={`card-header ${styles.header}`}>
        <div>
          <div className={styles.badgeRow}>
            <span className="card-badge">Selected Hour Dossier</span>
            <span className={`badge ${meta.badgeClass} ${styles.classBadge} ${tone.badge}`}>
              {meta.symbol} {meta.fullLabel}
            </span>
          </div>

          <h3 className={styles.title}>
            Hourly Evidence: {timeLabels.utc} ({parameterDisplayName})
          </h3>
          {timeLabels.local !== timeLabels.utc && (
            <p className={styles.localTime}>Local Time: {timeLabels.local}</p>
          )}
        </div>

        {screening && (
          <div className={styles.countsCol}>
            <span>
              Comparable Neighbors: <strong>{screening.neighbors_comparable_count}</strong>
            </span>
            <span>
              Elevated Neighbors:{' '}
              <strong className={screening.elevated_neighbors_count > 0 ? styles.elevatedCountHighlight : ''}>
                {screening.elevated_neighbors_count}
              </strong>
            </span>
          </div>
        )}
      </div>

      <div className={`screening-statement-box ${styles.statementBox} ${tone.statement}`}>
        <div className={`${styles.statementHeading} ${tone.text}`}>
          Empirical Screening Evidence Statement:
        </div>
        <div>
          {screening?.evidence_statement ||
            'No screening evaluation performed for this interval (insufficient or suppressed baseline).'}
        </div>
      </div>

      <div className={styles.comparisonGrid}>
        <div className={`evidence-subcard ${styles.subcard}`}>
          <div className={styles.subcardEyebrow}>Reference Station Anchor</div>
          <div className={styles.subcardTitle}>{referenceStationName}</div>
          <div className={styles.subcardMeta}>
            Station ID: {referenceStationId} • Anchor Monitor
          </div>

          <div className={styles.metricsRow}>
            <div>
              <div className={styles.metricLabel}>Observed Concentration</div>
              <div className={styles.metricVal}>
                {refValue !== null && refValue !== undefined ? `${refValue.toFixed(1)} ${units}` : 'Missing / Offline'}
              </div>
            </div>

            <div>
              <div className={styles.metricLabel}>Modified Z-Score (M)</div>
              <div
                className={`${styles.metricValBold} ${
                  screening?.reference_modified_z !== null && screening?.reference_modified_z !== undefined
                    ? screening.reference_modified_z >= 2.5
                      ? styles.textElevated
                      : styles.textNormal
                    : styles.textMuted
                }`}
              >
                {screening?.reference_modified_z !== null && screening?.reference_modified_z !== undefined
                  ? `${screening.reference_modified_z >= 0 ? '+' : ''}${screening.reference_modified_z.toFixed(2)}`
                  : 'N/A'}
              </div>
            </div>

            <div className={styles.fullSpan}>
              <div className={styles.metricLabel}>Baseline Elevation Status</div>
              <div
                className={`${styles.statusText} ${
                  screening?.is_reference_elevated ? styles.textElevated : styles.textNormal
                }`}
              >
                {screening?.is_reference_elevated
                  ? 'Elevated (M ≥ +2.5 vs 24h/7d Jackknife MAD baseline)'
                  : 'Within Baseline Dispersion (M < +2.5)'}
              </div>
            </div>
          </div>
        </div>

        <div className={`evidence-subcard ${styles.subcard}`}>
          <div className={styles.subcardEyebrow}>Neighborhood Ensemble (Synchronous)</div>
          <div className={styles.subcardTitle}>Comparable Ensemble Context</div>
          <div className={styles.subcardMeta}>
            Synchronous Jackknife MAD Comparison (N ≥ 2 Required)
          </div>

          <div className={styles.metricsRow}>
            <div>
              <div className={styles.metricLabel}>Comparable Monitors</div>
              <div className={styles.metricVal}>
                {screening?.neighbors_comparable_count ?? 0}
                <span className={styles.metricHint}>(min 2 required)</span>
              </div>
            </div>

            <div>
              <div className={styles.metricLabel}>Elevated Monitors</div>
              <div
                className={`${styles.metricValBold} ${
                  (screening?.elevated_neighbors_count ?? 0) > 0 ? styles.textConcurrent : ''
                }`}
              >
                {screening?.elevated_neighbors_count ?? 0}
              </div>
            </div>

            <div>
              <div className={styles.metricLabel}>Contributing Monitors</div>
              <div className={styles.metricVal}>
                {screening?.contributing_neighbor_ids?.length ?? 0}
              </div>
            </div>

            <div>
              <div className={styles.metricLabel}>Geographic Distance Range</div>
              <div className={styles.metricVal}>
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

      <NeighborEvidenceBreakdownTable
        neighborStations={neighborStations}
        slice={slice}
        units={units}
        exclusionMap={exclusionMap}
      />

      <div className={`card scientific-disclaimer-notice ${styles.disclaimer}`}>
        <div className={styles.disclaimerTitle}>Mandatory Scientific &amp; Regulatory Disclaimer:</div>
        <div>
          {summary?.screening_disclaimer ||
            'EcoSentinel screens for empirical statistical concordance across discrete, stationary monitoring points. Neighborhood screening does NOT infer continuous spatial concentration fields, atmospheric dispersion, plume trajectories, or source attribution. An elevated station score indicates an empirical anomaly relative to its own baseline, not verified pollution transport or cross-station causality.'}
        </div>
      </div>
    </div>
  );
};
