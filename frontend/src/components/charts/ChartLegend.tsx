import React from 'react';
import styles from './Charts.module.css';

export interface LegendEntry {
  id: string;
  label: string;
  color: string;
  kind?: 'line' | 'dashed' | 'dot' | 'diamond';
}

export interface ChartLegendProps {
  items: LegendEntry[];
  gapCount?: number;
}

/**
 * Shared chart legend displaying series swatches and uninterpolated gap count when > 0.
 */
export const ChartLegend: React.FC<ChartLegendProps> = ({ items, gapCount = 0 }) => {
  return (
    <div className={styles.legendBar}>
      <div className={styles.legendItems}>
        {items.map((item) => (
          <span key={item.id} className={styles.legendItem}>
            {item.kind === 'dashed' && (
              <span
                className={styles.legendDashed}
                style={{ borderColor: item.color }}
                aria-hidden="true"
              />
            )}
            {item.kind === 'dot' && (
              <span
                className={styles.legendDot}
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
            )}
            {item.kind === 'diamond' && (
              <span
                className={styles.legendDiamond}
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
            )}
            {(!item.kind || item.kind === 'line') && (
              <span
                className={styles.legendLine}
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
            )}
            <span>{item.label}</span>
          </span>
        ))}
      </div>

      {gapCount > 0 && (
        <span className={styles.gapPill}>
          {gapCount} data {gapCount === 1 ? 'gap' : 'gaps'} (uninterpolated)
        </span>
      )}
    </div>
  );
};

