import React from 'react';
import type {
  NavSection,
  SectionId,
  LocationDetail,
  LocationMeasurementsResponse,
  RiskAssessmentResponse,
} from '../types';

interface HeaderProps {
  sections?: NavSection[];
  activeSection: SectionId;
  onSelectSection?: (id: SectionId) => void;
  selectedLocation?: LocationDetail | null;
  measurementsData?: LocationMeasurementsResponse | null;
  assessmentData?: RiskAssessmentResponse | null;
  selectedParameter?: string;
  onToggleMobileMenu?: () => void;
}

interface FreshnessStatus {
  label: string;
  pillClass: string;
  tooltip: string;
}

function computeObservationFreshness(
  timestampUtc?: string | null,
  freshnessState?: string | null
): FreshnessStatus {
  if (freshnessState === 'historical') {
    return {
      label: 'Historical Telemetry',
      pillClass: 'header-pill-historical',
      tooltip: 'Station observation telemetry ceased >30 days ago (Retrospective Archive)',
    };
  }

  if (freshnessState === 'stale') {
    return {
      label: 'Stale Observation',
      pillClass: 'header-pill-stale',
      tooltip: 'Observations are >24 hours old; real-time operational screening suppressed',
    };
  }

  if (!timestampUtc) {
    return {
      label: 'No Ingested Data',
      pillClass: 'header-pill-muted',
      tooltip: 'No timestamped observations available for this sensor',
    };
  }

  const date = new Date(timestampUtc);
  const now = Date.now();
  const diffHours = (now - date.getTime()) / (3600 * 1000);

  if (diffHours < 0) {
    return {
      label: 'Recent Observation',
      pillClass: 'header-pill-fresh',
      tooltip: 'Timestamp within current reporting cycle',
    };
  }

  if (diffHours <= 3.0) {
    return {
      label: 'Fresh Observation',
      pillClass: 'header-pill-fresh',
      tooltip: `Updated ${Math.round(diffHours * 60)}m ago (within 3h telemetry cycle)`,
    };
  }

  if (diffHours <= 24.0) {
    return {
      label: 'Delayed Observation',
      pillClass: 'header-pill-delayed',
      tooltip: `Updated ${Math.round(diffHours)}h ago (normal regional transmission lag)`,
    };
  }

  if (diffHours <= 720.0) {
    return {
      label: 'Stale Observation',
      pillClass: 'header-pill-stale',
      tooltip: `Last reported ${Math.round(diffHours / 24)} days ago (>24h lag)`,
    };
  }

  return {
    label: 'Historical Telemetry',
    pillClass: 'header-pill-historical',
    tooltip: 'Observations ceased >30 days ago',
  };
}

