import React, { useEffect } from 'react';
import type { NavSection, SectionId, LocationDetail } from '../types';

interface SidebarProps {
  sections: NavSection[];
  activeSection: SectionId;
  onSelectSection: (id: SectionId) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  selectedLocation?: LocationDetail | null;
  selectedParameter?: string;
}

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

  const getSectionIcon = (id: SectionId) => {
    switch (id) {
      case 'overview':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="7" height="9" x="3" y="3" rx="1" />
            <rect width="7" height="5" x="14" y="3" rx="1" />
            <rect width="7" height="9" x="14" y="12" rx="1" />
            <rect width="7" height="5" x="3" y="16" rx="1" />
          </svg>
        );
      case 'investigate':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="2" />
            <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
          </svg>
        );
      case 'anomalies':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        );
      case 'evidence':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        );
      case 'reports':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        );
      default:
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
    }
  };

  const getAccessibleAriaLabel = (section: NavSection) => {
    switch (section.id) {
      case 'investigate':
        return 'Investigate Station Telemetry';
      case 'anomalies':
        return 'Pollution Intelligence Anomaly Detection';
      case 'evidence':
        return 'Evidence & Data Quality Audit';
      case 'reports':
        return 'Investigation Reports & Environmental Action Plan';
      default:
        return section.label;
    }
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar-container ${isCollapsed ? 'collapsed' : ''} ${
          isMobileOpen ? 'mobile-open' : ''
        }`}
        aria-label="Application Navigation"
      >
        {/* Brand Header */}
        <div className="sidebar-brand-header">
          <div className="sidebar-brand">
            <div className="brand-logo-mark" aria-hidden="true">
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
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            {!isCollapsed && (
              <div className="brand-title-group">
                <h1>EcoSentinel</h1>
                <p className="brand-tagline">
                  Evidence-based environmental intelligence · India Air Quality
                </p>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            className="sidebar-collapse-btn desktop-only"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {isCollapsed ? (
                <polyline points="13 17 18 12 13 7" />
              ) : (
                <polyline points="11 17 6 12 11 7" />
              )}
            </svg>
          </button>

          {/* Mobile Close Button */}
          <button
            type="button"
            className="sidebar-close-btn mobile-only"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Primary Navigation Sections */}
        <nav
          className="sidebar-nav"
          role="tablist"
          aria-label="Dashboard primary views"
        >
          {sections.map((section) => {
            const isActive = activeSection === section.id;
            const ariaLabel = getAccessibleAriaLabel(section);

            return (
              <button
                key={section.id}
                role="tab"
                id={`sidebar-tab-${section.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${section.id}`}
                aria-label={ariaLabel}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectSection(section.id);
                  onCloseMobile();
                }}
                title={isCollapsed ? section.label : undefined}
              >
                <span className="sidebar-nav-icon">{getSectionIcon(section.id)}</span>
                {!isCollapsed && (
                  <div className="sidebar-nav-content">
                    <span className="sidebar-nav-label">{section.label}</span>
                    <span className="sidebar-nav-sub">{section.shortDescription}</span>
                  </div>
                )}
                {!isCollapsed && section.statusBadge && (
                  <span
                    className={`sidebar-nav-badge ${
                      isActive ? 'badge-active' : ''
                    }`}
                  >
                    {section.statusBadge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Selected Station Telemetry Context (Sidebar Footer) */}
        {!isCollapsed && selectedLocation && (
          <div className="sidebar-station-widget">
            <div className="sidebar-widget-label">Active Station</div>
            <div className="sidebar-widget-station" title={selectedLocation.name}>
              Node #{selectedLocation.id} · {selectedLocation.name}
            </div>
            <div className="sidebar-widget-meta">
              <span>{selectedLocation.locality || 'India'}</span>
              {selectedParameter && (
                <span className="sidebar-widget-param">
                  {selectedParameter.toLowerCase() === 'pm25'
                    ? 'PM2.5'
                    : selectedParameter.toLowerCase() === 'pm10'
                    ? 'PM10'
                    : selectedParameter.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
