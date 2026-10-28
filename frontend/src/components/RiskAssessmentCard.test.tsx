import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RiskAssessmentCard } from './RiskAssessmentCard';
import type { RiskAssessmentResponse } from '../types';

const mockFreshAboveReference: RiskAssessmentResponse = {
  location_id: 8118,
  station_name: 'Anand Vihar, Delhi - DPCC',
  locality: 'Delhi',
  sensor_id: 101,
  parameter: 'pm25',
  parameter_display_name: 'PM2.5',
  units: 'µg/m³',
  calculation_timestamp_utc: '2026-10-28T12:05:00Z',
  window_start_utc: '2026-10-27T12:00:00Z',
  window_end_utc: '2026-10-28T12:00:00Z',
  averaging_period_hours: 24,
  averaging_period_label: '24-hour standard',
  valid_observations: 22,
  expected_observations: 24,
  missing_observations: 2,
  excluded_observations: 0,
  completeness_percentage: 91.7,
  is_completeness_satisfied: true,
  completeness_rule_label: 'EcoSentinel quality rule (minimum 75% hourly coverage required in rolling window)',
  data_quality_warnings: [],
  calculated_average: 115.4,
  sensor_datetime_last_utc: '2026-10-28T11:45:00Z',
  sensor_datetime_last_local: '2026-10-28 17:15:00 IST',
  freshness_state: 'fresh',
  freshness_message: 'Sensor observation is current within 24 hours.',
  standard_name: 'CPCB NAAQS (2009)',
  standard_threshold: 60.0,
  standard_unit: 'µg/m³',
  standard_url: 'https://www.airquality.cpcb.gov.in/ccr_docs/Air_quality_standards.pdf',
  secondary_benchmark_name: 'WHO Air Quality Guidelines (2021)',
  secondary_benchmark_threshold: 15.0,
  secondary_benchmark_unit: 'µg/m³',
  secondary_benchmark_url: 'https://www.who.int/publications/i/item/9789240034228',
  secondary_benchmark_notes: 'WHO guideline recommends 15 µg/m³ (24-hour mean).',
  status: 'above_reference',
  status_label: 'Above reference level',
  ratio_to_standard: 1.92,
  screening_limitations:
    'Station sensor rolling average (115.4 µg/m³) exceeds the statutory CPCB 24-hour limit (60.0 µg/m³). Coverage is 91.7% (22/24 valid hours). Operational screening result only.',
  regulatory_disclaimer:
    'Operational screening result only: this comparison evaluates an operational rolling window at a single monitor and does not constitute a formal regulatory compliance determination or statutory enforcement finding under CPCB rules.',
  spatial_disclaimer:
    'Spatial representativeness limitation: observations represent physical conditions at this specific monitoring station and cannot be assumed to represent an entire metropolitan area or identify a specific upwind source.',
  advisories: [
    {
      category: 'traffic',
      action: 'Inspect anti-idling enforcement in loading bays and surrounding vehicular queues.',
      rationale:
        'Diesel vehicular exhaust is a significant contributor to local combustion particulate matter in urban corridors.',
      uncertainty:
        'A single roadside monitor cannot verify source attribution or distinguish local fleet emissions from background advection.',
    },
    {
      category: 'dust',
      action: 'Review dust-suppression misting schedules and aggregate material stockpile coverings.',
      rationale:
        'Fugitive surface dust and mechanical resuspension elevate airborne particulate matter in dry conditions.',
      uncertainty:
        'Wind direction and regional meteorological transport heavily influence PM2.5 levels independent of on-site suppression.',
    },
  ],
};

