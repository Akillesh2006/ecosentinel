import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpatialSection } from './SpatialSection';
import * as api from '../services/api';
import type {
  LocationSummary,
  SpatialNeighborsResponse,
  SpatialComparisonResponse,
} from '../types';

const mockLocations: LocationSummary[] = [
  {
    id: 3060,
    name: 'Punjabi Bagh, Delhi - DPCC',
    locality: 'Delhi',
    country_code: 'IN',
    country_name: 'India',
    provider_name: 'OpenAQ v3',
    is_monitor: true,
    is_mobile: false,
    available_parameters: ['pm25', 'pm10', 'no2'],
    is_stale: false,
  },
  {
    id: 3061,
    name: 'Anand Vihar, Delhi - DPCC',
    locality: 'Delhi',
    country_code: 'IN',
    country_name: 'India',
    provider_name: 'OpenAQ v3',
    is_monitor: true,
    is_mobile: false,
    available_parameters: ['pm25', 'pm10'],
    is_stale: false,
  },
  {
    id: 3062,
    name: 'R.K. Puram, Delhi - DPCC',
    locality: 'Delhi',
    country_code: 'IN',
    country_name: 'India',
    provider_name: 'CPCB CAAQMS',
    is_monitor: true,
    is_mobile: false,
    available_parameters: ['pm25', 'no2'],
    is_stale: false,
  },
  {
    id: 3063,
    name: 'Shadipur, Delhi - CPCB',
    locality: 'Delhi',
    country_code: 'IN',
    country_name: 'India',
    provider_name: 'CPCB CAAQMS',
    is_monitor: true,
    is_mobile: false,
    available_parameters: ['pm25'],
    is_stale: false,
  },
  {
    id: 3064,
    name: 'Mandir Marg, Delhi - DPCC',
    locality: 'Delhi',
    country_code: 'IN',
    country_name: 'India',
    provider_name: 'OpenAQ v3',
    is_monitor: true,
    is_mobile: false,
    available_parameters: ['pm25'],
    is_stale: false,
  },
  {
    id: 3065,
    name: 'ITO, Delhi - CPCB',
    locality: 'Delhi',
    country_code: 'IN',
    country_name: 'India',
    provider_name: 'CPCB CAAQMS',
    is_monitor: true,
    is_mobile: false,
    available_parameters: ['pm25'],
    is_stale: false,
  },
];

