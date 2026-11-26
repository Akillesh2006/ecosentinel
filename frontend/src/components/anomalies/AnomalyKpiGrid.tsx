import React from 'react';
import type { AirQualityAnomalyResponse } from '../../types';
import styles from './Anomalies.module.css';

export interface AnomalyKpiGridProps {
  anomalyData: AirQualityAnomalyResponse;
}

/**
 * Displays freshness metadata, coverage/zero-MAD diagnostic gates, and 6 summary KPI cards.
 */
export const AnomalyKpiGrid: React.FC<AnomalyKpiGridProps> = ({ anomalyData }) => {
  return (
    <>
      <div className={styles.diagnosticsStack}>
        <div className={styles.freshnessBar}>
          <div className={styles.freshnessGroup}>
            <span className={styles.freshnessLabel}>Freshness Status:</span>
            <span
              className={`badge badge-${
                anomalyData.freshness_state === 'FRESH'
                  ? 'normal'
                  : anomalyData.freshness_state === 'DELAYED'
                  ? 'warning'
                  : 'muted'
              }`}
            >
              {anomalyData.freshness_state}
            </span>
            {anomalyData.freshness_message && (
              <span className={styles.freshnessNote}>({anomalyData.freshness_message})</span>
            )}
          </div>

          <div className={styles.freshnessGroup}>
            <div className={styles.provenanceRow}>
              <span className={styles.freshnessLabel}>Precision Provenance:</span>
              <span
                className={`badge badge-${
                  anomalyData.precision_provenance === 'AUTHORITATIVE_METADATA'
                    ? 'normal'
                    : anomalyData.precision_provenance === 'CALLER_SUPPLIED'
                    ? 'warning'
                    : 'muted'
                }`}
              >
                {anomalyData.precision_provenance}
              </span>
            </div>
            {anomalyData.sensor_precision !== null && anomalyData.sensor_precision !== undefined && (
              <span className={styles.precisionMono}>
                [{anomalyData.sensor_precision} {anomalyData.units}]
              </span>
            )}
          </div>
        </div>

        {(!anomalyData.is_coverage_satisfied || anomalyData.coverage_state === 'INSUFFICIENT_COVERAGE') && (
          <div className={`warning-item ${styles.bannerAlert} ${styles.bannerAlertAnomaly}`}>
            <span aria-hidden="true" className={styles.bannerIcon}>
              🛑
            </span>
            <div>
              <strong className={styles.bannerTitle}>
                Statistical Evaluation Suppressed: Insufficient Coverage
              </strong>
              <p className={styles.bannerBody}>
                Retrieved {anomalyData.valid_observations} of {anomalyData.expected_observations} expected hourly observations ({anomalyData.completeness_percentage}%).
                A minimum of 75% coverage ({anomalyData.expected_observations === 24 ? 18 : 126} observations) is required to construct a valid baseline.
                Statistical anomaly screening, modified Z-scores, and step evaluations are suppressed to prevent inaccurate baselines.
              </p>
            </div>
          </div>
        )}

        {(anomalyData.summary.scale_indeterminate ||
          anomalyData.baseline_metrics?.scale_state === 'INDETERMINATE_ZERO_MAD') && (
          <div className={`warning-item ${styles.bannerAlert} ${styles.bannerAlertElevated}`}>
            <span aria-hidden="true" className={styles.bannerIcon}>
              ⚠️
            </span>
            <div>
              <strong className={styles.bannerTitleElevated}>
                Scale Indeterminate (Zero-MAD Baseline)
              </strong>
              <p className={styles.bannerBody}>
                At least 50% of baseline observations have zero absolute deviation from the median (MAD = 0).
                Under zero baseline dispersion, modified Z-scores produce a zero division artifact.
                Statistical score evaluations are appropriately suppressed.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className={`grid-kpi ${styles.kpiGrid}`}>
        <div className={`card ${styles.kpiCard}`}>
          <span className="metric-label">Data Completeness &amp; Gate</span>
          <div className={styles.kpiValueRow}>
            <span className={`metric-value ${styles.kpiValuePrimary}`}>
              {anomalyData.valid_observations}
            </span>
            <span className={styles.kpiDenominator}>
              / {anomalyData.expected_observations} ({anomalyData.completeness_percentage}%)
            </span>
          </div>
          <div className={styles.kpiBadgeWrap}>
            <span
              className={`badge badge-${anomalyData.is_coverage_satisfied ? 'normal' : 'anomaly'} ${styles.kpiBadgeSmall}`}
            >
              {anomalyData.coverage_state}
            </span>
          </div>
        </div>

        <div className={`card ${styles.kpiCard}`}>
          <span className="metric-label">Statistical Anomalies (|M| ≥ 3.5)</span>
          <div className={styles.kpiValueRow}>
            <span
              className={`metric-value ${
                anomalyData.summary.total_anomalies_detected > 0
                  ? styles.kpiValueAnomaly
                  : styles.kpiValueNormal
              }`}
            >
              {anomalyData.summary.total_anomalies_detected}
            </span>
          </div>
          <span className={styles.kpiSubtext}>
            {anomalyData.summary.total_spikes} Spikes •{' '}
            {anomalyData.summary.total_anomalies_detected - anomalyData.summary.total_spikes} Drops
          </span>
        </div>

        <div className={`card ${styles.kpiCard}`}>
          <span className="metric-label">Moderate Deviations (2.5 ≤ |M| &lt; 3.5)</span>
          <div className={styles.kpiValueRow}>
            <span className={`metric-value ${styles.kpiValueElevated}`}>
              {anomalyData.summary.total_moderate_elevations}
            </span>
          </div>
          <span className={styles.kpiSubtext}>Sub-critical elevated variance</span>
        </div>

        <div className={`card ${styles.kpiCard}`}>
          <span className="metric-label">Rate-of-Change Surges</span>
          <div className={styles.kpiValueRow}>
            <span className={`metric-value ${styles.kpiValueTeal}`}>
              {anomalyData.summary.total_step_surges}
            </span>
          </div>
          <span className={styles.kpiSubtext}>Rapid 1h step variations (Δt ≤ 90m)</span>
        </div>

        <div className={`card ${styles.kpiCard}`}>
          <span className="metric-label">Sustained Episodes (≥ 3h)</span>
          <div className={styles.kpiValueRow}>
            <span className={`metric-value ${styles.kpiValueElevated}`}>
              {anomalyData.summary.total_sustained_episodes}
            </span>
          </div>
          <span className={styles.kpiSubtext}>Persistent elevated runs</span>
        </div>

        <div className={`card ${styles.kpiCard}`}>
          <span className="metric-label">Sensor Invariance Status</span>
          <div className={styles.kpiBadgeWrap}>
            <span
              className={`badge badge-${
                anomalyData.summary.flatline_indicator === 'NORMAL_DISPERSION'
                  ? 'normal'
                  : anomalyData.summary.flatline_indicator === 'SUSPECTED_FLATLINE'
                  ? 'warning'
                  : 'muted'
              } ${styles.kpiBadgeSmall}`}
            >
              {anomalyData.summary.flatline_indicator}
            </span>
          </div>
          <span className={styles.kpiSubtext}>
            {anomalyData.summary.flatline_message || 'Normal sensor dispersion verified'}
          </span>
        </div>
      </div>
    </>
  );
};

