import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Home,
  Moon,
  Radio,
  Share2,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import type { HealthState, LocationDetail, SectionId } from '../types';
import type { RouteSection } from '../config/navigation';
import { useTheme } from '../context/ThemeContext';
import { Badge } from './ui/Badge';
import styles from './Sidebar.module.css';

interface SidebarProps {
  sections: RouteSection[];
  activeSection: SectionId;
  onSelectSection?: (id: SectionId) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  selectedLocation?: LocationDetail | null;
  selectedParameter?: string;
  health?: HealthState;
}

function getSectionIcon(id: SectionId) {
  switch (id) {
    case 'overview':
      return <Home size={18} />;
    case 'investigate':
      return <Radio size={18} />;
    case 'anomalies':
      return <Activity size={18} />;
    case 'spatial':
      return <Share2 size={18} />;
    case 'evidence':
      return <ShieldCheck size={18} />;
    case 'reports':
      return <ClipboardCheck size={18} />;
    default:
      return <Home size={18} />;
  }
}

function formatParamBadge(param?: string): string {
  if (!param) return '';
  const lower = param.toLowerCase();
  if (lower === 'pm25' || lower === 'pm2.5') return 'PM2.5';
  if (lower === 'pm10') return 'PM10';
  if (lower === 'no2') return 'NO₂';
  if (lower === 'so2') return 'SO₂';
  if (lower === 'o3') return 'O₃';
  return param.toUpperCase();
}

/**
 * Primary navigation rail with React Router deep links, active station card,
 * and collapsible desktop / mobile drawer support.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  sections,
  activeSection,
  onSelectSection,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  selectedLocation,
  selectedParameter,
  health,
}) => {
  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileOpen, onCloseMobile]);

  const routerLocation = useLocation();
  const { theme, toggleTheme } = useTheme();
  const backendConnected = Boolean(health && !health.isLoading && health.data && !health.error);

  return (
    <>
      {isMobileOpen && (
        <div className={styles.backdrop} onClick={onCloseMobile} aria-hidden="true" />
      )}

      <aside
        className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''} ${
          isMobileOpen ? styles.mobileOpen : ''
        }`.trim()}
        aria-label="Application Navigation"
      >
        {/* Brand Header */}
        <div className={styles.brandHeader}>
          <NavLink
            to={{ pathname: '/', search: routerLocation.search }}
            className={styles.brand}
            onClick={onCloseMobile}
          >
            <svg width="32" height="32" viewBox="0 0 36 36" aria-hidden="true" style={{ flexShrink: 0 }}>
              <circle cx="18" cy="18" r="16.5" fill="none" stroke="var(--eco-teal)" strokeOpacity="0.5" />
              <path d="M5 22c4-6 9-9 13-9s9 3 13 9" fill="none" stroke="var(--eco-lime)" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M9 26c3-3.5 6-5 9-5s6 1.5 9 5" fill="none" stroke="var(--eco-teal)" strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.85" />
              <circle cx="18" cy="13" r="2.6" fill="var(--eco-lime)" />
            </svg>
            {!isCollapsed && (
              <div className={styles.brandText}>
                <h1 className={styles.brandTitle}>EcoSentinel</h1>
                <p className={styles.brandTagline}>India Air Quality</p>
              </div>
            )}
          </NavLink>

          <button
            type="button"
            className={`${styles.iconBtn} ${styles.desktopOnly}`}
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          <button
            type="button"
            className={`${styles.iconBtn} ${styles.mobileOnly}`}
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Links */}
        {!isCollapsed && <div className={styles.groupLabel}>Workspaces</div>}

        <nav className={styles.nav} aria-label="Dashboard workspaces">
          {sections.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <NavLink
                key={section.id}
                to={{ pathname: section.path, search: routerLocation.search }}
                end={section.path === '/'}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`.trim()}
                onClick={(e) => {
                  if (
                    onSelectSection &&
                    !e.metaKey &&
                    !e.ctrlKey &&
                    !e.shiftKey &&
                    !e.altKey &&
                    e.button === 0
                  ) {
                    e.preventDefault();
                    onSelectSection(section.id);
                  }
                  onCloseMobile();
                }}
                title={section.shortDescription || section.label}
                aria-label={section.label}
              >
                <span className={styles.navIcon} aria-hidden="true">
                  {getSectionIcon(section.id)}
                </span>
                {!isCollapsed && (
                  <span className={styles.navLabel}>{section.label}</span>
                )}
                {isActive && !isCollapsed && <span className={`${styles.activeDot} eco-pulse`} aria-hidden="true" />}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Compact Station Chip, Theme Toggle & Server Status */}
        <div className={styles.bottomStack}>
          {!isCollapsed && selectedLocation && (
            <div className={styles.stationChip} title={`${selectedLocation.name} (${selectedLocation.locality || 'India'})`}>
              <span className={styles.chipDot} aria-hidden="true" />
              <span className={styles.chipName}>
                #{selectedLocation.id} · {selectedLocation.name}
              </span>
              {selectedParameter && (
                <span className={styles.widgetParam}>{formatParamBadge(selectedParameter)}</span>
              )}
            </div>
          )}

          <div className={styles.footerRow}>
            {!isCollapsed && (
              <Badge tone={health?.isLoading ? 'info' : backendConnected ? 'normal' : 'muted'} dot>
                {health?.isLoading ? 'Waking…' : backendConnected ? 'Live' : 'Standby'}
              </Badge>
            )}
            <button
              type="button"
              className={styles.themeToggleBtn}
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              {!isCollapsed && <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
