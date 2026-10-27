import React from 'react';
import type { NavSection, SectionId } from '../types';

interface HeaderProps {
  sections: NavSection[];
  activeSection: SectionId;
  onSelectSection: (id: SectionId) => void;
}

export const Header: React.FC<HeaderProps> = ({
  sections,
  activeSection,
  onSelectSection,
}) => {
  return (
    <header className="header-wrapper" role="banner">
      <div className="header-inner">
        <div className="brand-section">
          <div className="brand-logo-mark" aria-hidden="true">
            <svg
              width="22"
              height="22"
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
          <div className="brand-title-group">
            <h1>
              EcoSentinel
              <span className="milestone-badge">Milestone 2A</span>
            </h1>
            <p className="brand-tagline">Evidence-based environmental intelligence · India Air Quality</p>
          </div>
        </div>

        <nav
          className="nav-tabs"
          role="tablist"
          aria-label="Dashboard sections"
        >
          {sections.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                role="tab"
                id={`tab-${section.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${section.id}`}
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => onSelectSection(section.id)}
              >
                <span>{section.label}</span>
                <span className="nav-tab-badge">
                  {section.statusBadge}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
