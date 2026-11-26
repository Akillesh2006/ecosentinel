import React, { useEffect, useState } from 'react';

export interface CountUpValueProps {
  value: number | null | undefined;
  decimals?: number;
  durationMs?: number;
  fallback?: string;
  className?: string;
}

/**
 * Smoothly animates a numeric telemetry value from 0 to target while respecting prefers-reduced-motion.
 */
export const CountUpValue: React.FC<CountUpValueProps> = ({
  value,
  decimals = 1,
  durationMs = 550,
  fallback = '—',
  className,
}) => {
  const [display, setDisplay] = useState<number | null>(
    typeof value === 'number' && Number.isFinite(value) ? value : null
  );

  useEffect(() => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      setDisplay(null);
      return;
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || durationMs <= 0) {
      setDisplay(value);
      return;
    }

    let rafId = 0;
    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setDisplay(value);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value, durationMs]);

  if (display === null || !Number.isFinite(display)) {
    return <span className={className}>{fallback}</span>;
  }

  return <span className={className}>{display.toFixed(decimals)}</span>;
};

