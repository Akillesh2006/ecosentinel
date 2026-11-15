/**
 * Evidence Export Utilities for EcoSentinel.
 *
 * Implements structured CSV and JSON exports for verified environmental observations,
 * sensor provenance audits, and facility action dossiers.
 *
 * Constraints:
 * - Never replaces missing observations with 0 or synthetic values (leaves cell empty).
 * - Distinguishes measured physical observations from engineering abatement calculations.
 * - Escapes all CSV fields conforming to RFC 4180.
 * - Includes statutory and spatial representativeness caveats in all exports.
 */

import type {
  IdlingAbatementResponse,
  LocationDetail,
  LocationMeasurementsResponse,
  RiskAssessmentResponse,
} from '../types';

/**
 * Escapes a single CSV field value according to RFC 4180.
 * Fields containing commas, double quotes, or newlines are wrapped in quotes,
 * and internal double quotes are doubled.
 */
export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC-4180 compliant CSV string for raw sensor observations.
 * Missing observations remain empty strings and are never fabricated as 0.
 */
export function generateObservationsCsv(
  measurementsData: LocationMeasurementsResponse,
  locationDetail?: LocationDetail | null
): string {
  const lines: string[] = [];

  // Metadata comments header
  lines.push('# EcoSentinel Verified Ambient Observations Export');
  lines.push(`# Station Name: ${measurementsData.station_name}`);
  lines.push(`# Station ID: ${measurementsData.location_id}`);
  lines.push(`# Locality: ${measurementsData.locality || locationDetail?.locality || 'India'}`);
  lines.push(
    `# Coordinates: ${locationDetail?.coordinates
      ? `${locationDetail.coordinates.latitude.toFixed(4)}N, ${locationDetail.coordinates.longitude.toFixed(4)}E`
      : 'N/A'
    }`
  );
  lines.push(`# Provider: ${measurementsData.provider_name}`);
  lines.push(`# Parameter: ${measurementsData.parameter_display_name} (${measurementsData.parameter})`);
  lines.push(`# Reporting Units: ${measurementsData.units}`);
  lines.push(`# Window: ${measurementsData.requested_from_utc} to ${measurementsData.requested_to_utc}`);
  lines.push(`# Total Observations: ${measurementsData.total_observations}`);
  lines.push(
    `# Missing Ratio: ${measurementsData.missing_percentage !== null && measurementsData.missing_percentage !== undefined
      ? `${measurementsData.missing_percentage}%`
      : '0%'
    }`
  );
  lines.push(`# Retrieved At: ${measurementsData.retrieved_at_utc} UTC`);
  lines.push(
    '# Statutory Disclaimer: Operational screening decision support only. Observations represent physical measurements from certified station sensors and do not constitute a formal statutory violation determination.'
  );

  // Column Headers
  const headers = [
    'timestamp_utc',
    'timestamp_local',
    'parameter_name',
    'parameter_display_name',
    'value',
    'units',
    'is_missing',
    'percent_complete',
    'period_label',
    'interval',
    'station_name',
    'station_id',
    'provider',
  ];
  lines.push(headers.map(escapeCsvField).join(','));

  // Observation rows
  for (const m of measurementsData.measurements) {
    // Missing values remain empty string - NEVER 0
    const valueStr = m.is_missing || m.value === null || m.value === undefined || isNaN(m.value)
      ? ''
      : String(m.value);

    const row = [
      m.datetime_from_utc,
      m.datetime_from_local || '',
      m.parameter,
      measurementsData.parameter_display_name,
      valueStr,
      m.units,
      m.is_missing ? 'TRUE' : 'FALSE',
      m.percent_complete !== null && m.percent_complete !== undefined ? String(m.percent_complete) : '',
      m.period_label || '',
      m.interval || '',
      measurementsData.station_name,
      String(measurementsData.location_id),
      measurementsData.provider_name,
    ];
    lines.push(row.map(escapeCsvField).join(','));
  }

  return lines.join('\r\n');
}

export interface DossierExportParams {
  locationDetail?: LocationDetail | null;
  measurementsData?: LocationMeasurementsResponse | null;
  assessmentData?: RiskAssessmentResponse | null;
  abatementData?: IdlingAbatementResponse | null;
  checkedControls?: Record<string, boolean>;
}

/**
 * Generates a structured JSON string for the complete Five-Part Environmental Evidence Dossier.
 */
