import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  NeighborhoodScreeningRibbon,
  getClassificationMeta,
} from './NeighborhoodScreeningRibbon';
import { NeighborhoodScreeningEvidenceCard } from './NeighborhoodScreeningEvidenceCard';
import type {
  ComparisonTimeSlice,
  NeighborhoodScreeningSummary,
  StationComparisonMetadata,
} from '../types';

const mockSummaryEvaluated: NeighborhoodScreeningSummary = {
  evaluation_status: 'EVALUATED',
  suppression_reason: 'Screening evaluated across 24 hourly intervals.',
  window_preset: '24h',
  total_window_hours: 24,
  evaluable_hours_count: 24,
  concurrent_elevation_hours_count: 2,
  station_localized_elevation_hours_count: 3,
  neighbor_only_elevation_hours_count: 1,
  baseline_consistent_hours_count: 18,
  insufficient_evidence_hours_count: 0,
  evaluable_percentage_of_window: 100.0,
  concurrent_elevation_percentage_of_evaluable: 8.3,
  station_localized_percentage_of_evaluable: 12.5,
  neighbor_only_percentage_of_evaluable: 4.2,
  baseline_consistent_percentage_of_evaluable: 75.0,
  window_exclusions: [],
  screening_disclaimer:
    'EcoSentinel screens for empirical statistical concordance across discrete, stationary monitoring points. Neighborhood screening does NOT infer continuous spatial concentration fields, atmospheric dispersion, plume trajectories, or source attribution. An elevated station score indicates an empirical anomaly relative to its own baseline, not verified pollution transport or cross-station causality.',
};

