import React from 'react';
import { ChevronRight, Menu, Moon, Radio, Search, Sun } from 'lucide-react';
import type {
  LocationDetail,
  LocationMeasurementsResponse,
  NavSection,
  RiskAssessmentResponse,
  SectionId,
} from '../types';
import { useTheme } from '../context/ThemeContext';
import { Badge, type BadgeTone } from './ui/Badge';
import styles from './Header.module.css';

interface HeaderProps {
  sections?: NavSection[];
  activeSection: SectionId;
  onSelectSection?: (id: SectionId) => void;
  selectedLocation?: LocationDetail | null;
  measurementsData?: LocationMeasurementsResponse | null;
  assessmentData?: RiskAssessmentResponse | null;
  selectedParameter?: string;
  onToggleMobileMenu?: () => void;
  onOpenCommandPalette?: () => void;
}

interface FreshnessStatus {
  label: string;
  tone: BadgeTone;
  tooltip: string;
}

function computeObservationFreshness(
  timestampUtc?: string | null,
  freshnessState?: string | null
): FreshnessStatus {
  if (freshnessState === 'historical') {
    return {
      label: 'Historical Telemetry',
      tone: 'historical',
      tooltip: 'Station observation telemetry ceased >30 days ago (Retrospective Archive)',
    };
  }

  if (freshnessState === 'stale') {
    return {
      label: 'Stale Observation',
      tone: 'elevated',
      tooltip: 'Observations are >24 hours old; live operational screening is paused',
    };
  }

  if (!timestampUtc) {
    return {
      label: 'No Ingested Data',
      tone: 'muted',
      tooltip: 'No timestamped observations loaded yet for this sensor',
    };
  }

  const date = new Date(timestampUtc);
  const diffHours = (Date.now() - date.getTime()) / (3600 * 1000);

  if (diffHours <= 3.0) {
    return {
      label: 'Fresh Observation',
      tone: 'normal',
      tooltip: diffHours < 0 ? 'Current telemetry cycle' : `Updated ${Math.round(diffHours * 60)}m ago`,
    };
  }

  if (diffHours <= 24.0) {
    return {
      label: 'Delayed Observation',
      tone: 'elevated',
      tooltip: `Updated ${Math.round(diffHours)}h ago (within 24h window)`,
    };
  }

  if (diffHours <= 720.0) {
    return {
      label: 'Stale Observation',
      tone: 'elevated',
      tooltip: `Last reported ${Math.round(diffHours / 24)} days ago (>24h old)`,
    };
  }

  return {
    label: 'Historical Telemetry',
    tone: 'historical',
    tooltip: 'Observations ceased >30 days ago',
  };
}

function formatParamDisplay(param?: string | null): string {
  if (!param) return 'PM2.5';
  const lower = param.toLowerCase();
  if (lower === 'pm25' || lower === 'pm2.5') return 'PM2.5';
  if (lower === 'pm10') return 'PM10';
  if (lower === 'no2') return 'NO₂';
  if (lower === 'so2') return 'SO₂';
  if (lower === 'o3') return 'O₃';
  if (lower === 'co') return 'CO';
  return param.toUpperCase();
}

/**
 * Sticky application header with route breadcrumb, active station context,
 * sensor freshness indicator, Command Palette shortcut, and Dark/Light theme switcher.
 */
export const Header: React.FC<HeaderProps> = ({
  sections,
  activeSection,
  onSelectSection,
  selectedLocation,
  measurementsData,
  assessmentData,
  selectedParameter,
  onToggleMobileMenu,
  onOpenCommandPalette,
}) => {
  const { theme, toggleTheme } = useTheme();
  const activeSectionObj = sections?.find((s) => s.id === activeSection);
  const sectionTitle = activeSectionObj?.label || activeSection;

  const sensorTimestampUtc =
    measurementsData?.sensor_datetime_last_utc ||
    assessmentData?.sensor_datetime_last_utc ||
    selectedLocation?.datetime_last_utc;

  const freshnessInfo = computeObservationFreshness(
    sensorTimestampUtc,
    assessmentData?.freshness_state
  );

  const activeParamDisplay =
    measurementsData?.parameter_display_name ||
    assessmentData?.parameter_display_name ||
    formatParamDisplay(selectedParameter);

  return (
    <header className={styles.header} role="banner">
      <div className={styles.inner}>
        {/* Left: Mobile Drawer Trigger + Breadcrumb */}
        <div className={styles.left}>
          <button
            type="button"
            className={styles.mobileToggle}
            onClick={onToggleMobileMenu}
            aria-label="Toggle navigation menu"
          >
            <Menu size={18} />
          </button>

          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            {onSelectSection ? (
              <button
                type="button"
                className={styles.breadcrumbRoot}
                onClick={() => onSelectSection('overview')}
                title="Return to Home"
              >
                EcoSentinel
              </button>
            ) : (
              <span className={styles.breadcrumbRoot}>EcoSentinel</span>
            )}
            <span className={styles.breadcrumbSep} aria-hidden="true">
              <ChevronRight size={14} />
            </span>
            <span className={styles.breadcrumbCurrent}>{sectionTitle}</span>
          </nav>
        </div>

        {/* Center: Selected Station Context + Command Palette Trigger */}
        <div className={styles.center}>
          {selectedLocation ? (
            <div className={styles.stationBadge} title={selectedLocation.name}>
              <Radio size={13} className={styles.stationRadioIcon} aria-hidden="true" />
              <span className={styles.stationName}>Selected: {selectedLocation.name}</span>
              <span className={styles.stationParam}>{activeParamDisplay}</span>
            </div>
          ) : (
            <div className={`${styles.stationBadge} ${styles.stationEmpty}`.trim()}>
              <span>No station selected</span>
            </div>
          )}

          <button
            type="button"
            className={styles.searchTrigger}
            onClick={() => {
              if (onOpenCommandPalette) {
                onOpenCommandPalette();
              } else {
                onSelectSection?.('investigate');
              }
            }}
            aria-label="Open quick station and section search (Ctrl+K)"
          >
            <Search size={14} aria-hidden="true" />
            <span className={styles.searchText}>Jump to station or view…</span>
            <kbd className={styles.kbd}>⌘K</kbd>
          </button>
        </div>

        {/* Right: Freshness Status Pill & Theme Toggle */}
        <div className={styles.right}>
          <div className={styles.freshnessWrap} title={freshnessInfo.tooltip}>
            <Badge tone={freshnessInfo.tone} dot>
              {freshnessInfo.label}
            </Badge>
          </div>

          <button
            type="button"
            className={styles.themeBtn}
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </header>
  );
};
