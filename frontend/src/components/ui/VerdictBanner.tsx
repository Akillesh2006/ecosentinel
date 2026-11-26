import React from 'react';
import { Badge, type BadgeTone } from './Badge';
import type { PlainVerdict } from '../../utils/verdict';
import styles from './VerdictBanner.module.css';

export interface VerdictBannerProps {
  verdict: PlainVerdict;
  rightSlot?: React.ReactNode;
  className?: string;
}

const toneToBadge: Record<PlainVerdict['tone'], BadgeTone> = {
  normal: 'normal',
  elevated: 'elevated',
  anomaly: 'anomaly',
  historical: 'historical',
  muted: 'muted',
};

/**
 * High-clarity plain-language verdict card placed at the top of analysis results
 * so non-experts understand the finding in under five seconds.
 */
export const VerdictBanner: React.FC<VerdictBannerProps> = ({
  verdict,
  rightSlot,
  className = '',
}) => {
  return (
    <div
      className={`${styles.banner} ${styles[verdict.tone]} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div className={styles.topRow}>
        <Badge tone={toneToBadge[verdict.tone]} dot>
          {verdict.chipLabel}
        </Badge>
        {rightSlot}
      </div>
      <p className={styles.headline}>{verdict.headline}</p>
      {verdict.subline && <p className={styles.subline}>{verdict.subline}</p>}
    </div>
  );
};