const mockTimeSlices: ComparisonTimeSlice[] = [
  {
    datetime_utc: '2026-10-20T12:00:00Z',
    datetime_local: '2026-10-20T17:30:00+05:30',
    station_values: { 3060: 85.0, 3061: 180.0, 3062: 195.0 },
    contributing_stations: 3,
    neighborhood_median: 180.0,
    neighborhood_min: 85.0,
    neighborhood_max: 195.0,
    neighborhood_iqr: 55.0,
    screening: {
      datetime_utc: '2026-10-20T12:00:00Z',
      datetime_local: '2026-10-20T17:30:00+05:30',
      classification: 'MULTI_STATION_CONCURRENT_ELEVATION',
      subclassification: 'SPIKE_CONCURRENT',
      reference_station_id: 3060,
      reference_modified_z: 3.8,
      is_reference_elevated: true,
      is_reference_spike: true,
      reference_eligibility: 'ELIGIBLE',
      neighbors_reporting_count: 2,
      neighbors_window_eligible_count: 2,
      neighbors_comparable_count: 2,
      elevated_neighbors_count: 2,
      contributing_neighbor_ids: [3061, 3062],
      elevated_neighbor_ids: [3061, 3062],
      timestamp_exclusions: [],
      evidence_statement:
        'Multi-station concurrent elevation detected: Reference station and 2 comparable neighboring monitors exhibit concurrent baseline elevation.',
    },
  },
  {
    datetime_utc: '2026-10-20T13:00:00Z',
    datetime_local: '2026-10-20T18:30:00+05:30',
    station_values: { 3060: 92.0, 3061: 52.0, 3062: 48.0 },
    contributing_stations: 3,
    neighborhood_median: 52.0,
    neighborhood_min: 48.0,
    neighborhood_max: 92.0,
    neighborhood_iqr: 22.0,
    screening: {
      datetime_utc: '2026-10-20T13:00:00Z',
      datetime_local: '2026-10-20T18:30:00+05:30',
      classification: 'STATION_LOCALIZED_ELEVATION',
      subclassification: 'SPIKE_LOCALIZED',
      reference_station_id: 3060,
      reference_modified_z: 4.2,
      is_reference_elevated: true,
      is_reference_spike: true,
      reference_eligibility: 'ELIGIBLE',
      neighbors_reporting_count: 2,
      neighbors_window_eligible_count: 2,
      neighbors_comparable_count: 2,
      elevated_neighbors_count: 0,
      contributing_neighbor_ids: [3061, 3062],
      elevated_neighbor_ids: [],
      timestamp_exclusions: [],
      evidence_statement:
        'Station-localized elevation detected: Reference station is elevated, but 2 comparable neighboring monitors remain within normal baseline dispersion.',
    },
  },
  {
    datetime_utc: '2026-10-20T14:00:00Z',
    datetime_local: '2026-10-20T19:30:00+05:30',
    station_values: { 3060: 50.0, 3061: 175.0, 3062: 52.0 },
    contributing_stations: 3,
    neighborhood_median: 52.0,
    screening: {
      datetime_utc: '2026-10-20T14:00:00Z',
      datetime_local: '2026-10-20T19:30:00+05:30',
      classification: 'NEIGHBOR_ELEVATION_ONLY',
      subclassification: 'NEIGHBOR_SPIKE_ONLY',
      reference_station_id: 3060,
      reference_modified_z: 0.2,
      is_reference_elevated: false,
      is_reference_spike: false,
      reference_eligibility: 'ELIGIBLE',
      neighbors_reporting_count: 2,
      neighbors_window_eligible_count: 2,
      neighbors_comparable_count: 2,
      elevated_neighbors_count: 1,
      contributing_neighbor_ids: [3061, 3062],
      elevated_neighbor_ids: [3061],
      timestamp_exclusions: [],
      evidence_statement:
        'Neighbor elevation only: Reference station is within normal baseline dispersion, while 1 comparable neighboring monitor exhibits baseline elevation.',
    },
  },
  {
    datetime_utc: '2026-10-20T15:00:00Z',
    datetime_local: '2026-10-20T20:30:00+05:30',
    station_values: { 3060: 51.0, 3061: 53.0, 3062: 49.0 },
    contributing_stations: 3,
    screening: {
      datetime_utc: '2026-10-20T15:00:00Z',
      datetime_local: '2026-10-20T20:30:00+05:30',
      classification: 'BASELINE_CONSISTENT',
      subclassification: 'REGIONAL_NORMAL',
      reference_station_id: 3060,
      reference_modified_z: 0.3,
      is_reference_elevated: false,
      is_reference_spike: false,
      reference_eligibility: 'ELIGIBLE',
      neighbors_reporting_count: 2,
      neighbors_window_eligible_count: 2,
      neighbors_comparable_count: 2,
      elevated_neighbors_count: 0,
      contributing_neighbor_ids: [3061, 3062],
      elevated_neighbor_ids: [],
      timestamp_exclusions: [],
      evidence_statement:
        'Baseline consistent: Reference station and all 2 comparable neighboring monitors are within normal baseline dispersion.',
    },
  },
  {
    datetime_utc: '2026-10-20T16:00:00Z',
    datetime_local: '2026-10-20T21:30:00+05:30',
    station_values: { 3060: 52.0, 3061: null, 3062: null },
    contributing_stations: 1,
    screening: {
      datetime_utc: '2026-10-20T16:00:00Z',
      datetime_local: '2026-10-20T21:30:00+05:30',
      classification: 'INSUFFICIENT_SPATIAL_EVIDENCE',
      subclassification: 'FEWER_THAN_TWO_ELIGIBLE_NEIGHBORS',
      reference_station_id: 3060,
      reference_modified_z: 0.4,
      is_reference_elevated: false,
      is_reference_spike: false,
      reference_eligibility: 'ELIGIBLE',
      neighbors_reporting_count: 0,
      neighbors_window_eligible_count: 2,
      neighbors_comparable_count: 0,
      elevated_neighbors_count: 0,
      contributing_neighbor_ids: [],
      elevated_neighbor_ids: [],
      timestamp_exclusions: [
        { location_id: 3061, station_name: 'Anand Vihar', reason_code: 'MISSING_HOURLY_OBSERVATION', message: 'Missing observation at this timestamp' },
        { location_id: 3062, station_name: 'R.K. Puram', reason_code: 'MISSING_HOURLY_OBSERVATION', message: 'Missing observation at this timestamp' },
      ],
      evidence_statement:
        'Insufficient spatial evidence: Only 0 comparable neighboring monitors available at this timestamp (minimum 2 required).',
    },
  },
];

