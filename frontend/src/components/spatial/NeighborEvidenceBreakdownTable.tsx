import React from 'react';
import type { ComparisonTimeSlice, StationComparisonMetadata } from '../../types';
import styles from './ScreeningEvidence.module.css';

export interface NeighborEvidenceBreakdownTableProps {
  neighborStations: StationComparisonMetadata[];
  slice: ComparisonTimeSlice;
  units: string;
  exclusionMap: Map<number, string>;
}

/**
 * Per-neighbor hourly observation & exclusion breakdown table for a selected screening hour.
 */
export const NeighborEvidenceBreakdownTable: React.FC<NeighborEvidenceBreakdownTableProps> = ({
  neighborStations,
  slice,
  units,
  exclusionMap,
}) => {
  if (neighborStations.length === 0) return null;

  const screening = slice.screening;

  return (
    <div className={styles.tableSection}>
      <div className={styles.tableTitle}>
        Neighbor Station Evidence Breakdown ({neighborStations.length} Candidates Evaluated):
      </div>

      <div className={`table-responsive ${styles.tableWrap}`}>
        <table className={`table ${styles.table}`}>
          <thead>
            <tr className={styles.theadRow}>
              <th className={styles.th}>Station</th>
              <th className={styles.th}>Distance</th>
              <th className={styles.th}>Observed</th>
              <th className={styles.th}>Screening Status / Exclusion</th>
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
                  className={`${styles.tr} ${isElevated ? styles.trElevated : ''}`}
                >
                  <td className={styles.tdPrimary}>
                    <strong>{st.station_name}</strong>
                    {st.locality && <span className={styles.locality}>({st.locality})</span>}
                    <span className={styles.stationSub}>
                      ID: {st.location_id} • {st.provider_name}
                    </span>
                  </td>

                  <td className={styles.tdSecondary}>
                    {st.distance_from_reference_km !== null && st.distance_from_reference_km !== undefined
                      ? `${st.distance_from_reference_km.toFixed(1)} km`
                      : '—'}
                  </td>

                  <td className={styles.tdPrimary}>
                    {val !== null && val !== undefined ? (
                      <strong>
                        {val.toFixed(1)} {units}
                      </strong>
                    ) : (
                      <span className={styles.textMuted}>Missing</span>
                    )}
                  </td>

                  <td className={styles.tdCell}>
                    {isComparable ? (
                      <span
                        className={`badge ${
                          isElevated ? 'badge-screening-concurrent' : 'badge-screening-baseline'
                        } ${styles.statusPill} ${
                          isElevated ? styles.statusPillElevated : styles.statusPillNormal
                        }`}
                      >
                        {isElevated ? 'Elevated (M ≥ +2.5)' : 'Normal Dispersion (M < +2.5)'}
                      </span>
                    ) : (
                      <span className={styles.excludedText}>Excluded: {exclusionReason}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

