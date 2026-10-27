import React, { useEffect, useState } from 'react';
import type { ProviderStatusResponse, SectionId } from '../types';
import { fetchProviderStatus } from '../services/api';

interface OverviewSectionProps {
  onNavigate: (sectionId: SectionId) => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({ onNavigate }) => {
  const [providerStatus, setProviderStatus] = useState<ProviderStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchProviderStatus().then((res) => {
      if (!isMounted) return;
      setIsLoading(false);
      if (res.data) {
        setProviderStatus(res.data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <article id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
      <header className="section-header">
        <h2>Environmental Intelligence Overview</h2>
        <p className="section-subtitle" style={{ fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>
          EcoSentinel is an evidence-based environmental intelligence platform detecting unusual air-quality
          patterns across India through time-aware comparisons and explainable statistical methods.
        </p>
      </header>

      {/* Provider Connectivity Status Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="card-title">
          <span className="card-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          </span>
          Upstream Data Provider: OpenAQ API v3 (India)
        </h3>
        <p>
          EcoSentinel interfaces directly with the OpenAQ v3 programmatic platform to ingest real-time and
          historical observations from certified monitoring bodies across India (including CPCB, DPCC, and MPCB).
        </p>

        <div className="empty-state-meta-box" style={{ width: '100%', marginBottom: '1rem' }}>
          <div className="meta-item">
            <span className="meta-label">Provider Name</span>
            <span className="meta-val">{providerStatus?.provider || 'OpenAQ v3'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">API Key Configured</span>
            <span className="meta-val">
              {isLoading
                ? 'Checking...'
                : providerStatus?.is_configured
                ? '✓ Active'
                : '⚠ Unconfigured (Missing Key)'}
            </span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Provider Reachability</span>
            <span className="meta-val">
              {isLoading
                ? 'Testing connection...'
                : providerStatus?.is_reachable
                ? '✓ Reachable (HTTPS 200/401)'
                : '✕ Unreachable'}
            </span>
          </div>
        </div>

        {!isLoading && !providerStatus?.is_configured && (
          <div className="notice-banner" style={{ marginTop: '0.5rem' }}>
            <strong>Configuration Guidance:</strong> To query live Indian stations, sign up for a free OpenAQ
            key at{' '}
            <a
              href="https://explore.openaq.org/register"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              explore.openaq.org/register ↗
            </a>{' '}
            and place it in your <code>.env</code> file under <code>OPENAQ_API_KEY</code>.
          </div>
        )}
      </div>

      {/* Action Navigation Cards */}
      <div className="grid-2col">
        <div className="card">
          <h3 className="card-title">
            <span className="card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            Investigate Air Quality
          </h3>
          <p>
            Search registered Indian monitoring stations, choose target pollutants (PM2.5, PM10, NO₂, O₃, CO, SO₂),
            and inspect actual observations in interactive time-series charts and tables.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onNavigate('investigate')}
            style={{ marginTop: 'auto', alignSelf: 'flex-start' }}
          >
            Launch Investigation →
          </button>
        </div>

        <div className="card">
          <h3 className="card-title">
            <span className="card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </span>
            Evidence & Data Quality
          </h3>
          <p>
            Audit data completeness, inspect missing observation intervals, verify observation timestamps, and review
            station sensor provenance.
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onNavigate('evidence')}
            style={{ marginTop: 'auto', alignSelf: 'flex-start' }}
          >
            View Evidence Metrics →
          </button>
        </div>
      </div>

      {/* Scientific Integrity Principle */}
      <div className="principle-banner">
        <div className="principle-banner-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Scientific Integrity & Zero-Fabrication Principle
        </div>
        <p>
          EcoSentinel displays only genuine environmental observations retrieved from verified station sensors.
          No synthetic metrics are substituted on errors or empty query windows. High concentration values or
          statistical deviations do not constitute proof of pollution causes or legal violations.
        </p>
      </div>
    </article>
  );
};
