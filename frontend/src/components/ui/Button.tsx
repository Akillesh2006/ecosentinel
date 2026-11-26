import React from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * Accessible design-system button with consistent sizes, semantic variants,
 * and loading spinner support across both dark and light themes.
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}) => {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`${styles.btn} ${styles[variant]} ${styles[size]} ${className}`.trim()}
      {...rest}
    >
      {isLoading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        leftIcon && <span aria-hidden="true" style={{ display: 'inline-flex' }}>{leftIcon}</span>
      )}
      {children}
      {!isLoading && rightIcon && (
        <span aria-hidden="true" style={{ display: 'inline-flex' }}>{rightIcon}</span>
      )}
    </button>
  );
};