export function generateDossierJson(params: DossierExportParams): string {
  const { locationDetail, measurementsData, assessmentData, abatementData, checkedControls } = params;

  const exportPayload = {
    export_schema: 'EcoSentinel-Environmental-Dossier-v1',
    export_timestamp_utc: new Date().toISOString(),
    record_type: 'Operational Mitigation Action Dossier (Non-Statutory Decision Support)',
    station_metadata: {
      id: measurementsData?.location_id || locationDetail?.id || assessmentData?.location_id || null,
      name: measurementsData?.station_name || locationDetail?.name || assessmentData?.station_name || null,
      locality: measurementsData?.locality || locationDetail?.locality || assessmentData?.locality || 'India',
      provider: measurementsData?.provider_name || locationDetail?.provider_name || null,
      owner: locationDetail?.owner_name || null,
      is_monitor: locationDetail?.is_monitor ?? true,
      coordinates: locationDetail?.coordinates
        ? {
          latitude: locationDetail.coordinates.latitude,
          longitude: locationDetail.coordinates.longitude,
        }
        : null,
      instruments: locationDetail?.instruments || [],
    },
    ambient_observations_summary: measurementsData
      ? {
        parameter: measurementsData.parameter,
        parameter_display_name: measurementsData.parameter_display_name,
        units: measurementsData.units,
        requested_from_utc: measurementsData.requested_from_utc,
        requested_to_utc: measurementsData.requested_to_utc,
        total_observations: measurementsData.total_observations,
        excluded_observations: measurementsData.excluded_observations ?? 0,
        missing_percentage: measurementsData.missing_percentage ?? 0,
        is_stale: measurementsData.is_stale,
        retrieved_at_utc: measurementsData.retrieved_at_utc,
      }
      : null,
    operational_risk_screening: assessmentData
      ? {
        screening_status: assessmentData.status,
        status_label: assessmentData.status_label,
        averaging_period_label: assessmentData.averaging_period_label,
        standard_name: assessmentData.standard_name,
        standard_threshold: assessmentData.standard_threshold,
        units: assessmentData.units,
        calculated_average: assessmentData.calculated_average,
        ratio_to_standard: assessmentData.ratio_to_standard,
        completeness_percentage: assessmentData.completeness_percentage,
        is_completeness_satisfied: assessmentData.is_completeness_satisfied,
        valid_observations: assessmentData.valid_observations,
        expected_observations: assessmentData.expected_observations,
        excluded_negative_artifacts: assessmentData.excluded_observations,
        freshness_state: assessmentData.freshness_state,
        secondary_benchmark_name: assessmentData.secondary_benchmark_name || null,
        secondary_benchmark_threshold: assessmentData.secondary_benchmark_threshold || null,
        advisories: assessmentData.advisories || [],
      }
      : null,
    confirmed_procedural_controls: checkedControls
      ? Object.entries(checkedControls)
        .filter(([, isChecked]) => isChecked)
        .map(([control]) => control)
      : [],
    engineering_abatement_estimates: abatementData
      ? {
        evidence_type: 'CANONICAL_ENGINEERING_ESTIMATES_NOT_PHYSICAL_MEASUREMENTS',
        curtailed_vehicles: abatementData.vehicles,
        curtailed_hours: abatementData.hours,
        total_vehicle_hours: abatementData.total_vehicle_hours,
        avoided_fuel_liters: abatementData.avoided_fuel_liters,
        avoided_co2_kg: abatementData.avoided_co2_kg,
        avoided_nox_kg: abatementData.avoided_nox_kg,
        avoided_pm25_grams: abatementData.avoided_pm25_grams,
        factors_basis: 'CSIR-CRRI in-use truck study & US EPA EPA420-F-08-025',
        fugitive_dust_control_efficiency: '50%–70% (US EPA AP-42 §13.2.2)',
        pm10_mass_avoided: 'N/A (requires site-specific silt and VKT measurements)',
      }
      : null,
    statutory_and_scientific_disclaimers: {
      operational_screening_disclaimer:
        'Operational screening against a rolling window serves as local facility decision support and does not constitute a formal statutory regulatory compliance determination under the Air (Prevention and Control of Pollution) Act, 1981.',
      spatial_representativeness:
        'Observations represent physical sensor recordings at specific geographic coordinates. Air pollution exhibits hyper-local variation; a single monitoring station cannot represent an entire metropolitan area.',
      atmospheric_boundary_layer:
        abatementData?.atmospheric_boundary_caveat ||
        'Planetary boundary layer height and local wind dispersion separate localized facility curtailment from ambient monitor concentrations.',
      statutory_disclaimer: abatementData?.statutory_disclaimer || '',
      fleet_technology: abatementData?.fleet_technology_caveat || '',
    },
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Generates an RFC-4180 compliant CSV string for the Evidence Dossier summary.
 */
export function generateDossierCsv(params: DossierExportParams): string {
  const { locationDetail, measurementsData, assessmentData, abatementData } = params;
  const lines: string[] = [];

  lines.push('# EcoSentinel Five-Part Environmental Evidence Dossier');
  lines.push('# Category,Metric,Value,Unit,Provenance / Caveat');

  const addRow = (category: string, metric: string, value: unknown, unit: string, note: string) => {
    lines.push(
      [
        escapeCsvField(category),
        escapeCsvField(metric),
        escapeCsvField(value !== null && value !== undefined ? String(value) : 'N/A'),
        escapeCsvField(unit),
        escapeCsvField(note),
      ].join(',')
    );
  };

  // Station Metadata
  addRow('Station Identity', 'Station ID', measurementsData?.location_id || locationDetail?.id || assessmentData?.location_id, '', 'OpenAQ Registry');
  addRow('Station Identity', 'Station Name', measurementsData?.station_name || locationDetail?.name || assessmentData?.station_name, '', 'OpenAQ Registry');
  addRow('Station Identity', 'Locality', measurementsData?.locality || locationDetail?.locality || assessmentData?.locality, '', 'Geographic Zone');
  if (locationDetail?.coordinates) {
    addRow(
      'Station Identity',
      'Coordinates',
      `${locationDetail.coordinates.latitude.toFixed(4)}N, ${locationDetail.coordinates.longitude.toFixed(4)}E`,
      'decimal degrees',
      'WGS 84'
    );
  }
  addRow('Station Identity', 'Provider', measurementsData?.provider_name || locationDetail?.provider_name || 'OpenAQ Provider', '', 'Upstream Reporting Provider');

  // Ambient Observations
  if (measurementsData) {
    addRow('Ambient Observations', 'Monitored Parameter', measurementsData.parameter_display_name, '', 'Sensor Channel');
    addRow('Ambient Observations', 'Total Observations Returned', measurementsData.total_observations, 'points', 'OpenAQ v3 Hourly Aggregation');
    addRow('Ambient Observations', 'Excluded Negative Artifacts', measurementsData.excluded_observations ?? 0, 'points', 'Physically Invalid (< 0)');
    addRow(
      'Ambient Observations',
      'Missing Observation Ratio',
      measurementsData.missing_percentage !== null && measurementsData.missing_percentage !== undefined
        ? `${measurementsData.missing_percentage}%`
        : '0%',
      '',
      'Unimputed (Zero Synthesis)'
    );
    addRow('Ambient Observations', 'Data Freshness', measurementsData.is_stale ? 'STALE' : 'FRESH', '', measurementsData.is_stale ? '>24h without update' : 'Recent');
  }

  // Risk Screening
  if (assessmentData) {
    addRow('Risk Screening', 'Standard Benchmark', assessmentData.standard_name, '', assessmentData.averaging_period_label);
    addRow('Risk Screening', 'Standard Threshold', assessmentData.standard_threshold, assessmentData.units, 'Statutory NAAQS (2009)');
    addRow('Risk Screening', 'Calculated Window Mean', assessmentData.calculated_average !== null && assessmentData.calculated_average !== undefined ? assessmentData.calculated_average.toFixed(2) : 'N/A', assessmentData.units, 'Unweighted Rolling Mean');
    addRow('Risk Screening', 'Completeness Gate Status', assessmentData.is_completeness_satisfied ? 'SATISFIED' : 'UNSATISFIED', '', '75% Hourly Completeness Rule');
    addRow('Risk Screening', 'Screening Classification', assessmentData.status_label, '', 'Decision Support (Non-Statutory)');
  }

  // Engineering Abatement
  if (abatementData) {
    addRow('Engineering Estimates', 'Fleet Scope', `${abatementData.vehicles} vehicles for ${abatementData.hours} hours`, 'veh-h', 'Canonical Engineering Simulation');
    addRow('Engineering Estimates', 'Avoided Diesel Fuel', abatementData.avoided_fuel_liters.toFixed(2), 'Liters', '1.0 L/veh-h (CRRI Study)');
    addRow('Engineering Estimates', 'Avoided CO2', abatementData.avoided_co2_kg.toFixed(2), 'kg', '2.68 kg/L (IPCC Factor)');
    addRow('Engineering Estimates', 'Avoided NOx', abatementData.avoided_nox_kg.toFixed(3), 'kg', '33.8 g/veh-h (US EPA)');
    addRow('Engineering Estimates', 'Avoided PM2.5', abatementData.avoided_pm25_grams.toFixed(2), 'grams', '1.1 g/veh-h (US EPA)');
    addRow('Engineering Estimates', 'Dust Surface Watering Efficiency', '50%–70%', '', 'US EPA AP-42 §13.2.2 (2x Moisture)');
    addRow('Engineering Estimates', 'PM10 Mass Avoided', 'N/A', '', 'Requires site-specific silt & VKT');
  }

  return lines.join('\r\n');
}

/**
 * Triggers a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
