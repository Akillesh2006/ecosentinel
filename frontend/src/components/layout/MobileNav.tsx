import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  ClipboardCheck,
  Home,
  Menu,
  Radio,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import type { SectionId } from '../../types';
import type { RouteSection } from '../../config/navigation';
import styles from './MobileNav.module.css';

export interface MobileNavProps {
  sections: RouteSection[];
  activeSection: SectionId;
  onOpenDrawer: () => void;
}

function getMobileIcon(id: SectionId) {
  switch (id) {
    case 'overview':
      return <Home size={17} />;
    case 'investigate':
      return <Radio size={17} />;
    case 'anomalies':
      return <Activity size={17} />;
    case 'spatial':
      return <Share2 size={17} />;
    case 'evidence':
      return <ShieldCheck size={17} />;
    case 'reports':
      return <ClipboardCheck size={17} />;
    default:
      return <Home size={17} />;
  }
}

/**
 * Sticky bottom navigation bar displayed on mobile viewports (360 px - 768 px)
 * preserving shared URL search parameters across views.
 */
export const MobileNav: React.FC<MobileNavProps> = ({
  sections,
  activeSection,
  onOpenDrawer,
}) => {
  const location = useLocation();
  const primaryTabs = sections.slice(0, 5);

  return (
    <nav className={styles.mobileNav} aria-label="Mobile quick navigation">
      {primaryTabs.map((section) => {
        const isActive = activeSection === section.id;
        return (
          <NavLink
            key={section.id}
            to={{ pathname: section.path, search: location.search }}
            className={`${styles.tabLink} ${isActive ? styles.tabLinkActive : ''}`.trim()}
          >
            <span aria-hidden="true">{getMobileIcon(section.id)}</span>
            <span className={styles.tabLabel}>
              {section.id === 'spatial' ? 'Compare' : section.id === 'evidence' ? 'Quality' : section.label}
            </span>
          </NavLink>
        );
      })}
      <button
        type="button"
        className={styles.tabLink}
        onClick={onOpenDrawer}
        aria-label="Open full workspace menu"
      >
        <Menu size={17} aria-hidden="true" />
        <span className={styles.tabLabel}>More</span>
      </button>
    </nav>
  );
};