const mockNeighborsResponse: SpatialNeighborsResponse = {
  reference_station_id: 3060,
  reference_station_name: 'Punjabi Bagh, Delhi - DPCC',
  reference_coordinates: { latitude: 28.67, longitude: 77.12 },
  reference_provider_name: 'OpenAQ v3',
  reference_owner_name: 'DPCC',
  parameter: 'pm25',
  parameter_display_name: 'PM2.5',
  radius_km: 25.0,
  candidates_examined_count: 38,
  eligible_neighbors_count: 5,
  missing_coordinates_count: 2,
  pollutant_incompatible_count: 12,
  outside_radius_count: 18,
  self_excluded_count: 1,
  spatial_disclaimer:
    'Point observation notice: distance does not establish atmospheric connectivity, wind transport, or shared emission sources.',
  neighbors: [
    {
      id: 3061,
      name: 'Anand Vihar, Delhi - DPCC',
      locality: 'Delhi',
      country_code: 'IN',
      provider_name: 'OpenAQ v3',
      owner_name: 'DPCC',
      coordinates: { latitude: 28.65, longitude: 77.31 },
      distance_km: 14.8,
      available_parameters: ['pm25', 'pm10'],
      sensor_id: 101,
      datetime_last_utc: '2026-11-01T12:00:00Z',
      is_stale: false,
    },
    {
      id: 3062,
      name: 'R.K. Puram, Delhi - DPCC',
      locality: 'Delhi',
      country_code: 'IN',
      provider_name: 'CPCB CAAQMS',
      owner_name: 'CPCB',
      coordinates: { latitude: 28.56, longitude: 77.18 },
      distance_km: 18.2,
      available_parameters: ['pm25', 'no2'],
      sensor_id: 102,
      datetime_last_utc: '2026-11-01T12:00:00Z',
      is_stale: false,
    },
    {
      id: 3063,
      name: 'Shadipur, Delhi - CPCB',
      locality: 'Delhi',
      country_code: 'IN',
      provider_name: 'CPCB CAAQMS',
      owner_name: 'CPCB',
      coordinates: { latitude: 28.65, longitude: 77.15 },
      distance_km: 5.4,
      available_parameters: ['pm25'],
      sensor_id: 103,
      datetime_last_utc: '2026-11-01T12:00:00Z',
      is_stale: false,
    },
    {
      id: 3064,
      name: 'Mandir Marg, Delhi - DPCC',
      locality: 'Delhi',
      country_code: 'IN',
      provider_name: 'OpenAQ v3',
      owner_name: 'DPCC',
      coordinates: { latitude: 28.63, longitude: 77.20 },
      distance_km: 8.9,
      available_parameters: ['pm25'],
      sensor_id: 104,
      datetime_last_utc: '2026-11-01T12:00:00Z',
      is_stale: false,
    },
    {
      id: 3065,
      name: 'ITO, Delhi - CPCB',
      locality: 'Delhi',
      country_code: 'IN',
      provider_name: 'CPCB CAAQMS',
      owner_name: 'CPCB',
      coordinates: { latitude: 28.62, longitude: 77.24 },
      distance_km: 12.1,
      available_parameters: ['pm25'],
      sensor_id: 105,
      datetime_last_utc: '2026-11-01T12:00:00Z',
      is_stale: false,
    },
  ],
};

