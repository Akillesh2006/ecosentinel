import React from 'react';
import styles from './Footer.module.css';

/**
 * Application footer emphasizing non-fabrication and source attribution principles.
 */
export const Footer: React.FC = () => {
  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.inner}>
        <div>
          <span className={styles.brandLine}>
            <strong>EcoSentinel</strong> — Evidence-based environmental intelligence.
          </span>
          <div className={styles.sub}>
            Built with React, TypeScript, Vite &amp; FastAPI. Uses OpenAQ v3, CPCB NAAQS (2009), and WHO AQG (2021).
          </div>
        </div>
        <nav className={styles.links} aria-label="Architecture principles">
          <span className={styles.linkItem}>No Interpolated Gaps</span>
          <span className={styles.linkItem}>75% Completeness Gate</span>
          <span className={styles.linkItem}>Screening Support Only</span>
        </nav>
      </div>
    </footer>
  );
};
