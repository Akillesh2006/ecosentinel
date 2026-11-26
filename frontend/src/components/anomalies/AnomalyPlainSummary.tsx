import React from 'react';
import type { AirQualityAnomalyResponse } from '../../types';
import { deriveAnomalyVerdict } from '../../utils/verdict';
import { VerdictBanner } from '../ui/VerdictBanner';
import { Disclosure } from '../ui/Disclosure';
import { GlossaryTerm } from '../ui/Tooltip';
import styles from './Anomalies.module.css';

export interface AnomalyPlainSummaryProps {
  anomalyData: AirQualityAnomalyResponse;
}

/**
 * Plain-language anomaly headline banner, visual severity legend, and
 * collapsible "Show the math" breakdown for non-expert operators.
 */
export const AnomalyPlainSummary: React.FC<AnomalyPlainSummaryProps> = ({ anomalyData }) => {
  const verdict = deriveAnomalyVerdict(anomalyData);
  const metrics = anomalyData.baseline_metrics;
  const units = anomalyData.units || '';

  return (
    <div className={styles.summaryWrap}>
      {verdict && <VerdictBanner verdict={verdict} />}

      <div className={styles.legendRow} role="note" aria-label="Chart marker guide">
        <span style={{ fontWeight: 600, color: 'var(--eco-text-primary)' }}>Chart key:</span>
        <span className={styles.legendItem}>
          <span className={styles.diamondSpike} aria-hidden="true" />
          Sharp upward spike
        </span>
        <span className={styles.legendItem}>
          <span className={styles.diamondDrop} aria-hidden="true" />
          Sudden downward drop
        </span>
        <span className={styles.legendItem}>
          <span className={styles.dotModerate} aria-hidden="true" />
          Moderate departure
        </span>
        <span className={styles.legendItem}>
          <span className={styles.dotNormal} aria-hidden="true" />
          Baseline-consistent reading
        </span>
      </div>

      <Disclosure label="Show the math & statistical safeguards">
        <p style={{ margin: 0 }}>
          EcoSentinel scores each valid hour against surrounding observations using non-parametric statistics so a single extreme smog plume does not inflate its own benchmark. When 50% or more values are identical, flatline zero-variation safeguards pause automated Z-scoring cleanly.
        </p>

        <div className={styles.glossaryRow}>
          <GlossaryTerm termKey="jackknifeLoo" />
          <GlossaryTerm termKey="mad" />
          <GlossaryTerm termKey="nmad" />
          <GlossaryTerm termKey="modifiedZ" />
          <GlossaryTerm termKey="completenessGate" />
        </div>

        {metrics && (
          <div className={styles.mathGrid}>
            <div className={styles.mathTile}>
              <span className={styles.mathLabel}>Window Median</span>
              <span className={styles.mathValue}>
                {metrics.median !== null && metrics.median !== undefined
                  ? `${metrics.median.toFixed(2)} ${units}`
                  : '—'}
              </span>
            </div>
            <div className={styles.mathTile}>
              <span className={styles.mathLabel}>Raw Spread</span>
              <span className={styles.mathValue}>
                {metrics.mad !== null && metrics.mad !== undefined
                  ? `${metrics.mad.toFixed(2)} ${units}`
                  : '—'}
              </span>
            </div>
            <div className={styles.mathTile}>
              <span className={styles.mathLabel}>Scaled Dispersion</span>
              <span className={styles.mathValue}>
                {metrics.nmad !== null && metrics.nmad !== undefined
                  ? `${metrics.nmad.toFixed(2)} ${units}`
                  : '—'}
              </span>
            </div>
            <div className={styles.mathTile}>
              <span className={styles.mathLabel}>Peak Deviation Score</span>
              <span className={styles.mathValue}>
                {anomalyData.summary.max_modified_z !== null &&
                anomalyData.summary.max_modified_z !== undefined
                  ? anomalyData.summary.max_modified_z.toFixed(2)
                  : '—'}
              </span>
            </div>
          </div>
        )}
      </Disclosure>
    </div>
  );
};