const mockComparisonResponse: SpatialComparisonResponse = {
  parameter: 'pm25',
  parameter_display_name: 'PM2.5',
  units: 'µg/m³',
  requested_from_utc: '2026-10-31T12:00:00Z',
  requested_to_utc: '2026-11-01T12:00:00Z',
  reference_station_id: 3060,
  total_stations_requested: 4,
  total_valid_stations: 3,
  partial_failures: [
    {
      location_id: 3063,
      error_code: 'SENSOR_NOT_FOUND',
      message: 'No active PM2.5 sensor found at station 3063 during evaluation window',
    },
  ],
  all_stations_coincident_hours: 20,
  all_stations_coincident_coverage_percentage: 83.3,
  mixed_providers: true,
  spatial_disclaimer:
    'Point observation limitation: air quality measurements reflect physical observations at discrete station sites. Multi-station comparison does not establish a continuous spatial surface, atmospheric connectivity, wind transport, or industrial source culpability.',
  data_quality_warnings: ['Station 3063 excluded due to missing sensor telemetry.'],
  stations: [
    {
      location_id: 3060,
      station_name: 'Punjabi Bagh, Delhi - DPCC',
      locality: 'Delhi',
      provider_name: 'OpenAQ v3',
      owner_name: 'DPCC',
      is_reference: true,
      distance_from_reference_km: 0.0,
      coordinates: { latitude: 28.67, longitude: 77.12 },
      sensor_id: 100,
      units: 'µg/m³',
      total_valid_observations: 24,
      expected_observations: 24,
      station_coverage_percentage: 100.0,
      coverage_percentage: 100.0,
      coincident_with_reference_hours: 24,
      pairwise_overlap_coverage_percentage: 100.0,
      coincident_coverage_percentage: 100.0,
      conditional_reference_coverage_percentage: 100.0,
      min_correlation_samples_threshold: 6,
      pearson_correlation_with_reference: 1.0,
      correlation_status: 'REFERENCE_STATION',
      is_stale: false,
    },
    {
      location_id: 3061,
      station_name: 'Anand Vihar, Delhi - DPCC',
      locality: 'Delhi',
      provider_name: 'OpenAQ v3',
      owner_name: 'DPCC',
      is_reference: false,
      distance_from_reference_km: 14.8,
      coordinates: { latitude: 28.65, longitude: 77.31 },
      sensor_id: 101,
      units: 'µg/m³',
      total_valid_observations: 22,
      expected_observations: 24,
      station_coverage_percentage: 91.7,
      coverage_percentage: 91.7,
      coincident_with_reference_hours: 22,
      pairwise_overlap_coverage_percentage: 91.7,
      coincident_coverage_percentage: 91.7,
      conditional_reference_coverage_percentage: 91.7,
      min_correlation_samples_threshold: 6,
      pearson_correlation_with_reference: 0.842,
      correlation_status: 'CALCULATED',
      is_stale: false,
    },
    {
      location_id: 3062,
      station_name: 'R.K. Puram, Delhi - DPCC',
      locality: 'Delhi',
      provider_name: 'CPCB CAAQMS',
      owner_name: 'CPCB',
      is_reference: false,
      distance_from_reference_km: 18.2,
      coordinates: { latitude: 28.56, longitude: 77.18 },
      sensor_id: 102,
      units: 'µg/m³',
      total_valid_observations: 5,
      expected_observations: 24,
      station_coverage_percentage: 20.8,
      coverage_percentage: 20.8,
      coincident_with_reference_hours: 5,
      pairwise_overlap_coverage_percentage: 20.8,
      coincident_coverage_percentage: 20.8,
      conditional_reference_coverage_percentage: 20.8,
      min_correlation_samples_threshold: 6,
      pearson_correlation_with_reference: null,
      correlation_status: 'INSUFFICIENT_COINCIDENT_DATA',
      is_stale: false,
    },
  ],
  time_slices: [
    {
      datetime_utc: '2026-10-31T12:00:00Z',
      datetime_local: '2026-10-31 17:30:00 IST',
      station_values: {
        3060: 45.0,
        3061: 52.0,
        3062: 48.0,
      },
      contributing_stations: 3,
      neighborhood_median: 48.0,
      neighborhood_min: 45.0,
      neighborhood_max: 52.0,
      neighborhood_iqr: 3.5,
    },
    {
      datetime_utc: '2026-10-31T13:00:00Z',
      datetime_local: '2026-10-31 18:30:00 IST',
      station_values: {
        3060: 48.5,
        3061: 55.2,
        3062: null, // missing gap
      },
      contributing_stations: 2,
      neighborhood_median: 51.85,
      neighborhood_min: 48.5,
      neighborhood_max: 55.2,
      neighborhood_iqr: 3.35,
    },
  ],
};

