import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OverviewSection } from './OverviewSection';
import * as api from '../services/api';
import type {
  LocationDetail,
  LocationMeasurementsResponse,
  RiskAssessmentResponse,
} from '../types';

describe('OverviewSection — Scientific Integrity & Data Governance Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'fetchProviderStatus').mockResolvedValue({
      data: {
        provider: 'OpenAQ v3',
        is_configured: true,
        is_reachable: true,
        base_url: 'https://api.openaq.org/v3',
        message: 'Connected',
        key_instructions: 'Key configured',
      },
      error: null,
    });
  });

  const baseLocation: LocationDetail = {
    id: 9911,
    name: 'Test Station Alpha',
    locality: 'Test City',
    country_code: 'IN',
    country_name: 'India',
    provider_name: 'CPCB',
    owner_name: 'CPCB',
    is_monitor: true,
    is_mobile: false,
    is_stale: false,
    available_parameters: ['pm25', 'o3', 'co'],
    coordinates: { latitude: 19.07, longitude: 72.88 },
    instruments: ['Reference Monitor'],
    licenses: [],
    sensors: [],
  };

  it('1. renders NO fabricated Overview KPIs when API data is absent', () => {
    const { container } = render(<OverviewSection onNavigate={vi.fn()} />);
    const text = container.textContent || '';

    expect(text).not.toMatch(/38\s*of\s*42\s*online/i);
    expect(text).not.toContain('120.5');
    expect(text).not.toContain('2.01×');
    expect(text).not.toContain('100%');
    expect(text).not.toContain('3 hours flagged');
    expect(text).not.toContain('#8118');
    expect(text).not.toContain('28.65° Lat');
    expect(text).not.toContain('CPCB / DPCC');
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });

  it('2. does NOT compute a fallback mean when backend calculated_average is null', () => {
    const incompleteMeasurements: LocationMeasurementsResponse = {
      location_id: 9911,
      station_name: 'Test Station Alpha',
      locality: 'Test City',
      provider_name: 'CPCB',
      parameter: 'pm25',
      parameter_display_name: 'PM2.5',
      units: 'µg/m³',
      sensor_id: 1,
      requested_from_utc: '2026-11-24T00:00:00Z',
      requested_to_utc: '2026-11-25T00:00:00Z',
      retrieved_at_utc: '2026-11-25T00:05:00Z',
      total_observations: 3,
      expected_observations: 24,
      missing_percentage: 87.5,
      is_stale: false,
      data_integrity_notice: 'Physical observations',
      measurements: [
        {
          value: 100,
          parameter: 'pm25',
          units: 'µg/m³',
          period_label: 'hour',
          datetime_from_utc: '2026-11-24T01:00:00Z',
          datetime_to_utc: '2026-11-24T02:00:00Z',
          is_missing: false,
        },
        {
          value: 200,
          parameter: 'pm25',
          units: 'µg/m³',
          period_label: 'hour',
          datetime_from_utc: '2026-11-24T02:00:00Z',
          datetime_to_utc: '2026-11-24T03:00:00Z',
          is_missing: false,
        },
        {
          value: 300,
          parameter: 'pm25',
          units: 'µg/m³',
          period_label: 'hour',
          datetime_from_utc: '2026-11-24T03:00:00Z',
          datetime_to_utc: '2026-11-24T04:00:00Z',
          is_missing: false,
        },
      ],
    };

    const incompleteAssessment: RiskAssessmentResponse = {
      location_id: 9911,
      station_name: 'Test Station Alpha',
      locality: 'Test City',
      sensor_id: 1,
      parameter: 'pm25',
      parameter_display_name: 'PM2.5',
      units: 'µg/m³',
      calculation_timestamp_utc: '2026-11-25T00:05:00Z',
      window_start_utc: '2026-11-24T00:00:00Z',
      window_end_utc: '2026-11-25T00:00:00Z',
      averaging_period_hours: 24,
      averaging_period_label: '24-hour',
      valid_observations: 3,
      expected_observations: 24,
      missing_observations: 21,
      excluded_observations: 0,
      completeness_percentage: 12.5,
      is_completeness_satisfied: false,
      completeness_rule_label: '75% gate',
      data_quality_warnings: [],
      calculated_average: null,
      freshness_state: 'fresh',
      freshness_message: 'Fresh',
      standard_name: 'CPCB NAAQS (2009)',
      standard_threshold: 60,
      standard_unit: 'µg/m³',
      secondary_benchmark_name: 'WHO AQG (2021)',
      secondary_benchmark_threshold: 15,
      secondary_benchmark_unit: 'µg/m³',
      status: 'insufficient_data',
      status_label: 'Insufficient Data',
      ratio_to_standard: null,
      screening_limitations: 'Incomplete window',
      regulatory_disclaimer: 'Screening only',
      spatial_disclaimer: 'Single station',
      advisories: [],
    };

    const { container } = render(
      <OverviewSection
        onNavigate={vi.fn()}
        selectedLocation={baseLocation}
        measurementsData={incompleteMeasurements}
        assessmentData={incompleteAssessment}
      />
    );

    const text = container.textContent || '';
    // Arithmetic mean of 100, 200, 300 would be 200.0; must NOT be displayed as governed mean
    expect(text).not.toContain('200.0 µg/m³');
    expect(screen.getAllByText(/Unavailable/i).length).toBeGreaterThanOrEqual(1);
    expect(text).toContain('Incomplete (<75%)');
  });

  it('3. CO does NOT render a WHO threshold line when secondary_benchmark_threshold is null', () => {
    const coMeasurements: LocationMeasurementsResponse = {
      location_id: 9911,
      station_name: 'Test Station Alpha',
      provider_name: 'CPCB',
      parameter: 'co',
      parameter_display_name: 'Carbon Monoxide (CO)',
      units: 'mg/m³',
      sensor_id: 3,
      requested_from_utc: '2026-11-24T16:00:00Z',
      requested_to_utc: '2026-11-25T00:00:00Z',
      retrieved_at_utc: '2026-11-25T00:05:00Z',
      total_observations: 8,
      expected_observations: 8,
      missing_percentage: 0,
      is_stale: false,
      data_integrity_notice: 'Physical observations',
      measurements: [
        {
          value: 1.2,
          parameter: 'co',
          units: 'mg/m³',
          period_label: 'hour',
          datetime_from_utc: '2026-11-24T17:00:00Z',
          datetime_to_utc: '2026-11-24T18:00:00Z',
          is_missing: false,
        },
        {
          value: 1.4,
          parameter: 'co',
          units: 'mg/m³',
          period_label: 'hour',
          datetime_from_utc: '2026-11-24T18:00:00Z',
          datetime_to_utc: '2026-11-24T19:00:00Z',
          is_missing: false,
        },
      ],
    };

    const coAssessment: RiskAssessmentResponse = {
      location_id: 9911,
      station_name: 'Test Station Alpha',
      sensor_id: 3,
      parameter: 'co',
      parameter_display_name: 'Carbon Monoxide (CO)',
      units: 'mg/m³',
      calculation_timestamp_utc: '2026-11-25T00:05:00Z',
      window_start_utc: '2026-11-24T16:00:00Z',
      window_end_utc: '2026-11-25T00:00:00Z',
      averaging_period_hours: 8,
      averaging_period_label: '8-hour',
      valid_observations: 8,
      expected_observations: 8,
      missing_observations: 0,
      excluded_observations: 0,
      completeness_percentage: 100,
      is_completeness_satisfied: true,
      completeness_rule_label: '75% gate',
      data_quality_warnings: [],
      calculated_average: 1.3,
      freshness_state: 'fresh',
      freshness_message: 'Fresh',
      standard_name: 'CPCB NAAQS (2009)',
      standard_threshold: 2.0,
      standard_unit: 'mg/m³',
      secondary_benchmark_name: null,
      secondary_benchmark_threshold: null,
      secondary_benchmark_unit: null,
      status: 'below_reference',
      status_label: 'Below Reference',
      ratio_to_standard: 0.65,
      screening_limitations: 'Screening only',
      regulatory_disclaimer: 'Screening only',
      spatial_disclaimer: 'Single station',
      advisories: [],
    };

    const { container } = render(
      <OverviewSection
        onNavigate={vi.fn()}
        selectedLocation={baseLocation}
        measurementsData={coMeasurements}
        assessmentData={coAssessment}
      />
    );

    const text = container.textContent || '';
    expect(text).toContain('CPCB 8-hour (2 mg/m³)');
    expect(text).not.toMatch(/WHO\s*8-hour/i);
    expect(text).not.toMatch(/WHO\s*\(15/i);
  });

  it('4. O3 8/8 observations use the 8-hour completeness context rather than 24-hour', () => {
    const o3Measurements: LocationMeasurementsResponse = {
      location_id: 9911,
      station_name: 'Test Station Alpha',
      provider_name: 'CPCB',
      parameter: 'o3',
      parameter_display_name: 'Ozone (O₃)',
      units: 'µg/m³',
      sensor_id: 2,
      requested_from_utc: '2026-11-24T16:00:00Z',
      requested_to_utc: '2026-11-25T00:00:00Z',
      retrieved_at_utc: '2026-11-25T00:05:00Z',
      total_observations: 8,
      expected_observations: 8,
      missing_percentage: 0,
      is_stale: false,
      data_integrity_notice: 'Physical observations',
      measurements: Array.from({ length: 8 }).map((_, idx) => ({
        value: 45 + idx,
        parameter: 'o3',
        units: 'µg/m³',
        period_label: 'hour',
        datetime_from_utc: `2026-11-24T${String(16 + idx).padStart(2, '0')}:00:00Z`,
        datetime_to_utc: `2026-11-24T${String(17 + idx).padStart(2, '0')}:00:00Z`,
        is_missing: false,
      })),
    };

    const o3Assessment: RiskAssessmentResponse = {
      location_id: 9911,
      station_name: 'Test Station Alpha',
      sensor_id: 2,
      parameter: 'o3',
      parameter_display_name: 'Ozone (O₃)',
      units: 'µg/m³',
      calculation_timestamp_utc: '2026-11-25T00:05:00Z',
      window_start_utc: '2026-11-24T16:00:00Z',
      window_end_utc: '2026-11-25T00:00:00Z',
      averaging_period_hours: 8,
      averaging_period_label: '8-hour',
      valid_observations: 8,
      expected_observations: 8,
      missing_observations: 0,
      excluded_observations: 0,
      completeness_percentage: 100,
      is_completeness_satisfied: true,
      completeness_rule_label: '75% gate',
      data_quality_warnings: [],
      calculated_average: 48.5,
      freshness_state: 'fresh',
      freshness_message: 'Fresh',
      standard_name: 'CPCB NAAQS (2009)',
      standard_threshold: 100,
      standard_unit: 'µg/m³',
      secondary_benchmark_name: 'WHO AQG (2021)',
      secondary_benchmark_threshold: 100,
      secondary_benchmark_unit: 'µg/m³',
      status: 'below_reference',
      status_label: 'Below Reference',
      ratio_to_standard: 0.485,
      screening_limitations: 'Screening only',
      regulatory_disclaimer: 'Screening only',
      spatial_disclaimer: 'Single station',
      advisories: [],
    };

    const { container } = render(
      <OverviewSection
        onNavigate={vi.fn()}
        selectedLocation={baseLocation}
        measurementsData={o3Measurements}
        assessmentData={o3Assessment}
      />
    );

    const text = container.textContent || '';
    expect(text).toContain('8-hour Telemetry');
    expect(text).toContain('6/8h required');
    expect(text).toContain('gate 8/8 → Passed (≥75%)');
    expect(text).not.toContain('24-Hour Telemetry');
  });

  it('5. derives missing counts from expected_observations minus total_observations', () => {
    const partialMeasurements: LocationMeasurementsResponse = {
      location_id: 9911,
      station_name: 'Test Station Alpha',
      provider_name: 'CPCB',
      parameter: 'pm25',
      parameter_display_name: 'PM2.5',
      units: 'µg/m³',
      sensor_id: 1,
      requested_from_utc: '2026-11-24T00:00:00Z',
      requested_to_utc: '2026-11-25T00:00:00Z',
      retrieved_at_utc: '2026-11-25T00:05:00Z',
      total_observations: 19,
      expected_observations: 24,
      missing_percentage: 20.8,
      is_stale: false,
      data_integrity_notice: 'Physical observations',
      measurements: Array.from({ length: 19 }).map((_, idx) => ({
        value: 50,
        parameter: 'pm25',
        units: 'µg/m³',
        period_label: 'hour',
        datetime_from_utc: `2026-11-24T${String(idx).padStart(2, '0')}:00:00Z`,
        datetime_to_utc: `2026-11-24T${String(idx + 1).padStart(2, '0')}:00:00Z`,
        is_missing: false,
      })),
    };

    const { container } = render(
      <OverviewSection
        onNavigate={vi.fn()}
        selectedLocation={baseLocation}
        measurementsData={partialMeasurements}
      />
    );

    const text = container.textContent || '';
    // 24 - 19 = 5 missing
    expect(text).toContain('valid 19/24 h');
    expect(text).toContain('missing 5');
  });

  it('6. preserves leading and trailing gaps on the requested observation window x-axis domain', () => {
    // Requested window is 00:00 to 24:00 (24 hours), but readings only exist at 12:00 (midpoint!)
    const midWindowMeasurements: LocationMeasurementsResponse = {
      location_id: 9911,
      station_name: 'Test Station Alpha',
      provider_name: 'CPCB',
      parameter: 'pm25',
      parameter_display_name: 'PM2.5',
      units: 'µg/m³',
      sensor_id: 1,
      requested_from_utc: '2026-11-24T00:00:00Z',
      requested_to_utc: '2026-11-25T00:00:00Z',
      retrieved_at_utc: '2026-11-25T00:05:00Z',
      total_observations: 2,
      expected_observations: 24,
      missing_percentage: 91.7,
      is_stale: false,
      data_integrity_notice: 'Physical observations',
      measurements: [
        {
          value: 80,
          parameter: 'pm25',
          units: 'µg/m³',
          period_label: 'hour',
          datetime_from_utc: '2026-11-24T12:00:00Z',
          datetime_to_utc: '2026-11-24T13:00:00Z',
          is_missing: false,
        },
        {
          value: 85,
          parameter: 'pm25',
          units: 'µg/m³',
          period_label: 'hour',
          datetime_from_utc: '2026-11-24T13:00:00Z',
          datetime_to_utc: '2026-11-24T14:00:00Z',
          is_missing: false,
        },
      ],
    };

    const { container } = render(
      <OverviewSection
        onNavigate={vi.fn()}
        selectedLocation={baseLocation}
        measurementsData={midWindowMeasurements}
      />
    );

    const svg = container.querySelector('svg[aria-label*="observation time-series chart"]');
    expect(svg).toBeInTheDocument();
    const circles = svg!.querySelectorAll('circle');
    expect(circles.length).toBe(2);

    // Chart inner width is 784 (from x=52 to x=836).
    // 12:00 is at 50% of [00:00..24:00] => x should be around 52 + 0.5 * 784 = 444 (NOT stretched to 52!)
    const firstCx = Number(circles[0].getAttribute('cx'));
    expect(firstCx).toBeGreaterThan(400);
    expect(firstCx).toBeLessThan(500);
  });

  it('7. displays distinct loading state when fetching instead of "No verified observations available"', () => {
    render(
      <OverviewSection
        onNavigate={vi.fn()}
        selectedLocation={baseLocation}
        measurementsData={null}
        isLoadingMeasurements={true}
      />
    );

    expect(screen.getByText(/Loading verified observations/i)).toBeInTheDocument();
    expect(screen.queryByText(/No verified observations available/i)).not.toBeInTheDocument();
  });

  it('8. changing pollutant guard prevents pairing old observations with mismatched assessment', () => {
    const pm25Measurements: LocationMeasurementsResponse = {
      location_id: 9911,
      station_name: 'Test Station Alpha',
      provider_name: 'CPCB',
      parameter: 'pm25',
      parameter_display_name: 'PM2.5',
      units: 'µg/m³',
      sensor_id: 1,
      requested_from_utc: '2026-11-24T00:00:00Z',
      requested_to_utc: '2026-11-25T00:00:00Z',
      retrieved_at_utc: '2026-11-25T00:05:00Z',
      total_observations: 1,
      expected_observations: 24,
      is_stale: false,
      data_integrity_notice: 'Physical observations',
      measurements: [
        {
          value: 95,
          parameter: 'pm25',
          units: 'µg/m³',
          period_label: 'hour',
          datetime_from_utc: '2026-11-24T12:00:00Z',
          datetime_to_utc: '2026-11-24T13:00:00Z',
          is_missing: false,
        },
      ],
    };

    const pm10Assessment: RiskAssessmentResponse = {
      location_id: 9911,
      station_name: 'Test Station Alpha',
      sensor_id: 4,
      parameter: 'pm10',
      parameter_display_name: 'PM10',
      units: 'µg/m³',
      calculation_timestamp_utc: '2026-11-25T00:05:00Z',
      window_start_utc: '2026-11-24T00:00:00Z',
      window_end_utc: '2026-11-25T00:00:00Z',
      averaging_period_hours: 24,
      averaging_period_label: '24-hour',
      valid_observations: 24,
      expected_observations: 24,
      missing_observations: 0,
      excluded_observations: 0,
      completeness_percentage: 100,
      is_completeness_satisfied: true,
      completeness_rule_label: '75% gate',
      data_quality_warnings: [],
      calculated_average: 250.0,
      freshness_state: 'fresh',
      freshness_message: 'Fresh',
      standard_name: 'CPCB NAAQS (2009)',
      standard_threshold: 100,
      standard_unit: 'µg/m³',
      secondary_benchmark_name: 'WHO AQG (2021)',
      secondary_benchmark_threshold: 45,
      secondary_benchmark_unit: 'µg/m³',
      status: 'above_reference',
      status_label: 'Above Reference',
      ratio_to_standard: 2.5,
      screening_limitations: 'Screening only',
      regulatory_disclaimer: 'Screening only',
      spatial_disclaimer: 'Single station',
      advisories: [],
    };

    const { container } = render(
      <OverviewSection
        onNavigate={vi.fn()}
        selectedLocation={baseLocation}
        measurementsData={pm25Measurements}
        assessmentData={pm10Assessment}
      />
    );

    const text = container.textContent || '';
    // Mismatched PM10 assessment (250.0, 2.5x) must NOT be paired with PM2.5 observations!
    expect(text).not.toContain('250.0');
    expect(text).not.toContain('2.50×');
  });

  it('9. chart renders ONLY genuine non-missing observation points', () => {
    const mixedMeasurements: LocationMeasurementsResponse = {
      location_id: 9911,
      station_name: 'Test Station Alpha',
      provider_name: 'CPCB',
      parameter: 'pm25',
      parameter_display_name: 'PM2.5',
      units: 'µg/m³',
      sensor_id: 1,
      requested_from_utc: '2026-11-24T00:00:00Z',
      requested_to_utc: '2026-11-25T00:00:00Z',
      retrieved_at_utc: '2026-11-25T00:05:00Z',
      total_observations: 2,
      expected_observations: 24,
      is_stale: false,
      data_integrity_notice: 'Physical observations',
      measurements: [
        {
          value: 40,
          parameter: 'pm25',
          units: 'µg/m³',
          period_label: 'hour',
          datetime_from_utc: '2026-11-24T01:00:00Z',
          datetime_to_utc: '2026-11-24T02:00:00Z',
          is_missing: false,
        },
        {
          value: 0,
          parameter: 'pm25',
          units: 'µg/m³',
          period_label: 'hour',
          datetime_from_utc: '2026-11-24T02:00:00Z',
          datetime_to_utc: '2026-11-24T03:00:00Z',
          is_missing: true,
        },
        {
          value: 60,
          parameter: 'pm25',
          units: 'µg/m³',
          period_label: 'hour',
          datetime_from_utc: '2026-11-24T03:00:00Z',
          datetime_to_utc: '2026-11-24T04:00:00Z',
          is_missing: false,
        },
      ],
    };

    const { container } = render(
      <OverviewSection
        onNavigate={vi.fn()}
        selectedLocation={baseLocation}
        measurementsData={mixedMeasurements}
      />
    );

    const svg = container.querySelector('svg[aria-label*="observation time-series chart"]');
    expect(svg).toBeInTheDocument();
    const circles = svg!.querySelectorAll('circle');
    // Only the 2 non-missing points should be plotted
    expect(circles.length).toBe(2);
  });

  it('10. renders NO fabricated network counts or qualified-finding metrics', () => {
    const { container } = render(<OverviewSection onNavigate={vi.fn()} />);
    const text = container.textContent || '';

    expect(text).not.toContain('Anand Vihar · M 4.8');
    expect(text).not.toContain('Delhi NCR · 5 Stations');
    expect(text).not.toContain('12 heavy-duty transit vehicles');
    expect(text).not.toContain('0.44 kg/day');
    expect(text).not.toContain('R K Puram, ITO');
  });
});
