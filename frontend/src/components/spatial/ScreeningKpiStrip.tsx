import React from 'react';
import type { NeighborhoodScreeningSummary } from '../../types';
import styles from './ScreeningRibbon.module.css';

export interface ScreeningKpiStripProps {
  summary: NeighborhoodScreeningSummary;
}

/**
 * 5-bucket breakdown of evaluated vs. insufficient neighborhood screening hours.
 */
export const ScreeningKpiStrip: React.FC<ScreeningKpiStripProps> = ({ summary }) => {
  const fmtPct = (v?: number | null) =>
    v !== null && v !== undefined ? `${v.toFixed(1)}%` : '—';

  const insufPct =
    summary.total_window_hours > 0
      ? `${((summary.insufficient_evidence_hours_count / summary.total_window_hours) * 100).toFixed(1)}%`
      : '—';

  return (
    <div className={`screening-kpi-strip ${styles.kpiStrip}`}>
      <div className={`screening-kpi-card ${styles.kpiCard} ${styles.kpiConcurrent}`}>
        <div className={`${styles.kpiLabel} ${styles.colorConcurrent}`}>
          <span>[C] Concurrent</span>
        </div>
        <div className={styles.kpiCount}>
          {summary.concurrent_elevation_hours_count}
          <span className={styles.kpiPct}>
            ({fmtPct(summary.concurrent_elevation_percentage_of_evaluable)})
          </span>
        </div>
      </div>

      <div className={`screening-kpi-card ${styles.kpiCard} ${styles.kpiLocalized}`}>
        <div className={`${styles.kpiLabel} ${styles.colorLocalized}`}>
          <span>[L] Station-Localized</span>
        </div>
        <div className={styles.kpiCount}>
          {summary.station_localized_elevation_hours_count}
          <span className={styles.kpiPct}>
            ({fmtPct(summary.station_localized_percentage_of_evaluable)})
          </span>
        </div>
      </div>

      <div className={`screening-kpi-card ${styles.kpiCard} ${styles.kpiNeighbor}`}>
        <div className={`${styles.kpiLabel} ${styles.colorNeighbor}`}>
          <span>[N] Neighbor Only</span>
        </div>
        <div className={styles.kpiCount}>
          {summary.neighbor_only_elevation_hours_count}
          <span className={styles.kpiPct}>
            ({fmtPct(summary.neighbor_only_percentage_of_evaluable)})
          </span>
        </div>
      </div>

      <div className={`screening-kpi-card ${styles.kpiCard} ${styles.kpiBaseline}`}>
        <div className={`${styles.kpiLabel} ${styles.colorBaseline}`}>
          <span>[B] Baseline Consistent</span>
        </div>
        <div className={styles.kpiCount}>
          {summary.baseline_consistent_hours_count}
          <span className={styles.kpiPct}>
            ({fmtPct(summary.baseline_consistent_percentage_of_evaluable)})
          </span>
        </div>
      </div>

      <div className={`screening-kpi-card ${styles.kpiCard} ${styles.kpiInsufficient}`}>
        <div className={`${styles.kpiLabel} ${styles.colorInsufficient}`}>
          <span>[—] Insufficient</span>
        </div>
        <div className={styles.kpiCount}>
          {summary.insufficient_evidence_hours_count}
          <span className={styles.kpiPct}>({insufPct})</span>
        </div>
      </div>
    </div>
  );
};

