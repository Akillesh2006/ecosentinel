import React from 'react';
import { RefreshCw, Server } from 'lucide-react';
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
 * Displays backend connection health cleanly, including a calm cold-start
 * wake-up state for Render free-tier instances before falling back to offline guidance.
 */
export const StatusBanner: React.FC<StatusBannerProps> = ({
  health,
  onRefresh,
  isWakingUp = false,
  retryAttempt = 0,
  maxRetries = 3,
}) => {
  const isConnected = !health.isLoading && health.data !== null && health.error === null;
  const baseUrl = getApiBaseUrl();

  const bannerToneClass = isConnected
    ? ''
    : isWakingUp || health.isLoading
    ? styles.waking
    : styles.alert;

  const dotToneClass =
    health.isLoading || isWakingUp
      ? styles.dotLoading
      : isConnected
      ? styles.dotConnected
      : styles.dotDisconnected;

  return (
    <section
      className={`${styles.banner} ${bannerToneClass}`.trim()}
      aria-label="Backend Service Status"
      aria-live="polite"
    >
      <div className={styles.left}>
        {isWakingUp && !isConnected ? (
          <Server size={16} style={{ color: 'var(--eco-teal-text)', flexShrink: 0 }} aria-hidden="true" />
        ) : (
          <span className={`${styles.dot} ${dotToneClass}`.trim()} aria-hidden="true" />
        )}

        <div className={styles.infoCol}>
          <div className={styles.title}>
            {isWakingUp && !isConnected
              ? `Waking up the server…${retryAttempt > 0 ? ` (Retry ${retryAttempt}/${maxRetries})` : ''}`
              : health.isLoading
              ? 'Checking backend connection...'
              : isConnected
              ? `Backend Connected — ${health.data?.app} v${health.data?.version}`
              : 'Backend Service Offline (Local Mode)'}
          </div>

          <div className={styles.meta}>
            {isConnected ? (
              <span>
                Endpoint: <code className={styles.code}>{baseUrl}/api/health</code> · Latency:{' '}
                <strong className="eco-mono">{health.latencyMs} ms</strong> · Env:{' '}
                <strong>{health.data?.environment}</strong>
              </span>
            ) : isWakingUp ? (
              <span>
                Render free-tier instances spin down after idle periods (~15–30 s to start). Retrying automatically…
              </span>
            ) : health.isLoading ? (
              <span>Querying health status at {baseUrl}/api/health...</span>
            ) : (
              <span>
                Start backend with:{' '}
                <code className={styles.code}>uvicorn app.main:app --reload --port 8000</code>
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
          {health.isLoading || isWakingUp ? 'Checking...' : 'Check Connection'}
        </Button>
      </div>
    </section>
  );
};
