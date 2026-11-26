import React from 'react';
import { DEFAULT_SUPPORTIVE_DUST_CONTROLS } from './dossierText';
import styles from './ActionPlan.module.css';

export interface DustSuppressionSectionProps {
  isSuppressed: boolean;
  checkedControls: Record<string, boolean>;
  onToggleControl: (controlText: string) => void;
}

/**
 * Fugitive dust control benchmarks (US EPA AP-42) and interactive facility checklist.
 */
export const DustSuppressionSection: React.FC<DustSuppressionSectionProps> = ({
  isSuppressed,
  checkedControls,
  onToggleControl,
}) => {
  return (
    <div className={isSuppressed ? styles.suppressedBlock : undefined}>
      <h4 className={styles.subSectionTitle}>
        <span className={`card-icon ${styles.iconBox}`} aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          </svg>
        </span>
        2. Fugitive Dust Mitigation Guidance (CPCB / US EPA AP-42)
      </h4>

      <div className={`empty-state-meta-box ${styles.fullWidthMeta} ${styles.disclaimerSpacing}`}>
        <div className="meta-item">
          <span className="meta-label">Surface Watering Control Efficiency</span>
          <span className={`meta-val ${styles.dustMetaVal}`}>50% – 70% lift-off reduction</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Primary Regulatory Standard</span>
          <span className="meta-val">US EPA AP-42 §13.2.2 &amp; CPCB Guidelines (Nov 2017)</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Calculated PM10 Mass Avoided</span>
          <span className="meta-val font-mono">N/A (Geotechnical data unmeasured)</span>
        </div>
      </div>

      <div className={`chart-disclaimer ${styles.disclaimerSpacing}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>
          <strong>Efficiency Scope &amp; Mass Boundary:</strong> The 50%–70% control efficiency applies <em>strictly to unpaved-road surface watering</em> maintaining approximately twice baseline surface moisture under US EPA AP-42 §13.2.2 conditions. Effectiveness declines as moisture evaporates and traffic continues. Kilograms of PM10 avoided are not calculated because reliable mass quantification requires site-specific surface silt percentage, vehicle gross weights, and vehicle-kilometres travelled.
        </span>
      </div>

      <p className={styles.checklistLabel}>
        Site Operational Controls (Check confirmed measures for inclusion in Facility Dossier):
      </p>

      <ul className={`checklist ${styles.checklistSpacing}`}>
        {DEFAULT_SUPPORTIVE_DUST_CONTROLS.map((controlText, idx) => (
          <li key={idx} className={`checklist-item ${styles.checklistItemAligned}`}>
            <input
              type="checkbox"
              id={`dust-ctrl-${idx}`}
              checked={Boolean(checkedControls[controlText])}
              disabled={isSuppressed}
              onChange={() => onToggleControl(controlText)}
              className={`${styles.checkbox} ${isSuppressed ? styles.checkboxDisabled : ''}`}
            />
            <label
              htmlFor={`dust-ctrl-${idx}`}
              className={`${styles.checkboxLabel} ${isSuppressed ? styles.checkboxLabelDisabled : ''}`}
            >
              {controlText}
            </label>
          </li>
        ))}
      </ul>

      <p className={styles.inputHint}>
        *Note: Supportive operational controls represent mandatory procedural practices under CPCB/CAQM rules to prevent dust re-suspension and mud track-out; they do not add separate additive percentage reductions.
      </p>
    </div>
  );
};