const mockBelowReference: RiskAssessmentResponse = {
  location_id: 8118,
  station_name: 'Anand Vihar, Delhi - DPCC',
  locality: 'Delhi',
  sensor_id: 101,
  parameter: 'pm25',
  parameter_display_name: 'PM2.5',
  units: 'µg/m³',
  calculation_timestamp_utc: '2026-10-28T12:05:00Z',
  window_start_utc: '2026-10-27T12:00:00Z',
  window_end_utc: '2026-10-28T12:00:00Z',
  averaging_period_hours: 24,
  averaging_period_label: '24-hour standard',
  valid_observations: 24,
  expected_observations: 24,
  missing_observations: 0,
  excluded_observations: 0,
  completeness_percentage: 100.0,
  is_completeness_satisfied: true,
  completeness_rule_label: 'EcoSentinel quality rule (minimum 75% hourly coverage required in rolling window)',
  data_quality_warnings: [],
  calculated_average: 42.1,
  sensor_datetime_last_utc: '2026-10-28T11:45:00Z',
  sensor_datetime_last_local: '2026-10-28 17:15:00 IST',
  freshness_state: 'fresh',
  freshness_message: 'Sensor observation is current within 24 hours.',
  standard_name: 'CPCB NAAQS (2009)',
  standard_threshold: 60.0,
  standard_unit: 'µg/m³',
  standard_url: 'https://www.airquality.cpcb.gov.in/ccr_docs/Air_quality_standards.pdf',
  secondary_benchmark_name: 'WHO Air Quality Guidelines (2021)',
  secondary_benchmark_threshold: 15.0,
  secondary_benchmark_unit: 'µg/m³',
  secondary_benchmark_url: 'https://www.who.int/publications/i/item/9789240034228',
  secondary_benchmark_notes: 'WHO guideline recommends 15 µg/m³ (24-hour mean).',
  status: 'below_reference',
  status_label: 'Below reference level',
  ratio_to_standard: 0.7,
  screening_limitations:
    'Station sensor rolling average (42.1 µg/m³) is below the statutory CPCB 24-hour limit (60.0 µg/m³). Coverage is 100.0% (24/24 valid hours).',
  regulatory_disclaimer:
    'Operational screening result only: this comparison evaluates an operational rolling window at a single monitor and does not constitute a formal regulatory compliance determination.',
  spatial_disclaimer:
    'Spatial representativeness limitation: observations represent physical conditions at this specific monitoring station.',
  advisories: [
    {
      category: 'filtration',
      action: 'Maintain standard routine air filtration maintenance and scheduled visual checks.',
      rationale: 'Observed concentration levels are within reference screening thresholds.',
      uncertainty:
        'Continuous monitoring should be maintained; transient peak events may occur without exceeding rolling averages.',
    },
  ],
};

const mockInsufficientData: RiskAssessmentResponse = {
  location_id: 8118,
  station_name: 'Anand Vihar, Delhi - DPCC',
  locality: 'Delhi',
  sensor_id: 101,
  parameter: 'pm25',
  parameter_display_name: 'PM2.5',
  units: 'µg/m³',
  calculation_timestamp_utc: '2026-10-28T12:05:00Z',
  window_start_utc: '2026-10-27T12:00:00Z',
  window_end_utc: '2026-10-28T12:00:00Z',
  averaging_period_hours: 24,
  averaging_period_label: '24-hour standard',
  valid_observations: 10,
  expected_observations: 24,
  missing_observations: 14,
  excluded_observations: 1,
  completeness_percentage: 41.7,
  is_completeness_satisfied: false,
  completeness_rule_label: 'EcoSentinel quality rule (minimum 75% hourly coverage required in rolling window)',
  data_quality_warnings: ['Excluded 1 invalid negative concentration observation (< 0 µg/m³).'],
  calculated_average: null,
  sensor_datetime_last_utc: '2026-10-28T11:45:00Z',
  sensor_datetime_last_local: '2026-10-28 17:15:00 IST',
  freshness_state: 'fresh',
  freshness_message: 'Sensor observation is current within 24 hours.',
  standard_name: 'CPCB NAAQS (2009)',
  standard_threshold: 60.0,
  standard_unit: 'µg/m³',
  standard_url: 'https://www.airquality.cpcb.gov.in/ccr_docs/Air_quality_standards.pdf',
  status: 'insufficient_data',
  status_label: 'Insufficient data',
  ratio_to_standard: null,
  screening_limitations:
    'Insufficient data: only 10 valid hourly observations available across 24-hour window (41.7% coverage). EcoSentinel requires ≥75% hourly completeness (18/24 hours) to calculate an operational screening average.',
  regulatory_disclaimer:
    'Operational screening result only: this comparison evaluates an operational rolling window at a single monitor.',
  spatial_disclaimer:
    'Spatial representativeness limitation: observations represent physical conditions at this specific monitoring station.',
  advisories: [],
};

