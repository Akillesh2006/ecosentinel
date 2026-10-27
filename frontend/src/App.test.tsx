import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import * as api from './services/api';
import type {
  LocationDetail,
  LocationMeasurementsResponse,
  LocationSummary,
  ProviderStatusResponse,
} from './types';

const mockHealthOk = {
  data: {
    status: 'ok',
    app: 'EcoSentinel',
    version: '0.2.0',
    timestamp: '2026-10-26T14:30:00Z',
    environment: 'development',
    milestone: 'Milestone 2A - Air Quality Investigation',
  },
  error: null,
  latencyMs: 10,
};

const mockProviderStatusOk: { data: ProviderStatusResponse; error: null } = {
  data: {
    provider: 'OpenAQ v3',
    is_configured: true,
    is_reachable: true,
    base_url: 'https://api.openaq.org/v3',
    message: 'Provider is active and reachable',
    key_instructions: 'API key configured in OPENAQ_API_KEY',
  },
  error: null,
};

const mockLocationsList: LocationSummary[] = [
  {
    id: 8118,
    name: 'Anand Vihar, Delhi - DPCC',
    locality: 'Delhi',
    country_code: 'IN',
    country_name: 'India',
    provider_name: 'OpenAQ v3',
    owner_name: 'Delhi Pollution Control Committee',
    is_monitor: true,
    is_mobile: false,
    coordinates: { latitude: 28.6508, longitude: 77.3152 },
    available_parameters: ['pm25', 'pm10'],
    datetime_last_utc: '2026-10-26T12:00:00Z',
    datetime_last_local: '2026-10-26T17:30:00+05:30',
    is_stale: false,
  },
  {
    id: 8119,
    name: 'Bandra, Mumbai - MPCB',
    locality: 'Mumbai',
    country_code: 'IN',
    country_name: 'India',
    provider_name: 'OpenAQ v3',
    owner_name: 'Maharashtra Pollution Control Board',
    is_monitor: true,
    is_mobile: false,
    coordinates: { latitude: 19.0596, longitude: 72.8295 },
    available_parameters: ['pm25'],
    datetime_last_utc: '2026-10-20T08:00:00Z',
    datetime_last_local: '2026-10-20T13:30:00+05:30',
    is_stale: true,
  },
];

const mockLocationDetailDelhi: LocationDetail = {
  id: 8118,
  name: 'Anand Vihar, Delhi - DPCC',
  locality: 'Delhi',
  country_code: 'IN',
  country_name: 'India',
  provider_name: 'OpenAQ v3',
  owner_name: 'Delhi Pollution Control Committee',
  is_monitor: true,
  is_mobile: false,
  coordinates: { latitude: 28.6508, longitude: 77.3152 },
  available_parameters: ['pm25', 'pm10'],
  datetime_last_utc: '2026-10-26T12:00:00Z',
  datetime_last_local: '2026-10-26T17:30:00+05:30',
  is_stale: false,
  timezone: 'Asia/Kolkata',
  instruments: ['BAM-1020 Beta Attenuation Monitor'],
  licenses: [],
  sensors: [
    {
      id: 101,
      name: 'pm25-channel-1',
      parameter_id: 2,
      parameter_name: 'pm25',
      parameter_display_name: 'PM2.5',
      units: 'µg/m³',
    },
    {
      id: 102,
      name: 'pm10-channel-1',
      parameter_id: 1,
      parameter_name: 'pm10',
      parameter_display_name: 'PM10',
      units: 'µg/m³',
    },
  ],
};