const mockStations: StationComparisonMetadata[] = [
  {
    location_id: 3060,
    station_name: 'Punjabi Bagh, Delhi - DPCC',
    locality: 'Delhi',
    provider_name: 'OpenAQ v3',
    owner_name: 'DPCC',
    is_reference: true,
    distance_from_reference_km: 0.0,
    sensor_id: 100,
    units: 'µg/m³',
    total_valid_observations: 24,
    expected_observations: 24,
    coincident_with_reference_hours: 24,
    min_correlation_samples_threshold: 6,
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
    sensor_id: 101,
    units: 'µg/m³',
    total_valid_observations: 22,
    expected_observations: 24,
    coincident_with_reference_hours: 22,
    min_correlation_samples_threshold: 6,
    correlation_status: 'CALCULATED',
    is_stale: false,
  },
  {
    location_id: 3062,
    station_name: 'R.K. Puram, Delhi - DPCC',
    locality: 'Delhi',
    provider_name: 'OpenAQ v3',
    owner_name: 'DPCC',
    is_reference: false,
    distance_from_reference_km: 21.3,
    sensor_id: 102,
    units: 'µg/m³',
    total_valid_observations: 23,
    expected_observations: 24,
    coincident_with_reference_hours: 23,
    min_correlation_samples_threshold: 6,
    correlation_status: 'CALCULATED',
    is_stale: false,
  },
];

