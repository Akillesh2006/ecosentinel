import { describe, it, expect } from 'vitest';
import { deriveAssessmentVerdict, deriveAnomalyVerdict } from './verdict';
import type { AirQualityAnomalyResponse, RiskAssessmentResponse } from '../types';

const baseAssessment: RiskAssessmentResponse = {
  location_id: 8118,
  station_name: 'Anand Vihar, Delhi - DPCC',
  parameter: 'pm25',
  parameter_display_name: 'PM2.5',
  units: 'µg/m³',
  calculation_timestamp_utc: '2026-10-28T12:00:00Z',
  window_start_utc: '2026-10-27T12:00:00Z',
  window_end_utc: '2026-10-28T12:00:00Z',
  averaging_period_hours: 24,
  averaging_period_label: '24-hour',
  valid_observations: 22,
  expected_observations: 24,
  missing_observations: 2,
  excluded_observations: 0,
  completeness_percentage: 91.7,
  is_completeness_satisfied: true,
  completeness_rule_label: '75% gate',
  data_quality_warnings: [],
  calculated_average: 138.0,
  freshness_state: 'fresh',
  freshness_message: 'Fresh',
  standard_name: 'CPCB NAAQS (2009)',
  standard_threshold: 60,
  standard_unit: 'µg/m³',
  secondary_benchmark_name: 'WHO AQG (2021)',
  secondary_benchmark_threshold: 15,
  secondary_benchmark_unit: 'µg/m³',
  status: 'above_reference',
  status_label: 'Above Reference',
  ratio_to_standard: 2.3,
  screening_limitations: 'Operational screening only',
  regulatory_disclaimer: 'Not a statutory compliance determination',
  spatial_disclaimer: 'Single station',
  advisories: [],
};

describe('Plain-language verdict derivation', () => {
  it('explains above-limit result in plain English with CPCB ratio and WHO comparison', () => {
    const verdict = deriveAssessmentVerdict(baseAssessment)!;
    expect(verdict.tone).toBe('anomaly');
    expect(verdict.chipLabel).toBe('Above Indian Limit');
    expect(verdict.headline).toBe('PM2.5 is 2.3× the Indian limit and above WHO guidance');
  });

  it('explains below-75% completeness gate without guessing values', () => {
    const verdict = deriveAssessmentVerdict({
      ...baseAssessment,
      status: 'insufficient_data',
      completeness_percentage: 62.5,
      valid_observations: 15,
      is_completeness_satisfied: false,
      calculated_average: null,
      ratio_to_standard: null,
    })!;
    expect(verdict.tone).toBe('elevated');
    expect(verdict.headline).toContain('Not enough data to judge (63% of hours reported; 75% needed)');
  });

  it('keeps CO in ppm as Standard unavailable without converting units or inventing WHO line', () => {
    const verdict = deriveAssessmentVerdict({
      ...baseAssessment,
      parameter: 'co',
      parameter_display_name: 'CO',
      units: 'ppm',
      status: 'unavailable',
      status_label: 'Standard unavailable',
      standard_threshold: null,
      standard_unit: 'mg/m³',
      secondary_benchmark_threshold: null,
      secondary_benchmark_unit: null,
      calculated_average: null,
      ratio_to_standard: null,
    })!;
    expect(verdict.chipLabel).toBe('Standard Unavailable');
    expect(verdict.headline).toContain('reported in ppm; cannot compare directly to the Indian limit');
  });

  it('summarizes anomaly detection clearly for non-experts', () => {
    const mockAnomaly: AirQualityAnomalyResponse = {
      location_id: 8118,
      station_name: 'Anand Vihar',
      parameter: 'pm25',
      parameter_display_name: 'PM2.5',
      units: 'µg/m³',
      precision_provenance: 'UNKNOWN',
      window_preset: '24h',
      window_start_utc: '2026-10-27T12:00:00Z',
      window_end_utc: '2026-10-28T12:00:00Z',
      expected_observations: 24,
      valid_observations: 24,
      completeness_percentage: 100,
      is_coverage_satisfied: true,
      coverage_state: 'SATISFIED',
      freshness_state: 'FRESH',
      summary: {
        total_anomalies_detected: 2,
        total_spikes: 2,
        total_moderate_elevations: 0,
        total_step_surges: 1,
        total_sustained_episodes: 0,
        flatline_indicator: 'NORMAL_DISPERSION',
        evaluation_suppressed: false,
        scale_indeterminate: false,
      },
      data_quality_warnings: [],
      attribution_disclaimer: 'Disclaimer',
      observations: [],
    };
    const verdict = deriveAnomalyVerdict(mockAnomaly)!;
    expect(verdict.tone).toBe('anomaly');
    expect(verdict.headline).toContain('Flagged 2 sharp spikes');
  });
});

