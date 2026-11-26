import React from 'react';
import type { AnomalyObservationPoint } from '../../types';
import styles from './Anomalies.module.css';

export interface AnomalyEventsTableProps {
  notableEvents: AnomalyObservationPoint[];
  units: string;
  selectedObservation: AnomalyObservationPoint | null;
  onSelectObservation: (obs: AnomalyObservationPoint) => void;
}

/**
 * Interactive log of flagged spikes, drops, moderate deviations, and sustained episodes.
 */
export const AnomalyEventsTable: React.FC<AnomalyEventsTableProps> = ({
  notableEvents,
  units,
  selectedObservation,
  onSelectObservation,
}) => {
  return (
    <div className={`card ${styles.eventsCard}`}>
      <div className={styles.eventsHeader}>
        <h4 className={styles.eventsTitle}>Detected Events &amp; Anomalies Log</h4>
        <span className={styles.eventsCount}>{notableEvents.length} events logged</span>
      </div>

      {notableEvents.length === 0 ? (
        <div className={styles.eventsEmpty}>
          No statistical anomalies or rapid step surges detected within this evaluation window.
        </div>
      ) : (
        <div className={styles.tableScroll}>
          <table className={`data-table ${styles.eventsTable}`}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Value</th>
                <th>Classification</th>
                <th>Mod. Z</th>
                <th>CPCB</th>
              </tr>
            </thead>
            <tbody>
              {notableEvents.map((evt, idx) => {
                const isSelected = selectedObservation?.datetime_utc === evt.datetime_utc;
                return (
                  <tr
                    key={`event-${idx}-${evt.datetime_utc}`}
                    onClick={() => onSelectObservation(evt)}
                    className={`${styles.eventRow} ${isSelected ? styles.eventRowSelected : ''}`}
                  >
                    <td className={styles.eventTime}>
                      {evt.datetime_local || evt.datetime_utc.slice(11, 16)}
                    </td>
                    <td className={styles.eventValue}>
                      {evt.observed_value} {units}
                    </td>
                    <td>
                      <span
                        className={`badge badge-${
                          evt.anomaly_type === 'STATISTICAL_SPIKE'
                            ? 'anomaly'
                            : evt.anomaly_type === 'STATISTICAL_DROP'
                            ? 'info'
                            : evt.anomaly_type === 'MODERATE_ELEVATION'
                            ? 'warning'
                            : 'normal'
                        } ${styles.kpiBadgeSmall}`}
                      >
                        {evt.anomaly_type || 'NORMAL'}
                      </span>
                    </td>
                    <td className={styles.eventModZ}>
                      {evt.modified_z_score !== null && evt.modified_z_score !== undefined
                        ? `${evt.modified_z_score > 0 ? '+' : ''}${evt.modified_z_score.toFixed(2)}`
                        : '—'}
                    </td>
                    <td>
                      <span className={evt.is_cpcb_exceedance ? styles.cpcbExceed : styles.cpcbOk}>
                        {evt.is_cpcb_exceedance ? 'Exceeds' : 'OK'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

