import React from 'react';
import styles from './Card.module.css';

export type CardVariant = 'default' | 'subtle' | 'elevated';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardTone = 'none' | 'normal' | 'elevated' | 'anomaly' | 'historical' | 'muted';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  tone?: CardTone;
  interactive?: boolean;
}

const variantMap: Record<CardVariant, string> = {
  default: styles.variantDefault,
  subtle: styles.variantSubtle,
  elevated: styles.variantElevated,
};

const padMap: Record<CardPadding, string> = {
  none: styles.padNone,
  sm: styles.padSm,
  md: styles.padMd,
  lg: styles.padLg,
};

const toneMap: Record<CardTone, string> = {
  none: '',
  normal: styles.toneNormal,
  elevated: styles.toneElevated,
  anomaly: styles.toneAnomaly,
  historical: styles.toneHistorical,
  muted: styles.toneMuted,
};

/**
 * Elevated surface card primitive enforcing EcoSentinel radii, subtle borders,
 * and semantic status borders.
 */
export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  tone = 'none',
  interactive = false,
  className = '',
  children,
  ...rest
}) => {
  return (
    <div
      className={`${styles.card} ${variantMap[variant]} ${padMap[padding]} ${toneMap[tone]} ${
        interactive ? styles.interactive : ''
      } ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <div className={`${styles.header} ${className}`.trim()} {...rest}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <h3 className={`${styles.title} ${className}`.trim()} {...rest}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <p className={`${styles.description} ${className}`.trim()} {...rest}>
    {children}
  </p>
);

