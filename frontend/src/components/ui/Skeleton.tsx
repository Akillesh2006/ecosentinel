import React from 'react';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

/**
 * Low-CLS loading skeleton block supporting prefers-reduced-motion.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = 16, className = '' }) => (
  <div
    className={`${styles.skeleton} ${styles.line} ${className}`.trim()}
    style={{ width, height }}
    aria-hidden="true"
  />
);

export const SkeletonChart: React.FC<{ label?: string }> = ({ label = 'Loading chart…' }) => (
  <div className={styles.chartBox} role="status" aria-busy="true" aria-label={label}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <Skeleton width="35%" height={18} />
      <Skeleton width="22%" height={14} />
    </div>
    <div className={`${styles.skeleton} ${styles.chartCanvas}`} aria-hidden="true" />
    <div style={{ display: 'flex', gap: '16px' }}>
      <Skeleton width="18%" height={12} />
      <Skeleton width="18%" height={12} />
      <Skeleton width="24%" height={12} />
    </div>
    <span className="sr-only">{label}</span>
  </div>
);

export const SkeletonKpiRow: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className={styles.cardGrid} aria-busy="true" aria-label="Loading summary metrics">
    {Array.from({ length: count }).map((_, idx) => (
      <div key={idx} className={styles.cardSkeleton}>
        <Skeleton width="55%" height={12} />
        <Skeleton width="42%" height={32} />
        <Skeleton width="85%" height={12} />
      </div>
    ))}
  </div>
);

