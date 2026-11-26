import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Clipboard, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import type {
  IdlingAbatementResponse,
  LocationDetail,
  LocationMeasurementsResponse,
  RiskAssessmentResponse,
} from '../../types';
import {
  downloadFile,
  generateDossierCsv,
  generateDossierJson,
  generateObservationsCsv,
} from '../../utils/exportEvidence';
import styles from './ActionPlan.module.css';

export interface ExportMenuProps {
  disabled: boolean;
  copied: boolean;
  onCopyDossier: () => void;
  locationDetail: LocationDetail | null;
  measurementsData: LocationMeasurementsResponse | null;
  assessmentData?: RiskAssessmentResponse | null;
  abatementData: IdlingAbatementResponse | null;
  checkedControls: Record<string, boolean>;
}

/**
 * Unified Export dropdown offering RFC 4180 CSV, JSON dossier, Summary CSV, and Clipboard copy.
 */
export const ExportMenu: React.FC<ExportMenuProps> = ({
  disabled,
  copied,
  onCopyDossier,
  locationDetail,
  measurementsData,
  assessmentData,
  abatementData,
  checkedControls,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const safeStation = (assessmentData?.station_name || measurementsData?.station_name || 'station')
    .replace(/[^a-z0-9_-]/gi, '_')
    .toLowerCase();
  const locId = assessmentData?.location_id || measurementsData?.location_id || 'station';

  return (
    <div ref={wrapRef} className={styles.exportWrap}>
      <button
        type="button"
        className={`btn-primary ${styles.exportTrigger}`}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Export Facility Action Dossier"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Download size={15} aria-hidden="true" />
        <span>{copied ? '✓ Dossier Copied to Clipboard' : 'Export Dossier'}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open && !disabled && (
        <div className={styles.exportMenu} role="menu" aria-label="Dossier export formats">
          <button
            type="button"
            role="menuitem"
            className={styles.exportMenuItem}
            onClick={() => {
              onCopyDossier();
              setOpen(false);
            }}
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Clipboard size={14} aria-hidden="true" />}
            <span>Copy Dossier to Clipboard</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className={styles.exportMenuItem}
            onClick={() => {
              const jsonStr = generateDossierJson({
                locationDetail,
                measurementsData,
                assessmentData,
                abatementData,
                checkedControls,
              });
              downloadFile(jsonStr, `ecosentinel_action_plan_${locId}_${safeStation}.json`, 'application/json');
              setOpen(false);
            }}
          >
            <FileJson size={14} aria-hidden="true" />
            <span>Download Dossier (JSON)</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className={styles.exportMenuItem}
            disabled={!measurementsData}
            onClick={() => {
              if (!measurementsData) return;
              const csv = generateObservationsCsv(measurementsData, locationDetail);
              downloadFile(
                csv,
                `ecosentinel_observations_${measurementsData.location_id}_${measurementsData.parameter}_${safeStation}.csv`,
                'text/csv'
              );
              setOpen(false);
            }}
          >
            <FileSpreadsheet size={14} aria-hidden="true" />
            <span>Download Observations (CSV)</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className={styles.exportMenuItem}
            onClick={() => {
              const csv = generateDossierCsv({ locationDetail, measurementsData, assessmentData });
              downloadFile(csv, `ecosentinel_dossier_summary_${locId}_${safeStation}.csv`, 'text/csv');
              setOpen(false);
            }}
          >
            <FileSpreadsheet size={14} aria-hidden="true" />
            <span>Download Dossier Summary (CSV)</span>
          </button>
        </div>
      )}
    </div>
  );
};

