import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '../services/api';
import App from '../App';
import { AnomalySection } from './AnomalySection';
import { SpatialSection } from './SpatialSection';
import { ApiKeyMissingBanner } from './ApiKeyMissingBanner';
import type { LocationDetail, LocationSummary } from '../types';

const mockStationDelhi: LocationDetail = {
  id: 8118,
  name: 'Anand Vihar, Delhi - DPCC',
  locality: 'Delhi',
  country_code: 'IN',
  country_name: 'India',
  provider_name: 'Delhi Pollution Control Committee',
  owner_name: 'CPCB',
  is_monitor: true,
  is_mobile: false,
  coordinates: { latitude: 28.6508, longitude: 77.3152 },
  available_parameters: ['pm25', 'pm10', 'no2'],
  datetime_last_utc: '2026-11-14T10:00:00Z',
  datetime_last_local: '2026-11-14T15:30:00+05:30',
  is_stale: false,
  timezone: 'Asia/Kolkata',
  instruments: ['BAM-1020'],
  licenses: [],
  datetime_first_utc: '2018-01-01T00:00:00Z',
  sensors: [
    {
      id: 34771,
      name: 'pm25',
      parameter_id: 2,
      parameter_name: 'pm25',
      parameter_display_name: 'PM2.5',
      units: 'µg/m³',
      datetime_last_utc: '2026-11-14T10:00:00Z',
      datetime_last_local: '2026-11-14T15:30:00+05:30',
    },
  ],
};

const mockStationMumbai: LocationDetail = {
  id: 8119,
  name: 'Bandra, Mumbai - MPCB',
  locality: 'Mumbai',
  country_code: 'IN',
  country_name: 'India',
  provider_name: 'Maharashtra Pollution Control Board',
  owner_name: 'MPCB',
  is_monitor: true,
  is_mobile: false,
  coordinates: { latitude: 19.0596, longitude: 72.8295 },
  available_parameters: ['pm25', 'pm10'],
  datetime_last_utc: '2026-11-14T09:00:00Z',
  datetime_last_local: '2026-11-14T14:30:00+05:30',
  is_stale: false,
  timezone: 'Asia/Kolkata',
  instruments: [],
  licenses: [],
  datetime_first_utc: '2019-01-01T00:00:00Z',
  sensors: [
    {
      id: 34772,
      name: 'pm25',
      parameter_id: 2,
      parameter_name: 'pm25',
      parameter_display_name: 'PM2.5',
      units: 'µg/m³',
      datetime_last_utc: '2026-11-14T09:00:00Z',
      datetime_last_local: '2026-11-14T14:30:00+05:30',
    },
  ],
};

const mockLocationsSummaryList: LocationSummary[] = [
  {
    id: 8118,
    name: 'Anand Vihar, Delhi - DPCC',
    locality: 'Delhi',
    country_code: 'IN',
    country_name: 'India',
    provider_name: 'DPCC',
    is_monitor: true,
    is_mobile: false,
    coordinates: { latitude: 28.6508, longitude: 77.3152 },
    available_parameters: ['pm25', 'pm10'],
    datetime_last_utc: '2026-11-14T10:00:00Z',
    datetime_last_local: '2026-11-14T15:30:00+05:30',
    is_stale: false,
  },
  {
    id: 8119,
    name: 'Bandra, Mumbai - MPCB',
    locality: 'Mumbai',
    country_code: 'IN',
    country_name: 'India',
    provider_name: 'MPCB',
    is_monitor: true,
    is_mobile: false,
    coordinates: { latitude: 19.0596, longitude: 72.8295 },
    available_parameters: ['pm25', 'pm10'],
    datetime_last_utc: '2026-11-14T09:00:00Z',
    datetime_last_local: '2026-11-14T14:30:00+05:30',
    is_stale: false,
  },
];

