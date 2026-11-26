import React from 'react';
import { formatAxisValue, type AxisTick } from './chartUtils';
import styles from './Charts.module.css';

export interface ChartAxesProps {
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  yTicks: number[];
  yToPx: (value: number) => number;
  xTicks: AxisTick[];
  yAxisUnit?: string;
}

/**
 * Shared SVG cartesian gridlines, tabular numeric Y-axis ticks,
 * and IST-localized X-axis timestamp ticks.
 */
export const ChartAxes: React.FC<ChartAxesProps> = ({
  plotLeft,
  plotRight,
  plotTop,
  plotBottom,
  yTicks,
  yToPx,
  xTicks,
  yAxisUnit,
}) => {
  return (
    <g aria-hidden="true">
      {yTicks.map((tick) => {
        const y = yToPx(tick);
        if (y < plotTop - 4 || y > plotBottom + 4) return null;
        return (
          <g key={`y-${tick}`}>
            <line
              x1={plotLeft}
              x2={plotRight}
              y1={y}
              y2={y}
              className={styles.gridLine}
            />
            <text
              x={plotLeft - 8}
              y={y + 3.5}
              textAnchor="end"
              className={styles.axisLabel}
            >
              {formatAxisValue(tick)}
            </text>
          </g>
        );
      })}

      {yAxisUnit && (
        <text
          x={plotLeft - 8}
          y={plotTop - 10}
          textAnchor="end"
          className={styles.axisLabel}
          style={{ fontSize: '9.5px' }}
        >
          {yAxisUnit}
        </text>
      )}

      {/* Baseline */}
      <line
        x1={plotLeft}
        x2={plotRight}
        y1={plotBottom}
        y2={plotBottom}
        className={styles.axisLine}
      />

      {/* X-axis ticks */}
      {xTicks.map((tick, idx) => {
        const anchor = idx === 0 ? 'start' : idx === xTicks.length - 1 ? 'end' : 'middle';
        return (
          <g key={`x-${idx}-${tick.label}`}>
            <line
              x1={tick.x}
              x2={tick.x}
              y1={plotBottom}
              y2={plotBottom + 4}
              className={styles.axisLine}
            />
            <text
              x={tick.x}
              y={plotBottom + 18}
              textAnchor={anchor}
              className={styles.axisLabel}
            >
              {tick.label}
            </text>
          </g>
        );
      })}
    </g>
  );
};

