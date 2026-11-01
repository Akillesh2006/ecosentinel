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
            <div className="header-station-badge" title={selectedLocation.name}>
              <span className="station-badge-icon" aria-hidden="true">📍</span>
              <span className="station-badge-name">Selected: {selectedLocation.name}</span>
              {selectedLocation.locality && (
                <span className="station-badge-locality">
                  ({selectedLocation.locality})
                </span>
              )}
              <span className="station-badge-param">{activeParamDisplay}</span>
            </div>
          ) : (
            <div className="header-station-badge header-badge-empty">
              <span className="station-badge-icon" aria-hidden="true">🛰️</span>
              <span>No station selected</span>
            </div>
          )}
        </div>

        {/* Right: Freshness Status Pill */}
        <div className="header-right">
          <div
            className={`header-freshness-pill ${freshnessInfo.pillClass}`}
            title={freshnessInfo.tooltip}
          >
            <span className="freshness-dot" aria-hidden="true" />
            <span className="freshness-text">{freshnessInfo.label}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