const mockMeasurementsDelhi: LocationMeasurementsResponse = {
  location_id: 8118,
  station_name: 'Anand Vihar, Delhi - DPCC',
  locality: 'Delhi',
  provider_name: 'OpenAQ v3',
  parameter: 'pm25',
  parameter_display_name: 'PM2.5',
  units: 'µg/m³',
  sensor_id: 101,
  requested_from_utc: '2026-10-25T12:00:00Z',
  requested_to_utc: '2026-10-26T12:00:00Z',
  retrieved_at_utc: '2026-10-26T14:30:00Z',
  total_observations: 2,
  expected_observations: 24,
  missing_percentage: 91.7,
  is_stale: false,
  stale_message: null,
  data_integrity_notice:
    'Concentration measurements reflect physical observations and do not represent calculated AQI or legal pollution causation.',
  measurements: [
    {
      value: 142.5,
      parameter: 'pm25',
      units: 'µg/m³',
      period_label: 'hour',
      interval: '01:00:00',
      datetime_from_utc: '2026-10-26T11:00:00Z',
      datetime_to_utc: '2026-10-26T12:00:00Z',
      datetime_from_local: '2026-10-26 16:30:00 IST',
      datetime_to_local: '2026-10-26 17:30:00 IST',
      is_missing: false,
      percent_complete: 100.0,
    },
    {
      value: 158.0,
      parameter: 'pm25',
      units: 'µg/m³',
      period_label: 'hour',
      interval: '01:00:00',
      datetime_from_utc: '2026-10-26T12:00:00Z',
      datetime_to_utc: '2026-10-26T13:00:00Z',
      datetime_from_local: '2026-10-26 17:30:00 IST',
      datetime_to_local: '2026-10-26 18:30:00 IST',
      is_missing: false,
      percent_complete: 100.0,
    },
  ],
};

