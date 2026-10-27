import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="footer-wrapper" role="contentinfo">
      <div className="footer-inner">
        <div>
          <strong>EcoSentinel</strong> — Evidence-based environmental intelligence.
          <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Milestone 1: Project Foundation. Built with React, TypeScript, Vite &amp; FastAPI.
          </div>
        </div>
        <nav className="footer-links" aria-label="Footer links">
          <span className="footer-link">Software-only Architecture</span>
          <span className="footer-link">No Fabricated Metrics</span>
          <span className="footer-link">PostgreSQL Planned</span>
        </nav>
      </div>
    </footer>
  );
};