export const Header: React.FC<HeaderProps> = ({
  sections,
  activeSection,
  onSelectSection,
  selectedLocation,
  measurementsData,
  assessmentData,
  selectedParameter,
  onToggleMobileMenu,
}) => {
  // Derive Section Display Title
  const activeSectionObj = sections?.find((s) => s.id === activeSection);
  const sectionTitle = activeSectionObj?.label || activeSection.toUpperCase();

  // Derive Latest Sensor Observation Timestamp
  const sensorTimestampUtc =
    measurementsData?.sensor_datetime_last_utc ||
    assessmentData?.sensor_datetime_last_utc ||
    selectedLocation?.datetime_last_utc;

  const freshnessInfo = computeObservationFreshness(
    sensorTimestampUtc,
    assessmentData?.freshness_state
  );

  const formatParamDisplay = (param?: string | null): string => {
    if (!param) return 'PM2.5';
    const lower = param.toLowerCase();
    if (lower === 'pm25' || lower === 'pm2.5') return 'PM2.5';
    if (lower === 'pm10') return 'PM10';
    if (lower === 'no2') return 'NO₂';
    if (lower === 'so2') return 'SO₂';
    if (lower === 'o3') return 'O₃';
    if (lower === 'co') return 'CO';
    return param.toUpperCase();
  };

  const activeParamDisplay =
    measurementsData?.parameter_display_name ||
    assessmentData?.parameter_display_name ||
    formatParamDisplay(selectedParameter);

  return (
    <header className="header-wrapper" role="banner">
      <div className="header-inner">
        {/* Left: Mobile Toggle & Breadcrumb Navigation */}
        <div className="header-left">
          <button
            type="button"
            className="header-mobile-toggle mobile-only"
            onClick={onToggleMobileMenu}
            aria-label="Toggle navigation menu"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <nav className="header-breadcrumb" aria-label="Breadcrumb">
            {onSelectSection ? (
              <button
                type="button"
                className="breadcrumb-root"
                onClick={() => onSelectSection('overview')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  font: 'inherit',
                }}
                title="Return to Overview"
              >
                EcoSentinel
              </button>
            ) : (
              <span className="breadcrumb-root">EcoSentinel</span>
            )}
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{sectionTitle}</span>
          </nav>
        </div>

        {/* Center/Context: Selected Station & Parameter Pills */}
        <div className="header-center">
          {selectedLocation ? (
            <div
              className="header-station-badge"
              title={selectedLocation.name}
            >
              <span className="lbl" style={{ fontSize: '9.5px', color: 'var(--eco-text-muted)', flexShrink: 0 }}>Station:</span>
              <span className="station-badge-name disp">
                Selected: {selectedLocation.name}
              </span>
              {selectedLocation.locality && (
                <span className="station-badge-locality mono" style={{ fontSize: '11px', color: 'var(--eco-text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  ({selectedLocation.locality})
                </span>
              )}
              <span
                className="station-badge-param mono"
                style={{
                  background: '#162235',
                  color: 'var(--eco-teal)',
                  border: '1px solid #2B3D58',
                  borderRadius: '6px',
                  padding: '2px 7px',
                  fontSize: '11px',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {activeParamDisplay}
              </span>
            </div>
          ) : (
            <div
              className="header-station-badge header-badge-empty"
              style={{
                color: 'var(--eco-text-muted)',
                fontSize: '13px',
                flexShrink: 0,
              }}
            >
              <span className="station-badge-icon" aria-hidden="true">🛰️</span>
              <span>No station selected</span>
            </div>
          )}

          {/* Quick Search Shortcut Pill */}
          <button
            type="button"
            className="desktop-only search-shortcut-pill"
            onClick={() => onSelectSection?.('investigate')}
            aria-label="Search monitoring stations in Telemetry"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '34px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--eco-border-subtle)',
              background: 'var(--eco-bg-card-subtle)',
              color: 'var(--eco-text-subtle)',
              fontSize: '12.5px',
              flexShrink: 1,
              cursor: 'pointer',
              minWidth: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--eco-text-muted)" strokeWidth="2" aria-hidden="true" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Search stations…</span>
            <span className="mono" style={{ fontSize: '10px', color: 'var(--eco-text-subtle)', border: '1px solid var(--eco-border-subtle)', borderRadius: '4px', padding: '1px 5px', flexShrink: 0 }}>
              ⌘K
            </span>
          </button>
        </div>

        {/* Right: Freshness Status Pill & System Controls */}
        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div
            className={`header-freshness-pill ${freshnessInfo.pillClass}`}
            title={freshnessInfo.tooltip}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              border: '1px solid var(--eco-border-subtle)',
              borderRadius: '999px',
              padding: '4px 10px',
              fontSize: '11px',
              letterSpacing: '.04em',
            }}
          >
            <span className="freshness-dot" aria-hidden="true" />
            <span className="freshness-text mono">{freshnessInfo.label}</span>
          </div>

          <span
            className="chip desktop-only"
            style={{ color: 'var(--eco-teal)', borderColor: 'var(--eco-teal-border)' }}
            title="OpenAQ v3 API Gateway Connected"
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--eco-teal)' }} />
            OpenAQ connected
          </span>

          <button
            type="button"
            className="btn desktop-only"
            aria-label="Alerts: 0 open alerts"
            style={{ width: '36px', height: '36px', minHeight: '36px', padding: 0, justifyContent: 'center' }}
            title="Network Diagnostics & System Notifications"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--eco-text-primary)" strokeWidth="1.8" aria-hidden="true">
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </button>

          <button
            type="button"
            className="btn desktop-only"
            aria-label="User Profile"
            style={{
              width: '36px',
              height: '36px',
              minHeight: '36px',
              padding: 0,
              justifyContent: 'center',
              borderRadius: '50%',
              color: 'var(--eco-lime)',
              fontFamily: 'Space Grotesk',
              fontWeight: 600,
            }}
            title="EHS Specialist Officer Session"
          >
            EH
          </button>
        </div>
      </div>
    </header>
  );
};
