import React from 'react';
import type { HealthState } from '../types';
import { getApiBaseUrl } from '../services/api';

interface StatusBannerProps {
  health: HealthState;
  onRefresh: () => void;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({ health, onRefresh }) => {
  const isConnected = !health.isLoading && health.data !== null && health.error === null;
  const baseUrl = getApiBaseUrl();

  return (
    <section className="status-banner" aria-label="Backend Service Status">
      <div className="status-left">
        <span
          className={`status-indicator-dot ${
            health.isLoading
              ? 'status-dot-loading'
              : isConnected
              ? 'status-dot-connected'
              : 'status-dot-disconnected'
          }`}
          aria-hidden="true"
        />
        <div>
          <div className="status-title">
            {health.isLoading
              ? 'Checking backend connection...'
              : isConnected
              ? `Backend Connected — ${health.data?.app} v${health.data?.version}`
              : 'Backend Service Offline (Local Mode)'}
          </div>
          <div className="status-meta">
            {isConnected ? (
              <span>
                Endpoint: <code className="status-code-snippet">{baseUrl}/api/health</code> ·{' '}
                Latency: <strong>{health.latencyMs} ms</strong> · Env:{' '}
                <strong>{health.data?.environment}</strong>
              </span>
            ) : health.isLoading ? (
              <span>Querying health status at {baseUrl}/api/health...</span>
            ) : (
              <span>
                Start backend with:{' '}
                <code className="status-code-snippet">
                  uvicorn app.main:app --reload --port 8000
                </code>
              </span>
            )}
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          className="btn-secondary"
          onClick={onRefresh}
          disabled={health.isLoading}
          aria-label="Refresh backend health check"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
          {health.isLoading ? 'Checking...' : 'Check Connection'}
        </button>
      </div>
    </section>
  );
};
