import React from 'react';
import type { SpatialComparisonResponse } from '../../types';
import { deriveSpatialVerdict } from '../../utils/verdict';
import { VerdictBanner } from '../ui/VerdictBanner';
import { Disclosure } from '../ui/Disclosure';
import { GlossaryTerm } from '../ui/Tooltip';
import styles from './Spatial.module.css';

export interface SpatialPlainSummaryProps {
  comparisonData: SpatialComparisonResponse;
}

/**
 * Plain-language regional vs. local spike verdict banner, accessible timeline symbol key,
 * and collapsible methodology disclosure for Compare Nearby.
 */
export const SpatialPlainSummary: React.FC<SpatialPlainSummaryProps> = ({ comparisonData }) => {
  const verdict = deriveSpatialVerdict(comparisonData);

  return (
    <div className={styles.summaryWrap}>
      {verdict && <VerdictBanner verdict={verdict} />}

      <div className={styles.codeLegend} role="note" aria-label="Regional vs. local timeline legend">
        <span style={{ fontWeight: 600, color: 'var(--eco-text-primary)' }}>
          Regional event vs. local spike key:
        </span>
        <span className={styles.legendEntry}>
          <span className={styles.codeTag}>[C]</span>
          Coincident regional rise
        </span>
        <span className={styles.legendEntry}>
          <span className={styles.codeTag}>[L]</span>
          Local main-station spike
        </span>
        <span className={styles.legendEntry}>
          <span className={styles.codeTag}>[N]</span>
          Neighbor monitor elevation
        </span>
        <span className={styles.legendEntry}>
          <span className={styles.codeTag}>[B]</span>
          Monitors in baseline range
        </span>
        <span className={styles.legendEntry}>
          <span className={styles.codeTag}>[—]</span>
          Insufficient overlapping data
        </span>
      </div>

      <Disclosure label="Show the math & spatial safeguards">
        <p style={{ margin: 0 }}>
          Co-monitoring compares discrete station point measurements within the chosen kilometer ring at each overlapping timestamp (maximum 1 primary station plus 4 neighboring monitors). Shared spikes indicate concurrent regional behavior, never proof of source direction or continuous neighborhood-wide interpolation.
        </p>

        <div className={styles.glossaryStrip}>
          <GlossaryTerm termKey="haversine" />
          <GlossaryTerm termKey="iqr" />
          <GlossaryTerm termKey="completenessGate" />
        </div>
      </Disclosure>
    </div>
  );
};

