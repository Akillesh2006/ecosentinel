import React from 'react';
import type { ThresholdSpec } from './chartUtils';
import styles from './Charts.module.css';

export interface ThresholdLinesProps {
  thresholds: ThresholdSpec[];
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  yToPx: (value: number) => number;
}

/**
 * Renders CPCB / WHO horizontal limit lines with collision-avoidant pill labels.
 */
export const ThresholdLines: React.FC<ThresholdLinesProps> = ({
  thresholds,
  plotLeft,
  plotRight,
  plotTop,
  plotBottom,
  yToPx,
}) => {
  const placedYs: number[] = [];

  return (
    <g aria-label="Guideline threshold overlays">
      {thresholds.map((t) => {
        if (!Number.isFinite(t.value)) return null;
        const y = yToPx(t.value);
        if (y < plotTop - 2 || y > plotBottom - 4) return null;

        // Nudge label vertically if another threshold pill is close by
        let labelY = y;
        for (const prevY of placedYs) {
          if (Math.abs(labelY - prevY) < 16) {
            labelY = prevY > labelY ? prevY - 17 : prevY + 17;
          }
        }
        labelY = Math.max(plotTop + 10, Math.min(plotBottom - 8, labelY));
        placedYs.push(labelY);

        const estWidth = Math.max(66, t.label.length * 6.2 + 12);

        return (
          <g key={t.id}>
            <line
              x1={plotLeft}
              x2={plotRight}
              y1={y}
              y2={y}
              stroke={t.color}
              strokeWidth={1.3}
              strokeDasharray={t.dashArray || '6 4'}
              strokeOpacity={0.85}
            />
            <rect
              x={plotRight - estWidth - 4}
              y={labelY - 9}
              width={estWidth}
              height={16}
              rx={4}
              className={styles.thresholdLabelBg}
            />
            <text
              x={plotRight - 10}
              y={labelY + 2.5}
              textAnchor="end"
              fill={t.color}
              className={styles.thresholdLabelText}
            >
              {t.label}
            </text>
          </g>
        );
      })}
    </g>
  );
};

