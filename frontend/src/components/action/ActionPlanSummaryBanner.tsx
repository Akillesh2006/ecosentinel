import React from 'react';
import type {
  LocationDetail,
  LocationMeasurementsResponse,
  RiskAssessmentResponse,
} from '../../types';
import { deriveAssessmentVerdict, type PlainVerdict } from '../../utils/verdict';
import { VerdictBanner } from '../ui/VerdictBanner';
import { Badge } from '../ui/Badge';
import { Disclosure } from '../ui/Disclosure';
import styles from './ActionPlan.module.css';

export interface ActionPlanSummaryBannerProps {
  locationDetail?: LocationDetail | null;
  measurementsData?: LocationMeasurementsResponse | null;
  assessmentData?: RiskAssessmentResponse | null;
}

const DOSSIER_PARTS = [
  'Situation Summary',
  'Completeness Gate',
  'Fleet Idling Model',
  'Dust Control Options',
  'RFC 4180 Exports',
];

/**
 * High-clarity Action Plan overview distinguishing verified physical ambient data from
 * assumption-based engineering mitigation calculators, paired with a five-part dossier roadmap.
 */
export const ActionPlanSummaryBanner: React.FC<ActionPlanSummaryBannerProps> = ({
  locationDetail,
  measurementsData,
  assessmentData,
}) => {
  const verdictFromAssess = deriveAssessmentVerdict(assessmentData);
  const verdict: PlainVerdict = verdictFromAssess ?? {
    tone: measurementsData ? 'normal' : 'muted',
    chipLabel: measurementsData ? 'Station Evidence Loaded' : 'Awaiting Telemetry',
    headline: measurementsData
      ? `Prepared compliance & mitigation context for ${measurementsData.station_name} (${measurementsData.parameter_display_name})`
      : 'Select a station in Stations to populate automated ambient context in exports',
    subline:
      'You can still run modelled engineering calculators below independently of ambient station selection.',
  };

  return (
    <div className={styles.wrap}>
      <VerdictBanner verdict={verdict} />

      {/* Explicit Separation: Ambient Evidence vs. Modelled Engineering Scenarios */}
      <div className={styles.boundaryGrid} role="note" aria-label="Evidence vs Modelled Scenario separation">
        <div className={styles.boundaryCard}>
          <div className={styles.boundaryTitle}>
            <span>Measured Ambient Evidence</span>
            <Badge tone={measurementsData ? 'normal' : 'muted'}>
              {locationDetail ? `#${locationDetail.id}` : 'OpenAQ v3'}
            </Badge>
          </div>
          <p className={styles.boundaryBody}>
            Hourly physical observations, UTC/IST timestamps, and server-governed CPCB/WHO benchmarks sourced strictly from OpenAQ v3 telemetry without interpolation.
          </p>
        </div>

        <div className={styles.boundaryCard}>
          <div className={styles.boundaryTitle}>
            <span>Modelled Engineering Estimates</span>
            <Badge tone="info">Scenario Tools</Badge>
          </div>
          <p className={styles.boundaryBody}>
            Fleet anti-idling and US EPA AP-42 paved/unpaved dust suppression worksheets estimate potential operational abatement only — never substitute for measured air quality.
          </p>
        </div>
      </div>

      {/* 5-Part Dossier Overview */}
      <div className={styles.stepperRow} aria-label="Five-part action dossier sections">
        {DOSSIER_PARTS.map((label, idx) => (
          <div key={label} className={styles.stepChip}>
            <span className={styles.stepNum}>{idx + 1}</span>
            <span style={{ fontWeight: 500, color: 'var(--eco-text-primary)' }}>{label}</span>
          </div>
        ))}
      </div>

      <Disclosure label="Show dossier scope & engineering model boundaries">
        <p style={{ margin: 0 }}>
          Downloads bundle your verified observations (RFC 4180 CSV with BOM-free strict quoting or structured JSON) alongside traceable metadata and regulatory limits. Fleet calculations require explicit vehicle counts (1–200) and idling durations (0.5–12 h/day) without silently clamping invalid inputs.
        </p>
      </Disclosure>
    </div>
  );
};

