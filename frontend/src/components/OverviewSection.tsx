import React, { useEffect, useState } from 'react';
import type {
  LocationDetail,
  LocationMeasurementsResponse,
  ProviderStatusResponse,
  RiskAssessmentResponse,
  SectionId,
} from '../types';
import { fetchProviderStatus } from '../services/api';

export interface OverviewSectionProps {
  onNavigate: (sectionId: SectionId) => void;
  selectedLocation?: LocationDetail | null;
  measurementsData?: LocationMeasurementsResponse | null;
  assessmentData?: RiskAssessmentResponse | null;
  hidden?: boolean;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  onNavigate,
  selectedLocation,
  measurementsData,
  assessmentData,
  hidden,
}) => {
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
    <article
      id="panel-overview"
      role="tabpanel"
      aria-labelledby="tab-overview"
      hidden={hidden}
      style={{ display: hidden ? 'none' : undefined }}
    >
      <header className="section-header">
        <h2>Environmental Intelligence Overview</h2>
        <p className="section-subtitle" style={{ fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>
          EcoSentinel is an evidence-first environmental intelligence platform detecting unusual air-quality
          patterns across India through time-aware comparisons, spatial neighborhood screening, and explainable
          statistical methods grounded in physical measurements.
        </p>
      </header>

      {/* Active Analysis Context Snapshot */}
      {selectedLocation ? (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            borderColor: selectedLocation.is_stale ? 'rgba(245, 158, 11, 0.4)' : 'rgba(20, 184, 166, 0.4)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '0.75rem',
            }}
          >
            <div>
              <div className="station-badges">
                <span className="pill-tag pill-active">
                  {selectedLocation.is_monitor ? 'Reference Monitor' : 'Sensor Node'}
                </span>
                <span className="pill-tag">Station #{selectedLocation.id}</span>
                {selectedLocation.is_stale ? (
                  <span className="pill-tag pill-pending">⚠ Stale Data (&gt;24h)</span>
                ) : (
                  <span className="pill-tag pill-active">✓ Live Stream</span>
                )}
              </div>
              <h3 className="card-title" style={{ marginTop: '0.5rem', fontSize: '1.25rem' }}>
                Active Station: {selectedLocation.name}
              </h3>
              <p style={{ margin: '0.25rem 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                Locality: <strong>{selectedLocation.locality || 'India'}</strong> · Provider:{' '}
                <strong>{selectedLocation.provider_name}</strong>
                {selectedLocation.coordinates && (
                  <span className="font-mono" style={{ marginLeft: '0.5rem' }}>
                    ({selectedLocation.coordinates.latitude.toFixed(4)}°N,{' '}
                    {selectedLocation.coordinates.longitude.toFixed(4)}°E)
                  </span>
                )}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => onNavigate('investigate')}
              >
                Inspect Telemetry →
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onNavigate('spatial')}
              >
                Spatial Comparison →
              </button>
            </div>
          </div>

          {/* Context Details Grid */}
          <div className="empty-state-meta-box" style={{ width: '100%', marginTop: '0.5rem' }}>
            <div className="meta-item">
              <span className="meta-label">Monitored Pollutant</span>
              <span className="meta-val">
                {measurementsData?.parameter_display_name || assessmentData?.parameter_display_name || 'None selected'}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Returned Observations</span>
              <span className="meta-val">
                {measurementsData ? `${measurementsData.total_observations} points` : 'N/A (Pending query)'}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Completeness Gate</span>
              <span className="meta-val">
                {assessmentData
                  ? `${assessmentData.is_completeness_satisfied ? '✓ Satisfied' : '✗ Incomplete'} (${assessmentData.completeness_percentage.toFixed(1)}%)`
                  : 'Pending evaluation'}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Screening Finding</span>
              <span className="meta-val font-mono">
                {assessmentData
                  ? `${assessmentData.status_label} (${assessmentData.calculated_average !== null && assessmentData.calculated_average !== undefined ? `${assessmentData.calculated_average.toFixed(1)} ${assessmentData.units}` : 'N/A'})`
                  : 'Pending evaluation'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(20, 184, 166, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 className="card-title" style={{ fontSize: '1.15rem' }}>
                <span className="card-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </span>
                Verified Indian Monitoring Network
              </h3>
              <p style={{ margin: '0.25rem 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                Connect to certified CAAQMS stations across Delhi NCR, Mumbai MMR, Bengaluru, Kolkata, Chennai, and Hyderabad.
                Select a station to launch time-series investigation, spatial neighbor discovery, and anomaly screening.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigate('investigate')}
            >
              Discover & Select Stations →
            </button>
          </div>
        </div>
      )}

      {/* Upstream Provider Connectivity Status Card */}
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

      {/* Platform Capabilities & Action Navigation Grid */}
      <div className="grid-2col" style={{ marginBottom: '1.5rem' }}>
        {/* Capability 1: Station Telemetry */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="card-title">
            <span className="card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            Station Telemetry &amp; Time-Series
          </h3>
          <p style={{ flex: 1 }}>
            Query certified Indian monitoring stations, choose target pollutants (PM2.5, PM10, NO₂, O₃, CO, SO₂),
            and inspect actual hourly observations in interactive SVG time-series charts and paginated data tables.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onNavigate('investigate')}
            style={{ marginTop: '1rem', alignSelf: 'flex-start' }}
          >
            Launch Investigation →
          </button>
        </div>

        {/* Capability 2: Pollution Intelligence & Anomaly Screening */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="card-title">
            <span className="card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </span>
            Pollution Intelligence &amp; Anomalies
          </h3>
          <p style={{ flex: 1 }}>
            Detect statistical spikes and sensor flatlines using robust Median Absolute Deviation (MAD) and Modified
            Z-scores ($M_i \ge +3.5$), calibrated against sensor precision limits without fragile mean-based distortion.
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onNavigate('anomalies')}
            style={{ marginTop: '1rem', alignSelf: 'flex-start' }}
          >
            Screen Anomalies →
          </button>
        </div>

        {/* Capability 3: Spatial Analysis & Neighborhood Screening */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="card-title">
            <span className="card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="10" r="3" />
                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
              </svg>
            </span>
            Spatial Comparison &amp; Neighbors
          </h3>
          <p style={{ flex: 1 }}>
            Compare up to 5 coincident stations within configurable Haversine radii (5–50 km). Inspect spatial dispersion
            on an interactive SVG map and classify concurrent regional events vs. localized station anomalies.
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onNavigate('spatial')}
            style={{ marginTop: '1rem', alignSelf: 'flex-start' }}
          >
            Compare Neighbors →
          </button>
        </div>

        {/* Capability 4: Evidence & Data Quality */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="card-title">
            <span className="card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </span>
            Evidence &amp; Provenance Audit
          </h3>
          <p style={{ flex: 1 }}>
            Verify the 75% data completeness gate (18/24h), audit excluded negative measurement artifacts, inspect
            sensor freshness state, and export verified datasets with full source attribution.
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onNavigate('evidence')}
            style={{ marginTop: '1rem', alignSelf: 'flex-start' }}
          >
            Audit Evidence →
          </button>
        </div>

        {/* Capability 5: Environmental Action Plan & Reports */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="card-title">
            <span className="card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </span>
            Facility Action Plan &amp; Reports
          </h3>
          <p style={{ flex: 1 }}>
            Generate structured Five-Part Action Dossiers for EHS supervisors with verified anti-idling protocols,
            dust mitigation benchmarks, and canonical engineering abatement calculations (CSIR-CRRI &amp; US EPA).
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onNavigate('reports')}
            style={{ marginTop: '1rem', alignSelf: 'flex-start' }}
          >
            Generate Action Dossier →
          </button>
        </div>
      </div>

      {/* Scientific Integrity Principle */}
      <div className="principle-banner">
        <div className="principle-banner-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Scientific Integrity &amp; Zero-Fabrication Principle
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