describe('Day 2 Frontend Consistency & UX Requirements', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(api, 'checkBackendHealth').mockResolvedValue({
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        environment: 'development',
        milestone: 'Milestone 7 - Spatial Analysis & Neighborhood Screening',
      },
      error: null,
      latencyMs: 12,
    });
  });

  it('Requirement 3: does NOT fetch telemetry or locations merely because Overview is initially rendered', async () => {
    const fetchLocationsSpy = vi.spyOn(api, 'fetchLocations').mockResolvedValue({
      data: mockLocationsSummaryList,
      error: null,
    });
    const fetchMeasurementsSpy = vi.spyOn(api, 'fetchMeasurements').mockResolvedValue({
      data: null,
      error: null,
    });

    render(<App />);

    // Verify Overview / Home is active via lazy route
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Environmental Intelligence Overview/i })).toBeInTheDocument();
    });

    // Give any pending microtasks time to execute
    await new Promise((r) => setTimeout(r, 50));

    // Neither locations nor measurements should have been fetched
    expect(fetchLocationsSpy).not.toHaveBeenCalled();
    expect(fetchMeasurementsSpy).not.toHaveBeenCalled();
  });

  it('Requirement 4: fetches telemetry data when user navigates to the Stations route', async () => {
    const fetchLocationsSpy = vi.spyOn(api, 'fetchLocations').mockResolvedValue({
      data: mockLocationsSummaryList,
      error: null,
    });
    vi.spyOn(api, 'fetchLocationDetail').mockResolvedValue({
      data: mockStationDelhi,
      error: null,
    });
    const fetchMeasurementsSpy = vi.spyOn(api, 'fetchMeasurements').mockResolvedValue({
      data: {
        location_id: 8118,
        station_name: 'Anand Vihar, Delhi - DPCC',
        locality: 'Delhi',
        provider_name: 'DPCC',
        parameter: 'pm25',
        parameter_display_name: 'PM2.5',
        units: 'µg/m³',
        sensor_id: 34771,
        sensor_datetime_last_utc: '2026-11-14T10:00:00Z',
        sensor_datetime_last_local: '2026-11-14T15:30:00+05:30',
        requested_from_utc: '2026-11-13T10:00:00Z',
        requested_to_utc: '2026-11-14T10:00:00Z',
        retrieved_at_utc: '2026-11-14T10:05:00Z',
        total_observations: 24,
        expected_observations: 24,
        missing_percentage: 0.0,
        is_stale: false,
        stale_message: null,
        data_integrity_notice: 'Verified physical concentration',
        excluded_observations: 0,
        data_quality_warnings: [],
        measurements: [],
      },
      error: null,
    });

    render(<App />);

    // Navigate to Stations view via sidebar
    const sidebarNav = await screen.findByRole('navigation', { name: /Dashboard workspaces/i });
    fireEvent.click(within(sidebarNav).getByRole('link', { name: 'Stations' }));

    await waitFor(() => {
      expect(fetchLocationsSpy).toHaveBeenCalledTimes(1);
      expect(fetchMeasurementsSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Anand Vihar, Delhi - DPCC')).toBeInTheDocument();
    });
  });

  it('Requirement 5: does NOT refetch spatial station catalog when only reference station ID changes', async () => {
    const fetchLocationsSpy = vi.spyOn(api, 'fetchLocations').mockResolvedValue({
      data: mockLocationsSummaryList,
      error: null,
    });
    vi.spyOn(api, 'fetchSpatialNeighbors').mockResolvedValue({
      data: {
        reference_station_id: 8118,
        reference_station_name: 'Anand Vihar, Delhi - DPCC',
        parameter: 'pm25',
        search_radius_km: 25,
        total_candidates_examined: 10,
        missing_coordinates_count: 0,
        pollutant_absent_count: 0,
        outside_radius_count: 5,
        eligible_neighbors_count: 2,
        neighbors: [
          {
            id: 8119,
            name: 'Bandra, Mumbai - MPCB',
            locality: 'Mumbai',
            provider_name: 'MPCB',
            distance_km: 12.5,
            direction_cardinal: 'SW',
            coordinates: { latitude: 19.0596, longitude: 72.8295 },
            sensor_id: 34772,
            parameter: 'pm25',
            units: 'µg/m³',
            is_stale: false,
            datetime_last_utc: '2026-11-14T09:00:00Z',
            datetime_last_local: '2026-11-14T14:30:00+05:30',
          },
        ],
      },
      error: null,
    });
    vi.spyOn(api, 'fetchLocationDetail').mockResolvedValue({
      data: mockStationMumbai,
      error: null,
    });

    const onSelectLocationMock = vi.fn();

    render(
      <SpatialSection
        selectedLocation={mockStationDelhi}
        onSelectLocation={onSelectLocationMock}
        activeParameter="pm25"
      />
    );

    // Initial mount fetches catalog once
    await waitFor(() => {
      expect(fetchLocationsSpy).toHaveBeenCalledTimes(1);
    });

    // Change reference station dropdown to station 8119
    const refStationSelect = screen.getByLabelText(/Reference Station/i);
    fireEvent.change(refStationSelect, { target: { value: '8119' } });

    // Wait for state updates
    await waitFor(() => {
      expect(onSelectLocationMock).toHaveBeenCalledWith(mockStationMumbai);
    });

    // Verify fetchLocations was STILL only called once (no redundant fetch!)
    expect(fetchLocationsSpy).toHaveBeenCalledTimes(1);
  });

  it('Requirement 6: renders consistent ApiKeyMissingBanner with exact setup guidance on MISSING_API_KEY error', () => {
    const onRetryMock = vi.fn();
    render(<ApiKeyMissingBanner onRetry={onRetryMock} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/OpenAQ API Key Required for Live Station Queries/i)).toBeInTheDocument();
    expect(screen.getByText(/explore\.openaq\.org\/register/i)).toBeInTheDocument();
    expect(screen.getByText(/OPENAQ_API_KEY="your_api_key_here"/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Retry Station Query/i });
    fireEvent.click(retryBtn);
    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });

  it('Requirement 6 in AnomalySection: renders ApiKeyMissingBanner when backend returns MISSING_API_KEY', async () => {
    vi.spyOn(api, 'fetchLocations').mockResolvedValue({ data: mockLocationsSummaryList, error: null });
    vi.spyOn(api, 'fetchAirQualityAnomalies').mockResolvedValue({
      data: null,
      error: {
        error: 'MISSING_API_KEY',
        error_code: 'MISSING_API_KEY',
        message: 'OpenAQ API key is not configured on the EcoSentinel backend.',
        instructions: 'Register at explore.openaq.org',
        status: 503,
      },
    });

    render(<AnomalySection selectedLocation={mockStationDelhi} activeParameter="pm25" />);

    await waitFor(() => {
      expect(screen.getByText(/OpenAQ API Key Required for Live Station Queries/i)).toBeInTheDocument();
      expect(screen.getByText(/OPENAQ_API_KEY="your_api_key_here"/i)).toBeInTheDocument();
    });

    // Generic error box should NOT be shown
    expect(screen.queryByText(/Anomaly Detection Error/i)).not.toBeInTheDocument();
  });

  it('Requirement 7: places Caller Precision Test in Advanced Controls details element', () => {
    vi.spyOn(api, 'fetchLocations').mockResolvedValue({ data: mockLocationsSummaryList, error: null });
    vi.spyOn(api, 'fetchAirQualityAnomalies').mockResolvedValue({
      data: null,
      error: null,
    });

    render(<AnomalySection selectedLocation={mockStationDelhi} activeParameter="pm25" />);

    // The advanced summary should be rendered
    expect(screen.getByText(/Advanced Controls & Sensor Precision Calibration/i)).toBeInTheDocument();

    // The input is available under the label
    const precisionInput = screen.getByLabelText(/Caller Precision Test \(Optional\)/i);
    expect(precisionInput).toBeInTheDocument();
    expect(precisionInput).toHaveAttribute('id', 'precision-input');

    // Entering a value works
    fireEvent.change(precisionInput, { target: { value: '0.05' } });
    expect(precisionInput).toHaveValue(0.05);
  });
});
