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
      case 'spatial':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <circle cx="4" cy="6" r="2" />
            <circle cx="20" cy="6" r="2" />
            <circle cx="4" cy="18" r="2" />
            <circle cx="20" cy="18" r="2" />
            <line x1="6" y1="7" x2="10" y2="10.5" />
            <line x1="18" y1="7" x2="14" y2="10.5" />
            <line x1="6" y1="17" x2="10" y2="13.5" />
            <line x1="18" y1="17" x2="14" y2="13.5" />
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
      case 'spatial':
        return 'Multi-Station Spatial Comparison & Network Synchronization';
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
            <div className="brand-logo-mark" aria-hidden="true" style={{ background: 'transparent', border: 'none', padding: 0 }}>
              <svg width="34" height="34" viewBox="0 0 36 36" aria-hidden="true">
                <circle cx="18" cy="18" r="16.5" fill="none" stroke="var(--eco-teal)" strokeOpacity=".45" />
                <path d="M5 22c4-6 9-9 13-9s9 3 13 9" fill="none" stroke="var(--eco-lime)" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M9 26c3-3.5 6-5 9-5s6 1.5 9 5" fill="none" stroke="var(--eco-teal)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity=".8" />
                <circle cx="18" cy="13" r="2.6" fill="var(--eco-lime)" />
              </svg>
            </div>
            {!isCollapsed && (
              <div className="brand-title-group">
                <h1 className="disp" style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-.01em', margin: 0, color: 'var(--eco-text-primary)' }}>EcoSentinel</h1>
                <p className="brand-tagline lbl" style={{ fontSize: '9px', letterSpacing: '.14em', margin: 0, color: 'var(--eco-text-muted)' }}>
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
        {!isCollapsed && (
          <div className="lbl" style={{ padding: '8px 16px 2px', fontSize: '10px' }}>
            Workspaces
          </div>
        )}
        <nav
          className="sidebar-nav"
          role="tablist"
          aria-label="Dashboard primary views"
        >
          {sections.map((section, idx) => {
            const isActive = activeSection === section.id;
            const ariaLabel = getAccessibleAriaLabel(section);
            const numStr = `0${idx + 1}`;

            return (
              <button
                key={section.id}
                role="tab"
                id={`sidebar-tab-${section.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${section.id}`}
                aria-label={ariaLabel}
                className={`sidebar-nav-item ${isActive ? 'active nav-on' : ''}`}
                onClick={() => {
                  onSelectSection(section.id);
                  onCloseMobile();
                }}
                title={isCollapsed ? section.label : undefined}
                style={{
                  position: 'relative',
                  borderRadius: '10px',
                  transition: 'background .2s, color .2s',
                  background: isActive ? '#162235' : 'transparent',
                  color: isActive ? 'var(--eco-text-primary)' : 'var(--eco-text-secondary)',
                  boxShadow: isActive ? 'inset 0 0 0 1px #2B3D58' : 'none',
                }}
              >
                {!isCollapsed && (
                  <span
                    className="mono"
                    style={{
                      fontSize: '11px',
                      color: isActive ? 'var(--eco-lime)' : 'var(--eco-text-subtle)',
                      minWidth: '18px',
                      fontWeight: 600,
                    }}
                  >
                    {numStr}
                  </span>
                )}
                <span className="sidebar-nav-icon">{getSectionIcon(section.id)}</span>
                {!isCollapsed && (
                  <div className="sidebar-nav-content" style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <span className="sidebar-nav-label" style={{ fontWeight: isActive ? 600 : 500 }}>{section.label}</span>
                    <span className="sidebar-nav-sub">{section.shortDescription}</span>
                  </div>
                )}
                {isActive && (
                  <span
                    className="pulse"
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: 'var(--eco-lime)',
                      flexShrink: 0,
                    }}
                  />
                )}
                {!isCollapsed && section.statusBadge && (
                  <span
                    className={`sidebar-nav-badge ${
                      isActive ? 'badge-active' : ''
                    }`}
                    style={
                      isActive
                        ? { background: 'rgba(163, 230, 53, 0.15)', color: 'var(--eco-lime)', border: '1px solid rgba(163, 230, 53, 0.3)' }
                        : undefined
                    }
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
          <div className="sidebar-station-widget" style={{ margin: '8px 12px', background: 'var(--eco-bg-card)', border: '1px solid var(--eco-border-subtle)', borderRadius: '12px' }}>
            <div className="sidebar-widget-label lbl" style={{ color: 'var(--eco-lime)', fontSize: '9.5px' }}>Active Station</div>
            <div className="sidebar-widget-station disp" title={selectedLocation.name} style={{ color: 'var(--eco-text-primary)', fontSize: '13px', fontWeight: 500 }}>
              Node #{selectedLocation.id} · {selectedLocation.name}
            </div>
            <div className="sidebar-widget-meta mono" style={{ fontSize: '11px', color: 'var(--eco-text-muted)' }}>
              <span>{selectedLocation.locality || 'India'}</span>
              {selectedParameter && (
                <span className="sidebar-widget-param" style={{ background: '#162235', color: 'var(--eco-teal)', border: '1px solid var(--eco-border-subtle)', borderRadius: '4px', padding: '1px 5px' }}>
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

        {/* System Diagnostic Status Strip */}
        {!isCollapsed && (
          <div
            style={{
              marginTop: 'auto',
              padding: '16px 14px 10px',
              borderTop: '1px solid var(--eco-border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div className="lbl" style={{ fontSize: '9.5px', color: 'var(--eco-text-muted)' }}>System</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--eco-text-secondary)' }}>OpenAQ v3</span>
              <span className="mono" style={{ color: 'var(--eco-teal)', fontSize: '11px' }}>● reachable</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--eco-text-secondary)' }}>FastAPI backend</span>
              <span className="mono" style={{ color: 'var(--eco-teal)', fontSize: '11px' }}>● active</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--eco-text-secondary)' }}>Release</span>
              <span className="mono" style={{ color: 'var(--eco-text-muted)', fontSize: '11px' }}>v0.1.0 · M7</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginTop: '6px',
                padding: '8px 10px',
                borderRadius: '10px',
                background: 'var(--eco-bg-card)',
                border: '1px solid var(--eco-border-subtle)',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#1E293B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Space Grotesk',
                  fontWeight: 600,
                  fontSize: '11px',
                  color: 'var(--eco-lime)',
                }}
              >
                EH
              </div>
              <div style={{ lineHeight: 1.25 }}>
                <div style={{ fontSize: '12px', color: 'var(--eco-text-primary)', fontWeight: 500 }}>Officer Session</div>
                <div className="lbl" style={{ fontSize: '9px', color: 'var(--eco-text-muted)' }}>EHS Specialist</div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