describe('EcoSentinel Frontend Application', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'checkBackendHealth').mockResolvedValue(mockHealthOk);
    vi.spyOn(api, 'fetchProviderStatus').mockResolvedValue(mockProviderStatusOk);
    vi.spyOn(api, 'fetchLocations').mockResolvedValue({ data: mockLocationsList, error: null });
    vi.spyOn(api, 'fetchLocationDetail').mockResolvedValue({ data: mockLocationDetailDelhi, error: null });
    vi.spyOn(api, 'fetchMeasurements').mockResolvedValue({ data: mockMeasurementsDelhi, error: null });
  });

  it('renders branding title and tagline accurately', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('EcoSentinel');
    expect(screen.getByText(/Evidence-based environmental intelligence · India Air Quality/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Backend Connected — EcoSentinel/i)).toBeInTheDocument();
    });
  });

  it('renders connected backend status when health check succeeds', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Backend Connected — EcoSentinel v0.2.0/i)).toBeInTheDocument();
    });
  });

  it('renders offline message with uvicorn run command when backend is unreachable', async () => {
    vi.spyOn(api, 'checkBackendHealth').mockResolvedValue({
      data: null,
      error: 'Unable to reach backend service (Failed to fetch)',
      latencyMs: 30,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Backend Service Offline \(Local Mode\)/i)).toBeInTheDocument();
      expect(screen.getByText(/uvicorn app.main:app --reload/i)).toBeInTheDocument();
    });
  });

  it('navigates between all four dashboard sections via tabs', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Environmental Intelligence Overview/i })).toBeInTheDocument();
    });

    // Switch to Investigate
    fireEvent.click(screen.getByRole('tab', { name: /Investigate/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Investigate Air Quality in India/i })).toBeInTheDocument();
    });

    // Switch to Evidence & Data Quality
    fireEvent.click(screen.getByRole('tab', { name: /Evidence & Data Quality/i }));
    expect(screen.getByRole('heading', { level: 2, name: /Evidence & Data Quality Audit/i })).toBeInTheDocument();

    // Switch to Investigation Reports
    fireEvent.click(screen.getByRole('tab', { name: /Investigation Reports/i }));
    expect(screen.getByRole('heading', { level: 2, name: /Investigation Reports & Summaries/i })).toBeInTheDocument();
  });

  it('searches and selects an Indian station and displays metadata', async () => {
    render(<App />);

    // Go to Investigate tab
    fireEvent.click(screen.getByRole('tab', { name: /Investigate/i }));

    await waitFor(() => {
      expect(screen.getByText('Anand Vihar, Delhi - DPCC')).toBeInTheDocument();
    });

    // Verify metadata card
    expect(screen.getByText(/Reference Monitor/i)).toBeInTheDocument();
    expect(screen.getByText(/Station #8118/i)).toBeInTheDocument();
    expect(screen.getByText(/Delhi, India · Provider:/i)).toBeInTheDocument();
    expect(screen.getByText(/28.6508°N, 77.3152°E/i)).toBeInTheDocument();
  });

  it('renders time-series chart and accessible table without fabricated data', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: /Investigate/i }));

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /Time series chart of PM2.5 at Anand Vihar/i })).toBeInTheDocument();
    });

    // Check table elements
    expect(screen.getByRole('table', { name: /Observation records for PM2.5/i })).toBeInTheDocument();
    expect(screen.getByText('142.50')).toBeInTheDocument();
    expect(screen.getByText('158.00')).toBeInTheDocument();

    // Data integrity disclaimer is visible
    expect(screen.getByText(/Concentration measurements reflect physical observations/i)).toBeInTheDocument();
  });

  it('displays missing API key warning card when backend returns MISSING_API_KEY error', async () => {
    vi.spyOn(api, 'fetchLocations').mockResolvedValue({
      data: null,
      error: {
        error_code: 'MISSING_API_KEY',
        message: 'OpenAQ API key not configured',
        instructions: 'Set OPENAQ_API_KEY in your environment',
      },
    });

    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Investigate/i }));

    await waitFor(() => {
      expect(screen.getByText(/OpenAQ API Key Required for Live Station Queries/i)).toBeInTheDocument();
      expect(screen.getByText(/OPENAQ_API_KEY="your_api_key_here"/i)).toBeInTheDocument();
    });
  });

  it('displays upstream error alert and avoids fake chart data when API fails', async () => {
    vi.spyOn(api, 'fetchMeasurements').mockResolvedValue({
      data: null,
      error: {
        error_code: 'RATE_LIMIT_EXCEEDED',
        message: 'OpenAQ API rate limit exceeded (60 requests/minute).',
        instructions: 'Wait 60 seconds before retrying.',
      },
    });

    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Investigate/i }));

    await waitFor(() => {
      expect(screen.getByText(/Upstream Error \(RATE_LIMIT_EXCEEDED\)/i)).toBeInTheDocument();
    });

    // Ensure no chart or table is displayed with fake data
    expect(screen.queryByRole('img', { name: /Time series chart/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /Observation records/i })).not.toBeInTheDocument();
  });

  it('displays empty state when search returns no matching Indian locations', async () => {
    vi.spyOn(api, 'fetchLocations').mockResolvedValue({ data: [], error: null });

    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Investigate/i }));

    await waitFor(() => {
      expect(screen.getByText(/No Matching Indian Monitoring Stations/i)).toBeInTheDocument();
    });
  });

  it('displays empty period state when station has zero observations for selected window', async () => {
    const emptyMeasurements: LocationMeasurementsResponse = {
      ...mockMeasurementsDelhi,
      total_observations: 0,
      measurements: [],
    };
    vi.spyOn(api, 'fetchMeasurements').mockResolvedValue({ data: emptyMeasurements, error: null });

    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Investigate/i }));

    await waitFor(() => {
      expect(screen.getByText(/No observations recorded for this station and parameter in the selected period/i)).toBeInTheDocument();
    });
  });

  it('shows stale data warning banner when station observations are older than 24 hours', async () => {
    const staleLocationDetail: LocationDetail = {
      ...mockLocationDetailDelhi,
      is_stale: true,
      datetime_last_utc: '2026-10-20T10:00:00Z',
    };
    vi.spyOn(api, 'fetchLocationDetail').mockResolvedValue({ data: staleLocationDetail, error: null });

    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Investigate/i }));

    await waitFor(() => {
      expect(screen.getByText(/Data Freshness Notice:/i)).toBeInTheDocument();
      expect(screen.getByText(/Stale Observations/i)).toBeInTheDocument();
    });
  });

  it('generates client-side summary dossier in Reports tab when measurements are loaded', async () => {
    render(<App />);

    // Load measurements in Investigate tab first
    fireEvent.click(screen.getByRole('tab', { name: /Investigate/i }));
    await waitFor(() => {
      expect(screen.getByText('142.50')).toBeInTheDocument();
    });

    // Switch to Reports tab
    fireEvent.click(screen.getByRole('tab', { name: /Investigation Reports/i }));

    await waitFor(() => {
      expect(screen.getByText(/Client-Side Summary Dossier/i)).toBeInTheDocument();
      expect(screen.getByText(/Observed Range \(Min - Max\)/i)).toBeInTheDocument();
      expect(screen.getByText(/142.50 – 158.00/i)).toBeInTheDocument();
      expect(screen.getByText(/Milestone 2A Scope:/i)).toBeInTheDocument();
    });
  });

  it('offers button to view historical observations when station ceased active reporting', async () => {
    const historicalDetail: LocationDetail = {
      ...mockLocationDetailDelhi,
      id: 13,
      name: 'Delhi Technological University, Delhi - CPCB',
      datetime_last_utc: '2018-02-22T04:00:00Z',
      is_stale: true,
      sensors: [
        {
          id: 13864,
          name: 'pm25 ug/m3',
          parameter_id: 2,
          parameter_name: 'pm25',
          parameter_display_name: 'PM2.5',
          units: 'µg/m³',
          datetime_last_utc: '2018-02-22T04:00:00Z',
        },
      ],
    };
    const emptyMeasurements: LocationMeasurementsResponse = {
      ...mockMeasurementsDelhi,
      location_id: 13,
      total_observations: 0,
      measurements: [],
      sensor_datetime_last_utc: '2018-02-22T04:00:00Z',
    };

    vi.spyOn(api, 'fetchLocationDetail').mockResolvedValue({ data: historicalDetail, error: null });
    vi.spyOn(api, 'fetchMeasurements').mockResolvedValue({ data: emptyMeasurements, error: null });

    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Investigate/i }));

    await waitFor(() => {
      expect(screen.getByText(/View Historical Observations \(7-Day Period Ending 2018-02-22\)/i)).toBeInTheDocument();
      expect(screen.getByText(/transmission ceased/i)).toBeInTheDocument();
    });
  });

  it('displays accurate data completeness and clearly distinguishes retrieval time from latest measurement time', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Investigate/i }));

    await waitFor(() => {
      // 100 - 91.7 = 8.3% completeness displayed
      expect(screen.getByText('8.3%')).toBeInTheDocument();
      // Clearly labeled latest observation time
      expect(screen.getByText('Latest Measurement Time')).toBeInTheDocument();
      // Clearly labeled retrieval time
      expect(screen.getByText('Query Timestamp (Retrieved)')).toBeInTheDocument();
      expect(screen.getByText('2026-10-26 14:30:00 UTC')).toBeInTheDocument();
    });
  });

  it('displays 0.0% data completeness when zero observations are returned in period', async () => {
    const emptyMeasurements: LocationMeasurementsResponse = {
      ...mockMeasurementsDelhi,
      total_observations: 0,
      measurements: [],
      missing_percentage: 100.0,
    };
    vi.spyOn(api, 'fetchMeasurements').mockResolvedValue({ data: emptyMeasurements, error: null });

    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Investigate/i }));

    await waitFor(() => {
      expect(screen.getByText('0.0%')).toBeInTheDocument();
      expect(screen.queryByText('100%')).not.toBeInTheDocument();
    });
  });

  it('displays stale sensor warning when selected pollutant sensor is stale even if station is active', async () => {
    const stationActiveButSensorStale: LocationDetail = {
      ...mockLocationDetailDelhi,
      is_stale: false, // Station feed itself is marked active
      sensors: [
        {
          id: 101,
          name: 'pm25-channel-1',
          parameter_id: 2,
          parameter_name: 'pm25',
          parameter_display_name: 'PM2.5',
          units: 'µg/m³',
          datetime_last_utc: '2026-10-20T10:00:00Z', // 6 days ago -> stale!
          datetime_last_local: '2026-10-20 15:30:00 IST',
        },
      ],
    };
    const staleMeasurements: LocationMeasurementsResponse = {
      ...mockMeasurementsDelhi,
      is_stale: true,
      stale_message: 'Last observation for PM2.5 was recorded 6d 0h ago.',
      sensor_datetime_last_utc: '2026-10-20T10:00:00Z',
      sensor_datetime_last_local: '2026-10-20 15:30:00 IST',
    };

    vi.spyOn(api, 'fetchLocationDetail').mockResolvedValue({ data: stationActiveButSensorStale, error: null });
    vi.spyOn(api, 'fetchMeasurements').mockResolvedValue({ data: staleMeasurements, error: null });

    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Investigate/i }));

    await waitFor(() => {
      // Must display stale observation warning specific to the selected sensor
      expect(screen.getByText(/Data Freshness Notice:/i)).toBeInTheDocument();
      expect(screen.getByText(/Stale Observations/i)).toBeInTheDocument();
      expect(screen.getByText(/Last observation for PM2.5 was recorded 6d 0h ago/i)).toBeInTheDocument();
    });
  });
});