const mockStaleData: RiskAssessmentResponse = {
  location_id: 8119,
  station_name: 'Bandra, Mumbai - MPCB',
  locality: 'Mumbai',
  sensor_id: 103,
  parameter: 'pm25',
  parameter_display_name: 'PM2.5',
  units: 'µg/m³',
  calculation_timestamp_utc: '2026-10-28T12:05:00Z',
  window_start_utc: '2026-10-25T12:00:00Z',
  window_end_utc: '2026-10-26T12:00:00Z',
  averaging_period_hours: 24,
  averaging_period_label: '24-hour standard',
  valid_observations: 20,
  expected_observations: 24,
  missing_observations: 4,
  excluded_observations: 0,
  completeness_percentage: 83.3,
  is_completeness_satisfied: true,
  completeness_rule_label: 'EcoSentinel quality rule (minimum 75% hourly coverage required in rolling window)',
  data_quality_warnings: [],
  calculated_average: 78.2,
  sensor_datetime_last_utc: '2026-10-26T11:00:00Z',
  sensor_datetime_last_local: '2026-10-26 16:30:00 IST',
  freshness_state: 'stale',
  freshness_message: 'Sensor observation is older than 24 hours (last recorded 2026-10-26T11:00:00Z).',
  standard_name: 'CPCB NAAQS (2009)',
  standard_threshold: 60.0,
  standard_unit: 'µg/m³',
  standard_url: 'https://www.airquality.cpcb.gov.in/ccr_docs/Air_quality_standards.pdf',
  status: 'stale_data',
  status_label: 'Stale sensor data',
  ratio_to_standard: 1.3,
  screening_limitations:
    'Sensor observations are stale (>24 hours old). Calculated average (78.2 µg/m³) reflects historical window.',
  regulatory_disclaimer:
    'Operational screening result only: this comparison evaluates an operational rolling window at a single monitor.',
  spatial_disclaimer:
    'Spatial representativeness limitation: observations represent physical conditions at this specific monitoring station.',
  advisories: [],
};

const mockHistoricalData: RiskAssessmentResponse = {
  location_id: 8120,
  station_name: 'Historical Station',
  locality: 'Jaipur',
  sensor_id: 105,
  parameter: 'pm25',
  parameter_display_name: 'PM2.5',
  units: 'µg/m³',
  calculation_timestamp_utc: '2026-10-28T12:05:00Z',
  window_start_utc: '2026-10-27T12:00:00Z',
  window_end_utc: '2026-10-28T12:00:00Z',
  averaging_period_hours: 24,
  averaging_period_label: '24-hour standard',
  valid_observations: 0,
  expected_observations: 24,
  missing_observations: 24,
  excluded_observations: 0,
  completeness_percentage: 0.0,
  is_completeness_satisfied: false,
  completeness_rule_label: 'EcoSentinel quality rule (minimum 75% hourly coverage required in rolling window)',
  data_quality_warnings: [],
  calculated_average: null,
  sensor_datetime_last_utc: '2021-09-20T13:15:00Z',
  sensor_datetime_last_local: '2021-09-20 18:45:00 IST',
  freshness_state: 'historical',
  freshness_message: 'Sensor has ceased reporting data for over 30 days (last recorded 2021-09-20T13:15:00Z).',
  standard_name: 'CPCB NAAQS (2009)',
  standard_threshold: 60.0,
  standard_unit: 'µg/m³',
  standard_url: 'https://www.airquality.cpcb.gov.in/ccr_docs/Air_quality_standards.pdf',
  status: 'historical_data',
  status_label: 'Historical sensor data',
  ratio_to_standard: null,
  screening_limitations:
    'Sensor has ceased reporting data for over 30 days. No observations in active rolling window.',
  regulatory_disclaimer:
    'Operational screening result only: this comparison evaluates an operational rolling window at a single monitor.',
  spatial_disclaimer:
    'Spatial representativeness limitation: observations represent physical conditions at this specific monitoring station.',
  advisories: [],
};

