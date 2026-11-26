import React from 'react';
import {
  Activity,
  ClipboardCheck,
  Radio,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import type { SectionId } from '../../types';
import styles from './Home.module.css';

export interface NextStepsGridProps {
  onNavigate: (section: SectionId) => void;
}

const WORKFLOW_CARDS: {
  id: SectionId;
  title: string;
  desc: string;
  cta: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'investigate',
    title: 'Station Telemetry & Time-Series',
    desc: 'Search live or archival OpenAQ sensors across India and inspect CPCB & WHO compliance.',
    cta: 'Launch Investigation →',
    icon: <Radio size={17} aria-hidden="true" />,
  },
  {
    id: 'anomalies',
    title: 'Pollution Intelligence & Anomalies',
    desc: 'Run non-parametric MAD leave-one-out statistics to spot sharp spikes and flatline sensors.',
    cta: 'Screen Anomalies →',
    icon: <Activity size={17} aria-hidden="true" />,
  },
  {
    id: 'spatial',
    title: 'Spatial Comparison & Neighbors',
    desc: 'Cross-check nearby stations within 50 km to tell isolated local plumes from regional haze.',
    cta: 'Compare Neighbors →',
    icon: <Share2 size={17} aria-hidden="true" />,
  },
  {
    id: 'evidence',
    title: 'Evidence & Provenance Audit',
    desc: 'Inspect the 75% completeness gate, sensor freshness, and excluded invalid measurements.',
    cta: 'Audit Evidence →',
    icon: <ShieldCheck size={17} aria-hidden="true" />,
  },
  {
    id: 'reports',
    title: 'Facility Action Plan & Reports',
    desc: 'Build a five-part mitigation dossier with AP-42 dust controls and RFC 4180 CSV/JSON exports.',
    cta: 'Generate Action Dossier →',
    icon: <ClipboardCheck size={17} aria-hidden="true" />,
  },
];

/**
 * Plain-language capability navigation cards covering all five downstream workspaces,
 * paired with EcoSentinel's strict non-fabrication and completeness guardrail notice.
 */
export const NextStepsGrid: React.FC<NextStepsGridProps> = ({ onNavigate }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--eco-space-4)' }}>
      <div className={styles.actionsGrid}>
        {WORKFLOW_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            className={styles.actionCard}
            onClick={() => onNavigate(card.id)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--eco-space-3)' }}>
              <span className={styles.actionIconWrap}>{card.icon}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className={styles.actionTitle}>{card.title}</span>
                <span className={styles.actionDesc}>{card.desc}</span>
              </div>
            </div>
            <span className={styles.actionFooter}>
              <span>{card.cta}</span>
            </span>
          </button>
        ))}
      </div>

      <div className={styles.integrityBar} role="note" aria-label="Scientific integrity guardrails">
        <strong style={{ color: 'var(--eco-text-primary)' }}>
          Evidence-First Scientific Safeguards
        </strong>
        <span>
          EcoSentinel strictly separates physical ambient measurements (OpenAQ v3) from modelled mitigation estimates, never zero-fills or interpolates missing hourly intervals, and enforces the CPCB 75% capture threshold before publishing statutory averages.
        </span>
      </div>
    </div>
  );
};
