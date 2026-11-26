import React from 'react';
import styles from './Charts.module.css';

export interface ChartContainerProps {
  ariaLabel: string;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  tooltip?: React.ReactNode;
  svgClassName?: string;
  children: React.ReactNode;
}

/**
 * Shared accessible SVG wrapper providing cohesive surface framing,
 * responsive viewBox scaling, optional header, legend footer, and inspect tooltip.
 */
export const ChartContainer: React.FC<ChartContainerProps> = ({
  ariaLabel,
  viewBoxWidth = 760,
  viewBoxHeight = 250,
  header,
  footer,
  tooltip,
  svgClassName,
  children,
}) => {
  return (
    <figure className={styles.figure}>
      {header && <div className={styles.headerRow}>{header}</div>}

      <div className={styles.canvasWrap}>
        <svg
          className={`${styles.svg} ${svgClassName || ''}`.trim()}
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={ariaLabel}
        >
          {children}
        </svg>
      </div>

      {tooltip}
      {footer}
    </figure>
  );
};