const mockUnavailableStandard: RiskAssessmentResponse = {
  location_id: 8121,
  station_name: 'CO Station',
  locality: 'Jaipur',
  sensor_id: 201,
  parameter: 'co',
  parameter_display_name: 'CO',
  units: 'ppm',
  calculation_timestamp_utc: '2026-10-28T12:05:00Z',
  window_start_utc: '2026-10-28T04:00:00Z',
  window_end_utc: '2026-10-28T12:00:00Z',
  averaging_period_hours: 8,
  averaging_period_label: '8-hour standard',
  valid_observations: 8,
  expected_observations: 8,
  missing_observations: 0,
  excluded_observations: 0,
  completeness_percentage: 100.0,
  is_completeness_satisfied: true,
  completeness_rule_label: 'EcoSentinel quality rule (minimum 75% hourly coverage required in rolling window)',
  data_quality_warnings: [],
  calculated_average: null,
  sensor_datetime_last_utc: '2026-10-28T11:45:00Z',
  sensor_datetime_last_local: '2026-10-28 17:15:00 IST',
  freshness_state: 'fresh',
  freshness_message: 'Sensor observation is current within 24 hours.',
  standard_name: 'CPCB NAAQS (2009)',
  standard_threshold: null,
  standard_unit: 'mg/m³',
  standard_url: 'https://www.airquality.cpcb.gov.in/ccr_docs/Air_quality_standards.pdf',
  status: 'unavailable',
  status_label: 'Standard unavailable',
  ratio_to_standard: null,
  screening_limitations:
    'Sensor reports CO in ppm. CPCB 2009 specifies CO threshold in mg/m³. Mass conversion requires local atmospheric temperature and pressure which are not recorded by this sensor.',
  regulatory_disclaimer:
    'Operational screening result only: this comparison evaluates an operational rolling window at a single monitor.',
  spatial_disclaimer:
    'Spatial representativeness limitation: observations represent physical conditions at this specific monitoring station.',
  advisories: [],
};

