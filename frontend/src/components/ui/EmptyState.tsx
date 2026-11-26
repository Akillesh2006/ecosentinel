import React from 'react';
import { Inbox } from 'lucide-react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  tone?: 'teal' | 'elevated' | 'anomaly';
  title: string;
  description: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  role?: 'status' | 'alert';
}

/**
 * Designed empty / stale / error state card with semantic icon and next-action slot.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  tone = 'teal',
  title,
  description,
  actions,
  children,
  role = 'status',
}) => {
  const iconToneClass =
    tone === 'elevated'
      ? styles.iconToneElevated
      : tone === 'anomaly'
      ? styles.iconToneAnomaly
      : '';

  return (
    <div className={styles.emptyBox} role={role}>
      <div className={`${styles.iconWrap} ${iconToneClass}`.trim()} aria-hidden="true">
        {icon ?? <Inbox size={22} />}
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      {children}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
};

