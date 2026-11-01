import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from './Header';
import type { NavSection, LocationDetail, LocationMeasurementsResponse, RiskAssessmentResponse } from '../types';

const mockSections: NavSection[] = [
  { id: 'overview', label: 'Overview', shortDescription: '', statusBadge: '', statusType: 'active' },
  { id: 'investigate', label: 'Station Telemetry', shortDescription: '', statusBadge: '', statusType: 'active' },
  { id: 'anomalies', label: 'Pollution Intelligence', shortDescription: '', statusBadge: '', statusType: 'active' },
  { id: 'evidence', label: 'Evidence & Data Quality', shortDescription: '', statusBadge: '', statusType: 'active' },
  { id: 'reports', label: 'Environmental Action Plan', shortDescription: '', statusBadge: '', statusType: 'active' },
];

const mockLocation: LocationDetail = {
  id: 8118,
  name: 'Anand Vihar, Delhi - DPCC',
  locality: 'Delhi',
  country_code: 'IN',
  country_name: 'India',
  provider_name: 'OpenAQ v3',
  is_monitor: true,
  is_mobile: false,
  available_parameters: ['pm25'],
  is_stale: false,
  timezone: 'Asia/Kolkata',
  instruments: [],
  licenses: [],
  sensors: [],
};

describe('Header Component', () => {
  it('renders breadcrumb and current section title accurately', () => {
    render(
      <Header
        sections={mockSections}
        activeSection="investigate"
        selectedLocation={null}
      />
    );

    expect(screen.getByText('EcoSentinel')).toBeInTheDocument();
    expect(screen.getByText('Station Telemetry')).toBeInTheDocument();
  });

  it('does NOT render the outdated Milestone 2A badge', () => {
    render(
      <Header
        sections={mockSections}
        activeSection="overview"
      />
    );

    expect(screen.queryByText(/Milestone 2A/i)).not.toBeInTheDocument();
  });

  it('renders selected station context and pollutant badge when a location is active', () => {
    render(
      <Header
        sections={mockSections}
        activeSection="investigate"
        selectedLocation={mockLocation}
        selectedParameter="pm25"
      />
    );

    expect(screen.getByText(/Selected: Anand Vihar, Delhi - DPCC/i)).toBeInTheDocument();
    expect(screen.getByText(/PM2.5/i)).toBeInTheDocument();
  });

  it('renders Fresh Observation status when timestamp is within 3 hours', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();

    const mockMeasurements: Partial<LocationMeasurementsResponse> = {
      sensor_datetime_last_utc: twoHoursAgo,
      parameter_display_name: 'PM2.5',
    };

    render(
      <Header
        sections={mockSections}
        activeSection="investigate"
        selectedLocation={mockLocation}
        measurementsData={mockMeasurements as LocationMeasurementsResponse}
      />
    );

    expect(screen.getByText(/Fresh Observation/i)).toBeInTheDocument();
  });

  it('renders Delayed Observation status when timestamp is between 3 and 24 hours ago', () => {
    const eightHoursAgo = new Date(Date.now() - 8 * 3600 * 1000).toISOString();

    const mockMeasurements: Partial<LocationMeasurementsResponse> = {
      sensor_datetime_last_utc: eightHoursAgo,
      parameter_display_name: 'PM2.5',
    };

    render(
      <Header
        sections={mockSections}
        activeSection="investigate"
        selectedLocation={mockLocation}
        measurementsData={mockMeasurements as LocationMeasurementsResponse}
      />
    );

    expect(screen.getByText(/Delayed Observation/i)).toBeInTheDocument();
  });

  it('renders Stale Observation status when timestamp is older than 24 hours', () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

    const mockMeasurements: Partial<LocationMeasurementsResponse> = {
      sensor_datetime_last_utc: twoDaysAgo,
      parameter_display_name: 'PM2.5',
    };

    render(
      <Header
        sections={mockSections}
        activeSection="investigate"
        selectedLocation={mockLocation}
        measurementsData={mockMeasurements as LocationMeasurementsResponse}
      />
    );

    expect(screen.getByText(/Stale Observation/i)).toBeInTheDocument();
  });

  it('renders Historical Telemetry when data is flagged as historical', () => {
    const mockAssessment: Partial<RiskAssessmentResponse> = {
      freshness_state: 'historical',
      parameter_display_name: 'PM2.5',
    };

    render(
      <Header
        sections={mockSections}
        activeSection="investigate"
        selectedLocation={mockLocation}
        assessmentData={mockAssessment as RiskAssessmentResponse}
      />
    );

    expect(screen.getByText(/Historical Telemetry/i)).toBeInTheDocument();
  });

  it('triggers onToggleMobileMenu when hamburger button is clicked', () => {
    const handleToggle = vi.fn();
    render(
      <Header
        sections={mockSections}
        activeSection="overview"
        onToggleMobileMenu={handleToggle}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /Toggle navigation menu/i });
    fireEvent.click(toggleBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });
});