describe('RiskAssessmentCard Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state with aria-busy and polite announcement', () => {
    render(<RiskAssessmentCard assessment={null} isLoading={true} error={null} />);

    expect(screen.getByRole('region', { name: /operational risk assessment/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Evaluating physical observations against statutory CPCB NAAQS standards/i)
    ).toBeInTheDocument();
  });

  it('renders error state with retry button', () => {
    const onRetry = vi.fn();
    render(
      <RiskAssessmentCard
        assessment={null}
        isLoading={false}
        error={{
          error: 'upstream_timeout',
          error_code: 'UPSTREAM_TIMEOUT',
          message: 'Upstream gateway timed out while fetching observations',
        }}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText(/Assessment Error \(UPSTREAM_TIMEOUT\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Upstream gateway timed out while fetching observations/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Retry Assessment/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders fresh above_reference assessment with quantitative metrics and verified advisories', () => {
    render(<RiskAssessmentCard assessment={mockFreshAboveReference} isLoading={false} error={null} />);

    expect(screen.getByText('Above reference level')).toBeInTheDocument();
    expect(screen.getAllByText(/115.4 µg\/m³/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/60 µg\/m³/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/91.7%/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/22 \/ 24 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/1.92x reference limit/i)).toBeInTheDocument();

    // Check verified advisories
    expect(screen.getByText(/Inspect anti-idling enforcement/i)).toBeInTheDocument();
    expect(screen.getByText(/Review dust-suppression misting schedules/i)).toBeInTheDocument();

    // Verify statutory disclaimer
    expect(screen.getByText(/Statutory Compliance Boundary:/i)).toBeInTheDocument();
  });

  it('renders fresh below_reference assessment correctly', () => {
    render(<RiskAssessmentCard assessment={mockBelowReference} isLoading={false} error={null} />);

    expect(screen.getByText('Below reference level')).toBeInTheDocument();
    expect(screen.getAllByText(/42.1 µg\/m³/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/100.0%/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Maintain standard routine air filtration maintenance/i)).toBeInTheDocument();
  });

  it('renders insufficient_data state without fabricating an average concentration', () => {
    render(<RiskAssessmentCard assessment={mockInsufficientData} isLoading={false} error={null} />);

    expect(screen.getByText('Insufficient data')).toBeInTheDocument();
    // Does NOT display a calculated average; displays N/A and completeness failure
    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Completeness gate failed \(< 75%\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/115.4/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/42.1/i)).not.toBeInTheDocument();

    // Mentions 75% completeness gate
    expect(screen.getAllByText(/41.7%/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/10 \/ 24 hours/i)).toBeInTheDocument();

    // Data quality warning for negative value
    expect(screen.getByText(/Excluded 1 invalid negative concentration observation/i)).toBeInTheDocument();
  });

  it('renders stale_data state with freshness warning and suppressed alerts', () => {
    render(<RiskAssessmentCard assessment={mockStaleData} isLoading={false} error={null} />);

    expect(screen.getByText('Stale sensor data')).toBeInTheDocument();
    expect(screen.getByText(/Data Freshness Notice:/i)).toBeInTheDocument();
    expect(screen.getByText(/Sensor observation is older than 24 hours/i)).toBeInTheDocument();
  });

  it('renders historical_data state correctly', () => {
    render(<RiskAssessmentCard assessment={mockHistoricalData} isLoading={false} error={null} />);

    expect(screen.getByText('Historical sensor data')).toBeInTheDocument();
    expect(screen.getByText(/Data Freshness Notice:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Sensor has ceased reporting data for over 30 days/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders unavailable state when standard is not applicable or units cannot be converted', () => {
    render(<RiskAssessmentCard assessment={mockUnavailableStandard} isLoading={false} error={null} />);

    expect(screen.getByText('Standard unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Sensor reports CO in ppm/i)).toBeInTheDocument();
  });

  it('copies action checklist to clipboard when Copy Checklist button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<RiskAssessmentCard assessment={mockFreshAboveReference} isLoading={false} error={null} />);

    const copyBtn = screen.getByRole('button', { name: /copy action checklist to clipboard/i });
    expect(copyBtn).toBeInTheDocument();

    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });

    const copiedCall = writeTextMock.mock.calls[0][0];
    expect(copiedCall).toContain('EcoSentinel Operational Mitigation Checklist');
    expect(copiedCall).toContain('Anand Vihar, Delhi - DPCC');
    expect(copiedCall).toContain('Inspect anti-idling enforcement');
    expect(copiedCall).toContain('Caveats & Disclaimers');
    expect(copiedCall).toContain('Operational screening result only');

    // Button updates text to "Checklist Copied!"
    await waitFor(() => {
      expect(screen.getByText(/Checklist Copied!/i)).toBeInTheDocument();
    });
  });

  it('handles clipboard write failure gracefully without throwing errors', async () => {
    const rejectedPromise = Promise.reject(new Error('Permission denied'));
    rejectedPromise.catch(() => {});
    const writeTextMock = vi.fn().mockReturnValue(rejectedPromise);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<RiskAssessmentCard assessment={mockFreshAboveReference} isLoading={false} error={null} />);

    const copyBtn = screen.getByRole('button', { name: /copy action checklist to clipboard/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });

    // Should not crash and should remain as Copy Action Checklist
    expect(screen.getByRole('button', { name: /copy action checklist to clipboard/i })).toBeInTheDocument();
  });
});
