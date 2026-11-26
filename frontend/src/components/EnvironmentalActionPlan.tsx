import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type {
  AirQualityApiError,
  IdlingAbatementResponse,
  LocationDetail,
  LocationMeasurementsResponse,
  RiskAssessmentResponse,
} from '../types';
import { fetchAbatementEstimate } from '../services/api';
import { buildPlainTextDossier, DEFAULT_SUPPORTIVE_DUST_CONTROLS } from './action/dossierText';
import { ExportMenu } from './action/ExportMenu';
import { AntiIdlingCalculator } from './action/AntiIdlingCalculator';
import { DustSuppressionSection } from './action/DustSuppressionSection';
import styles from './action/ActionPlan.module.css';

interface EnvironmentalActionPlanProps {
  locationDetail: LocationDetail | null;
  measurementsData: LocationMeasurementsResponse | null;
  assessmentData?: RiskAssessmentResponse | null;
}

type DossierPartId = 'partA' | 'partB' | 'partC' | 'partD' | 'partE';

export const EnvironmentalActionPlan: React.FC<EnvironmentalActionPlanProps> = ({
  locationDetail,
  measurementsData,
  assessmentData,
}) => {
  const [vehicleInput, setVehicleInput] = useState<string>('10');
  const [hoursInput, setHoursInput] = useState<string>('2');
  const [validationError, setValidationError] = useState<string | null>(null);

  const [abatementData, setAbatementData] = useState<IdlingAbatementResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<AirQualityApiError | null>(null);

  const requestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [checkedControls, setCheckedControls] = useState<Record<string, boolean>>({
    [DEFAULT_SUPPORTIVE_DUST_CONTROLS[0]]: true,
    [DEFAULT_SUPPORTIVE_DUST_CONTROLS[1]]: true,
  });

  const [copied, setCopied] = useState<boolean>(false);
  const [openParts, setOpenParts] = useState<Record<DossierPartId, boolean>>({
    partA: true,
    partB: true,
    partC: true,
    partD: true,
    partE: true,
  });

  const togglePart = (part: DossierPartId) => {
    setOpenParts((prev) => ({ ...prev, [part]: !prev[part] }));
  };

  const isHistorical = Boolean(
    assessmentData &&
      (assessmentData.status === 'historical_data' || assessmentData.freshness_state === 'historical')
  );
  const isStale = Boolean(
    assessmentData &&
      (assessmentData.status === 'stale_data' || assessmentData.freshness_state === 'stale')
  );
  const isIncomplete = Boolean(
    assessmentData &&
      (!assessmentData.is_completeness_satisfied || assessmentData.status === 'insufficient_data')
  );
  const isUnsupported = Boolean(
    assessmentData && assessmentData.status === 'unsupported_parameter'
  );
  const isSuppressed = !assessmentData || isHistorical || isStale || isIncomplete || isUnsupported;

  const validateInputs = useCallback(
    (vStr: string, hStr: string): { valid: boolean; vehicles?: number; hours?: number; error?: string } => {
      const vTrimmed = vStr.trim();
      const hTrimmed = hStr.trim();

      if (!vTrimmed) {
        return { valid: false, error: 'Vehicle count must be an integer between 1 and 200.' };
      }
      const vNum = Number(vTrimmed);
      if (!Number.isInteger(vNum) || vNum < 1 || vNum > 200) {
        return { valid: false, error: 'Vehicle count must be an integer between 1 and 200.' };
      }

      if (!hTrimmed) {
        return { valid: false, error: 'Curtailed idling duration must be between 0.5 and 12.0 hours.' };
      }
      const hNum = Number(hTrimmed);
      if (isNaN(hNum) || hNum < 0.5 || hNum > 12.0) {
        return { valid: false, error: 'Curtailed idling duration must be between 0.5 and 12.0 hours.' };
      }

      return { valid: true, vehicles: vNum, hours: hNum };
    },
    []
  );

  useEffect(() => {
    if (isSuppressed) {
      setAbatementData(null);
      setValidationError(null);
      setApiError(null);
      setIsLoading(false);
      return;
    }

    const valResult = validateInputs(vehicleInput, hoursInput);
    if (!valResult.valid) {
      setValidationError(valResult.error || 'Invalid inputs.');
      setAbatementData(null);
      setApiError(null);
      setIsLoading(false);
      return;
    }

    setValidationError(null);
    setApiError(null);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const currentReqId = ++requestIdRef.current;
    setIsLoading(true);

    fetchAbatementEstimate(valResult.vehicles!, valResult.hours!, controller.signal)
      .then((res) => {
        if (currentReqId !== requestIdRef.current) return;
        setIsLoading(false);
        if (res.error) {
          setApiError(res.error);
          setAbatementData(null);
        } else if (res.data) {
          setAbatementData(res.data);
        }
      })
      .catch(() => {
        if (currentReqId !== requestIdRef.current) return;
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [vehicleInput, hoursInput, isSuppressed, validateInputs]);

  const toggleControl = (controlText: string) => {
    setCheckedControls((prev) => ({
      ...prev,
      [controlText]: !prev[controlText],
    }));
  };

  const isEstimateSynchronized = Boolean(
    abatementData &&
      !validationError &&
      !isLoading &&
      abatementData.vehicles === Number(vehicleInput.trim()) &&
      abatementData.hours === Number(hoursInput.trim())
  );

  const handleCopyDossier = () => {
    if (!assessmentData || !isEstimateSynchronized || isSuppressed || !abatementData) return;
    const fullDossierText = buildPlainTextDossier({
      assessmentData,
      abatementData,
      locationDetail,
      measurementsData,
      checkedControls,
    });
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(fullDossierText)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        })
        .catch(() => {});
    }
  };

  return (
    <div className={`card ${styles.actionCard}`}>
      <div className={styles.actionHeader}>
        <div>
          <div className="station-badges">
            <span className="pill-tag pill-active">Operational Abatement Module</span>
            <span className="pill-tag">Evidence-Based Action Plan</span>
            <span className="pill-tag">Canonical Abatement Engine</span>
          </div>
          <h3 className={`card-title ${styles.summaryTitle}`}>
            Facility Environmental Action Plan &amp; Abatement Dossier
          </h3>
          <p className={styles.summarySubtitle}>
            Translates verified monitoring evidence into auditable on-site emissions curtailment and procedural dust-suppression controls.
          </p>
        </div>

        <ExportMenu
          disabled={isSuppressed || !isEstimateSynchronized || Boolean(validationError) || isLoading}
          copied={copied}
          onCopyDossier={handleCopyDossier}
          locationDetail={locationDetail}
          measurementsData={measurementsData}
          assessmentData={assessmentData}
          abatementData={abatementData}
          checkedControls={checkedControls}
        />
      </div>

      {isSuppressed && (
        <div className={`notice-banner ${styles.suppressionBanner}`} role="alert">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={styles.suppressionIcon}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <strong>Operational Action Planning Suppressed:</strong>{' '}
            {!assessmentData &&
              'No active air quality assessment loaded. Select a station and parameter in the Investigate tab.'}
            {isHistorical &&
              'Retrospective evaluation of historical baseline data. Live operational mitigation planning and emissions abatement calculations are strictly suppressed for past records to prevent acting on retrospective data.'}
            {isStale &&
              !isHistorical &&
              'Sensor observations have not updated within the past 24 hours. Live mitigation directives and abatement estimates are suppressed to prevent acting on outdated evidence.'}
            {isIncomplete &&
              !isStale &&
              !isHistorical &&
              `Evaluation window contains insufficient hourly observations (${assessmentData?.valid_observations}/${assessmentData?.expected_observations} hours, ${assessmentData?.completeness_percentage}%). EcoSentinel requires at least 75% completeness before activating operational mitigation directives.`}
            {isUnsupported && 'Parameter reporting units cannot be evaluated against statutory reference standards.'}
          </div>
        </div>
      )}

      {!isSuppressed && assessmentData && (
        <div
          className={`chart-disclaimer ${
            assessmentData.status === 'above_reference' ? styles.contextBannerAbove : styles.contextBannerNormal
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>
            {assessmentData.status === 'above_reference' ? (
              <>
                <strong>Active Mitigation Directive:</strong> Rolling ambient {assessmentData.parameter_display_name} at{' '}
                {assessmentData.station_name} exceeds statutory CPCB NAAQS limits by{' '}
                <strong>{assessmentData.ratio_to_standard}x</strong> ({assessmentData.calculated_average}{' '}
                {assessmentData.units} vs limit {assessmentData.standard_threshold} {assessmentData.units}). Implement the operational fleet and dust-control protocols below.
              </>
            ) : (
              <>
                <strong>Voluntary Baseline Efficiency Planner:</strong> Current ambient {assessmentData.parameter_display_name} is within statutory reference levels ({assessmentData.calculated_average} {assessmentData.units} ≤ {assessmentData.standard_threshold} {assessmentData.units}). This planner allows evaluating voluntary facility fleet anti-idling efficiency and dust-suppression practices.
              </>
            )}
          </span>
        </div>
      )}

      {/* Interactive 5-Part Dossier Accordion */}
      <div className={styles.accordionList}>
        {/* Part A: Measured Ambient Evidence */}
        <div className={`${styles.accordionItem} ${styles.accordionMeasured}`}>
          <button
            type="button"
            className={styles.accordionTrigger}
            aria-expanded={openParts.partA}
            onClick={() => togglePart('partA')}
          >
            <div className={styles.accordionTitleGroup}>
              <span className={styles.stepNum}>A</span>
              <span className={styles.accordionTitle}>Verified Ambient Evidence</span>
              <span className={styles.accordionTagMeasured}>Measured • OpenAQ v3</span>
            </div>
            {openParts.partA ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {openParts.partA && (
            <div className={styles.accordionBody}>
              <p className={styles.boundaryBody}>
                {assessmentData
                  ? `${assessmentData.station_name} (#${assessmentData.location_id}) • ${assessmentData.parameter_display_name} (${assessmentData.averaging_period_label}): ${
                      assessmentData.calculated_average !== null && assessmentData.calculated_average !== undefined
                        ? `${assessmentData.calculated_average.toFixed(2)} ${assessmentData.units}`
                        : 'Withheld'
                    } vs ${assessmentData.standard_name || 'CPCB NAAQS'} (${assessmentData.standard_threshold} ${assessmentData.standard_unit || assessmentData.units}).`
                  : 'Select a station in Stations to populate verified ambient evidence.'}
              </p>
            </div>
          )}
        </div>

        {/* Part B: Data Integrity & Provenance */}
        <div className={`${styles.accordionItem} ${styles.accordionMeasured}`}>
          <button
            type="button"
            className={styles.accordionTrigger}
            aria-expanded={openParts.partB}
            onClick={() => togglePart('partB')}
          >
            <div className={styles.accordionTitleGroup}>
              <span className={styles.stepNum}>B</span>
              <span className={styles.accordionTitle}>Data Integrity &amp; 75% Completeness Gate</span>
              <span className={styles.accordionTagMeasured}>Measured • Audit Gate</span>
            </div>
            {openParts.partB ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {openParts.partB && (
            <div className={styles.accordionBody}>
              <p className={styles.boundaryBody}>
                {assessmentData
                  ? `Valid hours: ${assessmentData.valid_observations}/${assessmentData.expected_observations} (${assessmentData.completeness_percentage.toFixed(1)}%) • Excluded negative artifacts: ${assessmentData.excluded_observations} • Freshness: ${assessmentData.freshness_state.toUpperCase()}.`
                  : '75% completeness gate (18/24h or 6/8h) and sensor recency status are verified before enabling abatement actions.'}
              </p>
            </div>
          )}
        </div>

        {/* Part C: Operational Mitigation & Dust Controls */}
        <div className={`${styles.accordionItem} ${styles.accordionModelled}`}>
          <button
            type="button"
            className={styles.accordionTrigger}
            aria-expanded={openParts.partC}
            onClick={() => togglePart('partC')}
          >
            <div className={styles.accordionTitleGroup}>
              <span className={styles.stepNum}>C</span>
              <span className={styles.accordionTitle}>Operational Mitigation &amp; Dust Suppression</span>
              <span className={styles.accordionTagModelled}>Modelled • AP-42 Checklist</span>
            </div>
            {openParts.partC ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {openParts.partC && (
            <div className={styles.accordionBody}>
              <DustSuppressionSection
                isSuppressed={isSuppressed}
                checkedControls={checkedControls}
                onToggleControl={toggleControl}
              />
            </div>
          )}
        </div>

        {/* Part D: Quantified Potential Abatement */}
        <div className={`${styles.accordionItem} ${styles.accordionModelled}`}>
          <button
            type="button"
            className={styles.accordionTrigger}
            aria-expanded={openParts.partD}
            onClick={() => togglePart('partD')}
          >
            <div className={styles.accordionTitleGroup}>
              <span className={styles.stepNum}>D</span>
              <span className={styles.accordionTitle}>Quantified Fleet Anti-Idling Abatement</span>
              <span className={styles.accordionTagModelled}>Modelled • Engineering Estimate</span>
            </div>
            {openParts.partD ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {openParts.partD && (
            <div className={styles.accordionBody}>
              <AntiIdlingCalculator
                vehicleInput={vehicleInput}
                hoursInput={hoursInput}
                isSuppressed={isSuppressed}
                validationError={validationError}
                apiError={apiError}
                isLoading={isLoading}
                isEstimateSynchronized={isEstimateSynchronized}
                abatementData={abatementData}
                onVehicleChange={setVehicleInput}
                onHoursChange={setHoursInput}
              />
            </div>
          )}
        </div>

        {/* Part E: Statutory & Atmospheric Caveats */}
        <div className={`${styles.accordionItem} ${styles.accordionCaveat}`}>
          <button
            type="button"
            className={styles.accordionTrigger}
            aria-expanded={openParts.partE}
            onClick={() => togglePart('partE')}
          >
            <div className={styles.accordionTitleGroup}>
              <span className={styles.stepNum}>E</span>
              <span className={styles.accordionTitle}>Statutory &amp; Atmospheric Caveats</span>
            </div>
            {openParts.partE ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {openParts.partE && (
            <div className={`${styles.accordionBody} ${styles.caveatsBlock}`}>
              <p className={styles.caveatPara}>
                <strong>Statutory Disclaimer:</strong> This operational action plan and abatement dossier represent an internal facility planning tool and do NOT constitute a statutory compliance certificate, legal regulatory determination, or official enforcement order under the <em>Air (Prevention and Control of Pollution) Act, 1981</em>.
              </p>
              <p>
                <strong>Atmospheric Scale Principle:</strong> Avoided emissions represent direct localized source reduction within the facility perimeter. Localized source curtailments eliminate on-site worker and boundary exposure, but will not predict or guarantee an immediate measurable concentration reduction at distant municipal ambient monitors governed by planetary boundary layer dynamics, thermal inversions, and regional background advection.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
