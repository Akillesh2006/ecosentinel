import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { HealthState } from '../types';
import { getApiBaseUrl } from '../services/api';
import { Button } from './ui/Button';
import styles from './StatusBanner.module.css';

export interface StatusBannerProps {
  health: HealthState;
  onRefresh: () => void;
  isWakingUp?: boolean;
  retryAttempt?: number;
  maxRetries?: number;
}

/**
 * Displays backend connection status with a calm, non-alarmist wake-up state
 * (shimmer progress + illustration) when the data service is booting or offline.
 */
export const StatusBanner: React.FC<StatusBannerProps> = ({
  health,
  onRefresh,
  isWakingUp = false,
  retryAttempt = 0,
  maxRetries = 3,
}) => {
  const isConnected = !health.isLoading && health.data !== null && health.error === null;
  const isCalmWaking = !isConnected;
  const baseUrl = getApiBaseUrl();

  return (
    <section
      className={`${styles.banner} ${isCalmWaking ? styles.calmWaking : styles.connected}`.trim()}
      aria-label="Backend Service Status"
      aria-live="polite"
    >
      <div className={styles.left}>
        {isConnected ? (
          <span className={`${styles.dot} ${styles.dotConnected}`} aria-hidden="true" />
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className={styles.calmIcon}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" stroke="var(--eco-teal)" strokeWidth="1.5" strokeOpacity="0.35" />
            <path d="M8 14c1.5-2.5 3-3.5 4-3.5s2.5 1 4 3.5" stroke="var(--eco-teal)" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="8.5" r="1.5" fill="var(--eco-lime)" />
          </svg>
        )}

        <div className={styles.infoCol}>
          <div className={styles.title}>
            {isConnected
              ? `Live Telemetry Connected · ${health.latencyMs} ms`
              : `Waking the data service…${retryAttempt > 0 ? ` (Attempt ${retryAttempt}/${maxRetries})` : ''}`}
          </div>

          <div className={styles.meta}>
            {isConnected ? (
              <span>
                {health.data?.app} v{health.data?.version} · OpenAQ v3
              </span>
            ) : (
              <span>
                Connecting to {baseUrl}. Cold starts take ~15–30 seconds—live readings appear automatically once ready.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.right}>
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={health.isLoading}
          aria-label="Refresh backend health check"
          leftIcon={<RefreshCw size={13} />}
        >
          {health.isLoading || isWakingUp ? 'Connecting…' : 'Retry'}
        </Button>
      </div>

      {isCalmWaking && <div className={styles.shimmerTrack} aria-hidden="true" />}
    </section>
  );
};