describe('SpatialSection Component (Milestone 7 Phase B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'fetchLocations').mockResolvedValue({
      data: mockLocations,
      error: null,
    });
    vi.spyOn(api, 'fetchSpatialNeighbors').mockResolvedValue({
      data: mockNeighborsResponse,
      error: null,
    });
    vi.spyOn(api, 'fetchSpatialComparison').mockResolvedValue({
      data: mockComparisonResponse,
      error: null,
    });
  });

  it('renders section header, search controls, and initial neighbor scan', async () => {
    render(<SpatialSection />);

    expect(
      screen.getByRole('heading', { level: 2, name: /Multi-Station Spatial Comparison & Network Synchronization/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText(/Reference Station \(Anchor\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Target Pollutant/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Search Radius in Kilometers/i)).toBeInTheDocument();
    });

    // Check that neighbor discovery was called with default params
    expect(api.fetchSpatialNeighbors).toHaveBeenCalledWith(3060, 'pm25', 25.0, 20, expect.any(AbortSignal));
  });

  it('displays diagnostic candidate and exclusion counts from spatial discovery', async () => {
    render(<SpatialSection />);

    await waitFor(() => {
      expect(screen.getByText(/Candidates Evaluated:/i)).toBeInTheDocument();
    });

    expect(screen.getByText('38')).toBeInTheDocument(); // candidates_examined_count
    expect(screen.getByText('5')).toBeInTheDocument(); // eligible_neighbors_count
    expect(screen.getByText('12')).toBeInTheDocument(); // pollutant_incompatible_count
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1); // missing_coordinates_count
    expect(screen.getByText('18')).toBeInTheDocument(); // outside_radius_count
  });

  it('enforces 5-station maximum (1 reference + up to 4 neighbors) and disables further checkboxes', async () => {
    render(<SpatialSection />);

    await waitFor(() => {
      expect(screen.getByText(/Eligible Neighbor Stations within 25 km/i)).toBeInTheDocument();
    });

    // Initial default selects first 3 neighbors: 3061, 3062, 3063
    const check3064 = screen.getByLabelText(/Select Mandir Marg, Delhi - DPCC for comparison/i);
    const check3065 = screen.getByLabelText(/Select ITO, Delhi - CPCB for comparison/i);

    // Select the 4th neighbor (Mandir Marg)
    fireEvent.click(check3064);

    await waitFor(() => {
      expect(
        screen.getByText(/4 of 4 Neighbors Selected \(5\/5 Total\)/i)
      ).toBeInTheDocument();
    });

    // With 4 neighbors selected, unselected neighbor checkbox (ITO) must be disabled
    expect(check3065).toBeDisabled();
    expect(
      screen.getByText(/Maximum selection reached: 4 neighbors \+ 1 reference station = 5 stations total/i)
    ).toBeInTheDocument();

    // Deselect one neighbor, then ITO should become enabled again
    fireEvent.click(check3064);

    await waitFor(() => {
      expect(check3065).not.toBeDisabled();
    });
  });

  it('re-queries neighbor discovery when pollutant parameter is changed', async () => {
    render(<SpatialSection />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Target Pollutant/i)).toBeInTheDocument();
    });

    const paramSelect = screen.getByLabelText(/Target Pollutant/i);
    fireEvent.change(paramSelect, { target: { value: 'no2' } });

    await waitFor(() => {
      expect(api.fetchSpatialNeighbors).toHaveBeenCalledWith(3060, 'no2', 25.0, 20, expect.any(AbortSignal));
    });
  });

  it('re-queries neighbor discovery when search radius is changed via preset button', async () => {
    render(<SpatialSection />);

    await waitFor(() => {
      expect(screen.getByText('50k')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('50k'));

    await waitFor(() => {
      expect(api.fetchSpatialNeighbors).toHaveBeenCalledWith(3060, 'pm25', 50, 20, expect.any(AbortSignal));
    });
  });

  it('executes comparison and renders KPI summary cards with all-stations coincidence', async () => {
    render(<SpatialSection />);

    await waitFor(() => {
      expect(screen.getByText('All-Stations Coincident')).toBeInTheDocument();
    });

    // Check KPI values
    expect(screen.getAllByText(/Reference Anchor/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Punjabi Bagh, Delhi - DPCC/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/\/ 4 requested/i)).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument(); // all-stations coincident hours
    expect(screen.getByText(/83.3% window coverage/i)).toBeInTheDocument();
    expect(screen.getByText(/Mixed Providers/i)).toBeInTheDocument();
  });

  it('displays partial failures banner when stations cannot be included', async () => {
    render(<SpatialSection />);

    await waitFor(() => {
      expect(screen.getByText(/1 Station\(s\) Excluded from Comparison/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Station ID 3063/i)).toBeInTheDocument();
    expect(screen.getByText(/SENSOR_NOT_FOUND/i)).toBeInTheDocument();
    expect(screen.getByText(/No active PM2.5 sensor found at station 3063/i)).toBeInTheDocument();
  });

  it('displays latest neighborhood distribution snapshot (median, IQR, min, max)', async () => {
    render(<SpatialSection />);

    await waitFor(() => {
      expect(screen.getByText(/Neighborhood Distribution \(PM2.5\)/i)).toBeInTheDocument();
    });

    expect(screen.getByText('51.9')).toBeInTheDocument(); // latest slice median
    expect(screen.getByText('3.4')).toBeInTheDocument(); // latest slice iqr
    expect(screen.getByText('48.5')).toBeInTheDocument(); // latest slice min
    expect(screen.getByText('55.2')).toBeInTheDocument(); // latest slice max
    expect(screen.getByText(/2 stations contributing/i)).toBeInTheDocument();
  });

  it('displays all 4 coverage metrics with distinct labeled denominators in the evidence table', async () => {
    render(<SpatialSection />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Spatial Comparison Evidence Table/i)).toBeInTheDocument();
    });

    // Check table headers and denominator labels
    expect(screen.getByText(/valid \/ expected × 100/i)).toBeInTheDocument();
    expect(screen.getByText(/coincident \/ expected × 100/i)).toBeInTheDocument();
    expect(screen.getByText(/coincident \/ valid_ref × 100/i)).toBeInTheDocument();

    // Check all-stations banner
    expect(screen.getByText(/All-Stations Coincident Coverage:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/83.3%/i).length).toBeGreaterThanOrEqual(1);

    // Check station rows
    expect(screen.getAllByText('100.0%').length).toBeGreaterThanOrEqual(1); // Ref station coverage
    expect(screen.getAllByText('91.7%').length).toBeGreaterThanOrEqual(1); // Neighbor 1 station coverage
    expect(screen.getAllByText('20.8%').length).toBeGreaterThanOrEqual(1); // Neighbor 2 station coverage
  });

  it('displays Pearson correlation with coefficient, sample count, and clear unavailable states distinct from 0.0', async () => {
    render(<SpatialSection />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Spatial Comparison Evidence Table/i)).toBeInTheDocument();
    });

    // Reference station baseline
    expect(screen.getByText('1.000 (Reference)')).toBeInTheDocument();

    // Neighbor 1 calculated correlation: r = +0.842 with sample count
    expect(screen.getByText(/r = \+0.842/i)).toBeInTheDocument();
    expect(screen.getByText(/\(N=22\)/i)).toBeInTheDocument();

    // Neighbor 2 insufficient samples: badge with sample count < 6 threshold
    expect(screen.getByText(/<6 Coincident Hrs \(N=5\)/i)).toBeInTheDocument();

    // Verify exploratory correlation safeguard footnote
    expect(screen.getByText(/Pearson correlation is an exploratory sample statistic/i)).toBeInTheDocument();
  });

  it('renders multi-station SVG chart with station series and median line', async () => {
    render(<SpatialSection />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Hourly Multi-Station Comparative Chart/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Neighborhood Median')).toBeInTheDocument();
    expect(screen.getByText('0.0 km (Reference)')).toBeInTheDocument();
    expect(screen.getAllByText('14.8 km').length).toBeGreaterThanOrEqual(1);
  });

  it('renders scientific interpretation safeguard notice', async () => {
    render(<SpatialSection />);

    await waitFor(() => {
      expect(screen.getByText(/Scientific Interpretation Safeguard/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Point observation limitation: air quality measurements reflect physical observations/i)
    ).toBeInTheDocument();
  });

  it('handles spatial comparison API failure and provides retry', async () => {
    vi.spyOn(api, 'fetchSpatialComparison').mockResolvedValueOnce({
      data: null,
      error: {
        status: 500,
        error: 'SERVER_ERROR',
        message: 'OpenAQ upstream data service unavailable',
      },
    });

    render(<SpatialSection />);

    await waitFor(() => {
      expect(screen.getByRole('alert', { name: '' })).toBeInTheDocument();
    });

    expect(screen.getByText(/OpenAQ upstream data service unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry Comparison/i })).toBeInTheDocument();
  });

  it('reconciles neighbor selection when reference station changes to prevent self-comparison', async () => {
    render(<SpatialSection />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Reference Station \(Anchor\)/i)).toBeInTheDocument();
    });

    // Change reference station to Anand Vihar (id 3061), which was initially in the default neighbor selection
    const refSelect = screen.getByLabelText(/Reference Station \(Anchor\)/i);
    fireEvent.change(refSelect, { target: { value: '3061' } });

    await waitFor(() => {
      expect(api.fetchSpatialNeighbors).toHaveBeenCalledWith(3061, 'pm25', 25.0, 20, expect.any(AbortSignal));
    });

    // The comparison request must never include the reference station in neighbor_location_ids
    const compareCalls = vi.mocked(api.fetchSpatialComparison).mock.calls;
    compareCalls.forEach(([req]) => {
      expect(req.neighbor_location_ids).not.toContain(req.reference_location_id);
    });
  });

  it('displays true numeric zero correlation as r = 0.000 with sample count distinct from null unavailable states', async () => {
    const responseWithZeroCorr: SpatialComparisonResponse = {
      ...mockComparisonResponse,
      stations: [
        ...mockComparisonResponse.stations,
        {
          location_id: 3064,
          station_name: 'Mandir Marg, Delhi - DPCC',
          locality: 'Delhi',
          provider_name: 'OpenAQ v3',
          owner_name: 'DPCC',
          is_reference: false,
          distance_from_reference_km: 8.9,
          coordinates: { latitude: 28.63, longitude: 77.20 },
          sensor_id: 104,
          units: 'µg/m³',
          total_valid_observations: 20,
          expected_observations: 24,
          station_coverage_percentage: 83.3,
          coverage_percentage: 83.3,
          coincident_with_reference_hours: 20,
          pairwise_overlap_coverage_percentage: 83.3,
          coincident_coverage_percentage: 83.3,
          conditional_reference_coverage_percentage: 83.3,
          min_correlation_samples_threshold: 6,
          pearson_correlation_with_reference: 0.0,
          correlation_status: 'CALCULATED',
          is_stale: false,
        },
      ],
    };

    vi.spyOn(api, 'fetchSpatialComparison').mockResolvedValueOnce({
      data: responseWithZeroCorr,
      error: null,
    });

    render(<SpatialSection />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Spatial Comparison Evidence Table/i)).toBeInTheDocument();
    });

    // Verify true 0.0 is displayed with monospace value and sample count N
    expect(screen.getByText('r = 0.000')).toBeInTheDocument();
    expect(screen.getByText('(N=20)')).toBeInTheDocument();
  });

  it('renders neighborhood screening ribbon, evidence card, and passes window_preset to API', async () => {
    const fetchSpatialComparisonSpy = vi.spyOn(api, 'fetchSpatialComparison').mockResolvedValueOnce({
      data: {
        ...mockComparisonResponse,
        neighborhood_screening_summary: {
          evaluation_status: 'EVALUATED',
          suppression_reason: 'Screening evaluated across 24 hourly intervals.',
          window_preset: '24h',
          total_window_hours: 24,
          evaluable_hours_count: 24,
          concurrent_elevation_hours_count: 1,
          station_localized_elevation_hours_count: 2,
          neighbor_only_elevation_hours_count: 0,
          baseline_consistent_hours_count: 21,
          insufficient_evidence_hours_count: 0,
          evaluable_percentage_of_window: 100.0,
          concurrent_elevation_percentage_of_evaluable: 4.2,
          station_localized_percentage_of_evaluable: 8.3,
          neighbor_only_percentage_of_evaluable: 0.0,
          baseline_consistent_percentage_of_evaluable: 87.5,
          window_exclusions: [],
          screening_disclaimer: 'Scientific disclaimer test.',
        },
      },
      error: null,
    });

    render(<SpatialSection />);

    await waitFor(() => {
      expect(screen.getByTestId('neighborhood-screening-ribbon')).toBeInTheDocument();
      expect(screen.getByTestId('screening-evidence-card')).toBeInTheDocument();
    });

    expect(fetchSpatialComparisonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        reference_location_id: 3060,
        window_preset: '24h',
      }),
      expect.any(Object)
    );
  });
});
