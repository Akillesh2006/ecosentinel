import React from 'react';
import styles from './Badge.module.css';

export type BadgeTone =
  | 'normal'
  | 'elevated'
  | 'anomaly'
  | 'historical'
  | 'info'
  | 'muted'
  | 'teal'
  | 'lime'
  | 'concurrent';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  icon?: React.ReactNode;
}

/**
 * Semantic status chip with optional leading indicator dot or Lucide icon.
 */
export const Badge: React.FC<BadgeProps> = ({
  tone = 'muted',
  dot = false,
  icon,
  className = '',
  children,
  ...rest
}) => {
  return (
    <span className={`${styles.badge} ${styles[tone]} ${className}`.trim()} {...rest}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {!dot && icon && (
        <span aria-hidden="true" style={{ display: 'inline-flex' }}>
          {icon}
        </span>
      )}
      {children}
    </span>
  );
};