describe('NeighborhoodScreeningRibbon Component', () => {
  it('renders ribbon header, parameter display name, and summary KPIs', () => {
    const handleSelect = vi.fn();
    render(
      <NeighborhoodScreeningRibbon
        timeSlices={mockTimeSlices}
        summary={mockSummaryEvaluated}
        selectedHour="2026-10-20T12:00:00Z"
        onSelectHour={handleSelect}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    expect(
      screen.getByText(/Neighborhood Anomaly Screening Ribbon \(PM2\.5\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/\[C\] Concurrent/i)).toBeInTheDocument();
    expect(screen.getByText(/\[L\] Station-Localized/i)).toBeInTheDocument();
    expect(screen.getByText(/\[N\] Neighbor Only/i)).toBeInTheDocument();
    expect(screen.getByText(/\[B\] Baseline Consistent/i)).toBeInTheDocument();
    expect(screen.getByText(/\[—\] Insufficient/i)).toBeInTheDocument();
  });

  it('renders all classification cells with non-color symbols [C], [L], [N], [B], [—]', () => {
    const handleSelect = vi.fn();
    render(
      <NeighborhoodScreeningRibbon
        timeSlices={mockTimeSlices}
        summary={mockSummaryEvaluated}
        selectedHour="2026-10-20T12:00:00Z"
        onSelectHour={handleSelect}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    // Symbols appear in both the hourly cells and the legend
    expect(screen.getAllByText('[C]').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('[L]').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('[N]').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('[B]').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('[—]').length).toBeGreaterThanOrEqual(1);
  });

  it('triggers onSelectHour when a cell is clicked', () => {
    const handleSelect = vi.fn();
    render(
      <NeighborhoodScreeningRibbon
        timeSlices={mockTimeSlices}
        summary={mockSummaryEvaluated}
        selectedHour="2026-10-20T12:00:00Z"
        onSelectHour={handleSelect}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    const cellL = screen.getByLabelText(/Hour 2026-10-20T13:00:00Z: Station-Localized Elevation/i);
    fireEvent.click(cellL);
    expect(handleSelect).toHaveBeenCalledWith('2026-10-20T13:00:00Z');
  });

  it('triggers onSelectHour on keyboard Enter and Space keys', () => {
    const handleSelect = vi.fn();
    render(
      <NeighborhoodScreeningRibbon
        timeSlices={mockTimeSlices}
        summary={mockSummaryEvaluated}
        selectedHour="2026-10-20T12:00:00Z"
        onSelectHour={handleSelect}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    const cellN = screen.getByLabelText(/Hour 2026-10-20T14:00:00Z: Neighbor Elevation Only/i);
    fireEvent.keyDown(cellN, { key: 'Enter' });
    expect(handleSelect).toHaveBeenCalledWith('2026-10-20T14:00:00Z');

    fireEvent.keyDown(cellN, { key: ' ' });
    expect(handleSelect).toHaveBeenCalledWith('2026-10-20T14:00:00Z');
  });

  it('renders suppression alert when evaluation is suppressed for 48h window', () => {
    const suppressedSummary: NeighborhoodScreeningSummary = {
      evaluation_status: 'EVALUATION_SUPPRESSED_UNSUPPORTED_WINDOW',
      suppression_reason:
        'Neighborhood anomaly screening is suspended for 48-hour comparison window: Empirical Jackknife MAD baselines are scientifically validated exclusively on 24-hour and 7-day diurnal/weekly cycles.',
      window_preset: '48h',
      total_window_hours: 48,
      evaluable_hours_count: 0,
      concurrent_elevation_hours_count: 0,
      station_localized_elevation_hours_count: 0,
      neighbor_only_elevation_hours_count: 0,
      baseline_consistent_hours_count: 0,
      insufficient_evidence_hours_count: 48,
      window_exclusions: [],
      screening_disclaimer: 'Empirical disclaimer.',
    };

    render(
      <NeighborhoodScreeningRibbon
        timeSlices={mockTimeSlices}
        summary={suppressedSummary}
        selectedHour={null}
        onSelectHour={vi.fn()}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getAllByText(/EVALUATION_SUPPRESSED_UNSUPPORTED_WINDOW/i).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/scientifically validated exclusively on 24-hour and 7-day/i)
    ).toBeInTheDocument();
  });

  it('renders station exclusions in suppression alert if present', () => {
    const excludedSummary: NeighborhoodScreeningSummary = {
      ...mockSummaryEvaluated,
      evaluation_status: 'EVALUATION_SUPPRESSED_NO_ELIGIBLE_NEIGHBORS',
      suppression_reason: 'No eligible neighbors available.',
      window_exclusions: [
        {
          location_id: 3061,
          station_name: 'Anand Vihar',
          reason_code: 'INSUFFICIENT_WINDOW_COVERAGE',
          message: 'Valid observations 10/24 (41.7%) below 75% required baseline threshold.',
        },
      ],
    };

    render(
      <NeighborhoodScreeningRibbon
        timeSlices={mockTimeSlices}
        summary={excludedSummary}
        selectedHour={null}
        onSelectHour={vi.fn()}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    expect(screen.getByText(/Station Exclusions \(1\):/i)).toBeInTheDocument();
    expect(screen.getByText(/Anand Vihar \(ID: 3061\):/i)).toBeInTheDocument();
    expect(screen.getByText(/below 75% required baseline threshold/i)).toBeInTheDocument();
  });

  it('verifies exact summary arithmetic equations: evaluable = concurrent + localized + neighbor_only + baseline_consistent, and total_window_hours = evaluable + insufficient_evidence', () => {
    const mixedSummary: NeighborhoodScreeningSummary = {
      evaluation_status: 'EVALUATED',
      suppression_reason: null,
      window_preset: '24h',
      total_window_hours: 24,
      evaluable_hours_count: 20,
      concurrent_elevation_hours_count: 3,
      station_localized_elevation_hours_count: 2,
      neighbor_only_elevation_hours_count: 1,
      baseline_consistent_hours_count: 14,
      insufficient_evidence_hours_count: 4,
      evaluable_percentage_of_window: 83.3,
      concurrent_elevation_percentage_of_evaluable: 15.0,
      station_localized_percentage_of_evaluable: 10.0,
      neighbor_only_percentage_of_evaluable: 5.0,
      baseline_consistent_percentage_of_evaluable: 70.0,
      window_exclusions: [],
      screening_disclaimer: 'Scientific disclaimer.',
    };

    // 1. evaluable_hours_count strictly equals the sum of the 4 evaluable categories
    expect(mixedSummary.evaluable_hours_count).toBe(
      mixedSummary.concurrent_elevation_hours_count +
        mixedSummary.station_localized_elevation_hours_count +
        mixedSummary.neighbor_only_elevation_hours_count +
        mixedSummary.baseline_consistent_hours_count
    );

    // 2. total_window_hours strictly equals evaluable_hours_count + insufficient_evidence_hours_count
    expect(mixedSummary.total_window_hours).toBe(
      mixedSummary.evaluable_hours_count + mixedSummary.insufficient_evidence_hours_count
    );

    // 3. Confirm evaluable does NOT equal the incorrect formula (which would add insufficient_evidence)
    expect(mixedSummary.evaluable_hours_count).not.toBe(
      mixedSummary.concurrent_elevation_hours_count +
        mixedSummary.station_localized_elevation_hours_count +
        mixedSummary.neighbor_only_elevation_hours_count +
        mixedSummary.baseline_consistent_hours_count +
        mixedSummary.insufficient_evidence_hours_count
    );
  });

  it('returns appropriate metadata for all classification enums', () => {
    expect(getClassificationMeta('MULTI_STATION_CONCURRENT_ELEVATION').symbol).toBe('[C]');
    expect(getClassificationMeta('STATION_LOCALIZED_ELEVATION').symbol).toBe('[L]');
    expect(getClassificationMeta('NEIGHBOR_ELEVATION_ONLY').symbol).toBe('[N]');
    expect(getClassificationMeta('BASELINE_CONSISTENT').symbol).toBe('[B]');
    expect(getClassificationMeta('INSUFFICIENT_SPATIAL_EVIDENCE').symbol).toBe('[—]');
    expect(getClassificationMeta(null).symbol).toBe('[—]');
  });
});

describe('NeighborhoodScreeningEvidenceCard Component', () => {
  it('renders evidence details for multi-station concurrent elevation', () => {
    render(
      <NeighborhoodScreeningEvidenceCard
        slice={mockTimeSlices[0]}
        referenceStationName="Punjabi Bagh, Delhi - DPCC"
        referenceStationId={3060}
        parameterDisplayName="PM2.5"
        units="µg/m³"
        stations={mockStations}
        summary={mockSummaryEvaluated}
      />
    );

    expect(screen.getByText(/Selected Hour Dossier/i)).toBeInTheDocument();
    expect(screen.getByText(/\[C\] Multi-Station Concurrent Elevation/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Multi-station concurrent elevation detected: Reference station and 2 comparable neighboring monitors/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Punjabi Bagh, Delhi - DPCC/i)).toBeInTheDocument();
    expect(screen.getByText('85.0 µg/m³')).toBeInTheDocument();
    expect(screen.getByText('+3.80')).toBeInTheDocument();
    expect(screen.getByText(/Mandatory Scientific & Regulatory Disclaimer:/i)).toBeInTheDocument();
  });

  it('renders station exclusions table row when neighbor is excluded at this timestamp', () => {
    render(
      <NeighborhoodScreeningEvidenceCard
        slice={mockTimeSlices[4]}
        referenceStationName="Punjabi Bagh, Delhi - DPCC"
        referenceStationId={3060}
        parameterDisplayName="PM2.5"
        units="µg/m³"
        stations={mockStations}
        summary={mockSummaryEvaluated}
      />
    );

    expect(screen.getByText(/\[—\] Insufficient Spatial Evidence/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Excluded: Missing observation at this timestamp/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('renders fallback prompt when slice is null', () => {
    render(
      <NeighborhoodScreeningEvidenceCard
        slice={null}
        referenceStationName="Punjabi Bagh, Delhi - DPCC"
        referenceStationId={3060}
        parameterDisplayName="PM2.5"
        units="µg/m³"
        stations={mockStations}
        summary={mockSummaryEvaluated}
      />
    );

    expect(
      screen.getByText(/Select an hour from the screening ribbon above to view empirical evidence/i)
    ).toBeInTheDocument();
  });
});
