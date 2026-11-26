import React from 'react';
import styles from './Charts.module.css';

export interface ChartTooltipProps {
  valueLabel: string;
  units: string;
  localTime?: string | null;
  utcTime?: string | null;
  extraBadge?: React.ReactNode;
}

/**
 * Shared accessible inspect card displaying both IST local and UTC timestamps
 * alongside physical concentration measurements.
 */
export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  valueLabel,
  units,
  localTime,
  utcTime,
  extraBadge,
}) => {
  return (
    <div className={styles.tooltipCard} role="status" aria-live="polite">
      <div className={styles.tooltipPrimary}>
        <span className={styles.tooltipValue}>
          {valueLabel} {units}
        </span>
        {extraBadge}
      </div>

      <div className={styles.tooltipTimes}>
        {localTime && (
          <span>
            <strong>Local:</strong> {localTime}
          </span>
        )}
        {utcTime && (
          <span>
            <strong>UTC:</strong> {utcTime}
          </span>
        )}
      </div>
    </div>
  );
};

