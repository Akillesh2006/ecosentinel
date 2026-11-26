import type {
  IdlingAbatementResponse,
  LocationDetail,
  LocationMeasurementsResponse,
  RiskAssessmentResponse,
} from '../../types';

export const DEFAULT_SUPPORTIVE_DUST_CONTROLS = [
  'Scheduled haul-road dampening using treated wastewater (zero potable water wastage)',
  'Anti-smog mist cannon atomization (10–50 µm droplets directed at active aggregate piles)',
  'Vehicle egress wheel wash-down bays to prevent roadway mud track-out',
  'Speed restrictions (≤ 15–20 km/h) on unpaved site corridors to reduce kinetic dust resuspension',
  'Impermeable tarpaulin covers on inactive bulk material and soil stockpiles',
];

/**
 * Generates the formatted five-part plain-text Facility Environmental Action Dossier.
 */
export function buildPlainTextDossier(params: {
  assessmentData: RiskAssessmentResponse;
  abatementData: IdlingAbatementResponse;
  locationDetail: LocationDetail | null;
  measurementsData: LocationMeasurementsResponse | null;
  checkedControls: Record<string, boolean>;
}): string {
  const { assessmentData, abatementData, locationDetail, measurementsData, checkedControls } = params;

  const lines: string[] = [
    '================================================================================',
    'ECOSENTINEL FACILITY ENVIRONMENTAL ACTION & EVIDENCE DOSSIER',
    'Record Type: Operational Mitigation Action Plan (Not a Statutory Compliance Certificate)',
    `Station: ${assessmentData.station_name} (#${assessmentData.location_id})`,
    `Locality: ${assessmentData.locality || 'India'} | Provider: ${measurementsData?.provider_name || 'CPCB/OpenAQ'}`,
    `Coordinates: ${
      locationDetail?.coordinates
        ? `${locationDetail.coordinates.latitude.toFixed(4)}°N, ${locationDetail.coordinates.longitude.toFixed(4)}°E`
        : 'N/A'
    }`,
    `Dossier Timestamp: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC`,
    '================================================================================',
    '',
    '[PART A: VERIFIED AMBIENT EVIDENCE & SCREENING FINDING]',
    `- Pollutant Parameter: ${assessmentData.parameter_display_name} (${assessmentData.parameter})`,
    `- Reporting Unit: ${assessmentData.units}`,
    `- Averaging Period: ${assessmentData.averaging_period_label} rolling window`,
    `- Window Range: ${assessmentData.window_start_local || assessmentData.window_start_utc} to ${
      assessmentData.window_end_local || assessmentData.window_end_utc
    }`,
    `- Calculated Rolling Average: ${
      assessmentData.calculated_average !== null && assessmentData.calculated_average !== undefined
        ? `${assessmentData.calculated_average.toFixed(2)} ${assessmentData.units}`
        : 'N/A'
    }`,
    `- Statutory Reference Benchmark: ${assessmentData.standard_name || 'CPCB NAAQS (2009)'} = ${
      assessmentData.standard_threshold
    } ${assessmentData.standard_unit || assessmentData.units}`,
    `- Screening Status: ${assessmentData.status_label.toUpperCase()} (${
      assessmentData.ratio_to_standard ? `${assessmentData.ratio_to_standard}x reference threshold` : 'N/A'
    })`,
    assessmentData.secondary_benchmark_threshold
      ? `- Secondary Health Benchmark: ${assessmentData.secondary_benchmark_name || 'WHO AQG (2021)'} = ${
          assessmentData.secondary_benchmark_threshold
        } ${assessmentData.secondary_benchmark_unit} (${(
          assessmentData.calculated_average! / assessmentData.secondary_benchmark_threshold
        ).toFixed(2)}x guideline)`
      : '',
    '',
    '[PART B: DATA INTEGRITY & SENSOR PROVENANCE AUDIT]',
    `- Valid Hourly Observations: ${assessmentData.valid_observations} / ${assessmentData.expected_observations} expected (${assessmentData.completeness_percentage.toFixed(1)}% coverage)`,
    `- 75% Completeness Gate: ${assessmentData.is_completeness_satisfied ? 'SATISFIED' : 'UNSATISFIED'} (${assessmentData.completeness_rule_label})`,
    `- Excluded Negative Value Artifacts: ${assessmentData.excluded_observations} invalid points (< 0 ${assessmentData.units})`,
    `- Sensor Freshness: ${assessmentData.freshness_state.toUpperCase()} (latest sensor timestamp: ${
      assessmentData.sensor_datetime_last_local || assessmentData.sensor_datetime_last_utc || 'N/A'
    })`,
    `- Station Instrumentation: ${
      locationDetail?.instruments && locationDetail.instruments.length > 0
        ? locationDetail.instruments.join(', ')
        : 'Continuous Ambient Air Quality Monitoring Station (CAAQMS)'
    }`,
    '',
    '[PART C: OPERATIONAL MITIGATION PROTOCOLS]',
    '1. Facility Site Actions:',
  ];

  if (assessmentData.advisories && assessmentData.advisories.length > 0) {
    assessmentData.advisories.forEach((adv, idx) => {
      lines.push(`   1.${idx + 1} [${adv.category}] ${adv.action}`);
      lines.push(`       Rationale: ${adv.rationale}`);
      lines.push(`       Uncertainty: ${adv.uncertainty}`);
    });
  } else {
    lines.push('   (No emergency mitigation orders active for current screening status)');
  }

  lines.push('');
  lines.push('2. Confirmed Dust-Control Procedural Practices (CPCB / CAQM Mandates):');
  DEFAULT_SUPPORTIVE_DUST_CONTROLS.forEach((ctrl) => {
    lines.push(`   [${checkedControls[ctrl] ? 'X' : ' '}] ${ctrl}`);
  });

  lines.push('');
  lines.push('[PART D: QUANTIFIED POTENTIAL ABATEMENT (CANONICAL BACKEND ESTIMATES)]');
  lines.push(`- Configured Operational Scope: ${abatementData.vehicles} heavy commercial vehicles curtailed for ${abatementData.hours} hours`);
  lines.push(`- Total Operational Vehicle-Hours: ${abatementData.total_vehicle_hours.toFixed(1)} vehicle-hours`);
  lines.push(`- Estimated Fuel Saved: ${abatementData.avoided_fuel_liters.toFixed(2)} L (Factor: 1.0 L/veh-h | CSIR-CRRI in-use truck study)`);
  lines.push(`- Estimated CO2 Avoided: ${abatementData.avoided_co2_kg.toFixed(2)} kg (Factor: 2.68 kg/veh-h | 2006 IPCC Guidelines stoichiometry)`);
  lines.push(`- Estimated NOx Avoided: ${abatementData.avoided_nox_kg.toFixed(3)} kg (${abatementData.avoided_nox_grams.toFixed(1)} g) (Factor: 33.8 g/veh-h | US EPA EPA420-F-08-025 Table 1)`);
  lines.push(`- Estimated PM2.5 Avoided: ${abatementData.avoided_pm25_grams.toFixed(2)} g (Factor: 1.1 g/veh-h | US EPA EPA420-F-08-025 Table 1)`);
  lines.push('');
  lines.push('Fugitive Dust Control Benchmarks:');
  lines.push('- Surface Watering Control Efficiency: 50%–70% (US EPA AP-42 §13.2.2 for unpaved surfaces maintaining ~2x moisture)');
  lines.push('- PM10 Mass Avoided: N/A (calculating mass avoided requires site-specific silt, vehicle weight, and VKT measurements)');
  lines.push('');
  lines.push('[PART E: STATUTORY & ATMOSPHERIC CAVEATS]');
  lines.push(`* ${abatementData.statutory_disclaimer}`);
  lines.push(`* ${abatementData.atmospheric_boundary_caveat}`);
  lines.push(`* ${abatementData.fleet_technology_caveat}`);
  lines.push(`* ${assessmentData.spatial_disclaimer}`);
  lines.push('================================================================================');

  return lines.filter((l) => l !== '').join('\n');
}

