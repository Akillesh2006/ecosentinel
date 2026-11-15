import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OverviewSection } from './OverviewSection';
import { ReportsSection } from './ReportsSection';
import { EvidenceSection } from './EvidenceSection';
import * as api from '../services/api';
import * as exportUtils from '../utils/exportEvidence';
import type {
  LocationDetail,
  LocationMeasurementsResponse,
  RiskAssessmentResponse,
} from '../types';

describe('Day 3 Overview & Structured Evidence Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockLocation: LocationDetail = {
    id: 8118,
    name: 'Anand Vihar, Delhi - DPCC',
    locality: 'Delhi',
    country_code: 'IN',
    country_name: 'India',
    provider_name: 'CPCB',
    owner_name: 'Delhi Pollution Control Committee',
    is_monitor: true,
    is_mobile: false,
    is_stale: false,
    available_parameters: ['pm25', 'pm10'],
    coordinates: { latitude: 28.6476, longitude: 77.3158 },
    instruments: ['Continuous Ambient Air Quality Monitoring Station'],
    licenses: [],
    sensors: [
      {
        id: 101,
        name: 'pm25',
        parameter_id: 2,
        parameter_name: 'pm25',
        parameter_display_name: 'PM2.5',
        units: 'µg/m³',
        datetime_last_utc: '2026-10-26T12:00:00Z',
      },
    ],
  };

  const mockMeasurements: LocationMeasurementsResponse = {
    location_id: 8118,
    station_name: 'Anand Vihar, Delhi - DPCC',
    locality: 'Delhi',
    provider_name: 'CPCB',
    parameter: 'pm25',
    parameter_display_name: 'PM2.5',
    units: 'µg/m³',
    requested_from_utc: '2026-10-25T12:00:00Z',
    requested_to_utc: '2026-10-26T12:00:00Z',
    total_observations: 24,
    excluded_observations: 0,
    missing_percentage: 0,
    is_stale: false,
    retrieved_at_utc: '2026-10-26T12:05:00Z',
    measurements: [
      {
        datetime_from_utc: '2026-10-25T12:00:00Z',
        datetime_to_utc: '2026-10-25T13:00:00Z',
        parameter: 'pm25',
        value: 120.5,
        units: 'µg/m³',
        is_missing: false,
        period_label: '1 hour',
      },
    ],
  };

  const mockAssessment: RiskAssessmentResponse = {
    status: 'above_reference',
    status_label: 'Above Reference',
    parameter: 'pm25',
    parameter_display_name: 'PM2.5',
    averaging_period: '24h',
    averaging_period_label: '24-hour',
    units: 'µg/m³',
    calculated_average: 120.5,
    standard_threshold: 60.0,
    standard_name: 'CPCB NAAQS (2009)',
    ratio_to_standard: 2.01,
    completeness_percentage: 100,
    is_completeness_satisfied: true,
    valid_observations: 24,
    expected_observations: 24,
    excluded_observations: 0,
    freshness_state: 'fresh',
    station_name: 'Anand Vihar, Delhi - DPCC',
    location_id: 8118,
    locality: 'Delhi',
    is_stale: false,
    stale_threshold_hours: 24,
    window_start_utc: '2026-10-25T12:00:00Z',
    window_end_utc: '2026-10-26T12:00:00Z',
    query_timestamp_utc: '2026-10-26T12:05:00Z',
    completeness_rule_label: '75% valid hourly observations required',
    spatial_disclaimer: 'Observations represent physical conditions at this specific coordinate.',
    advisories: [],
  };

  describe('OverviewSection Capabilities & Context', () => {
    it('renders all 5 core platform capability cards with navigation buttons', async () => {
      vi.spyOn(api, 'fetchProviderStatus').mockResolvedValue({
        data: {
          provider: 'OpenAQ v3',
          is_configured: true,
          is_reachable: true,
          base_url: 'https://api.openaq.org/v3',
          message: 'Connected',
          key_instructions: 'Instructions',
        },
        error: null,
      });

      const onNavigateMock = vi.fn();
      render(<OverviewSection onNavigate={onNavigateMock} />);

      expect(screen.getByText(/Environmental Intelligence Overview/i)).toBeInTheDocument();
      expect(screen.getByText(/Station Telemetry & Time-Series/i)).toBeInTheDocument();
      expect(screen.getByText(/Pollution Intelligence & Anomalies/i)).toBeInTheDocument();
      expect(screen.getByText(/Spatial Comparison & Neighbors/i)).toBeInTheDocument();
      expect(screen.getByText(/Evidence & Provenance Audit/i)).toBeInTheDocument();
      expect(screen.getByText(/Facility Action Plan & Reports/i)).toBeInTheDocument();

      // Test navigation triggers
      fireEvent.click(screen.getByRole('button', { name: /Launch Investigation →/i }));
      expect(onNavigateMock).toHaveBeenCalledWith('investigate');

      fireEvent.click(screen.getByRole('button', { name: /Screen Anomalies →/i }));
      expect(onNavigateMock).toHaveBeenCalledWith('anomalies');

      fireEvent.click(screen.getByRole('button', { name: /Compare Neighbors →/i }));
      expect(onNavigateMock).toHaveBeenCalledWith('spatial');

      fireEvent.click(screen.getByRole('button', { name: /Audit Evidence →/i }));
      expect(onNavigateMock).toHaveBeenCalledWith('evidence');

      fireEvent.click(screen.getByRole('button', { name: /Generate Action Dossier →/i }));
      expect(onNavigateMock).toHaveBeenCalledWith('reports');
    });

    it('renders Active Station Snapshot when a station is selected', async () => {
      vi.spyOn(api, 'fetchProviderStatus').mockResolvedValue({
        data: {
          provider: 'OpenAQ v3',
          is_configured: true,
          is_reachable: true,
          base_url: 'https://api.openaq.org/v3',
          message: 'Connected',
          key_instructions: 'Instructions',
        },
        error: null,
      });

      render(
        <OverviewSection
          onNavigate={vi.fn()}
          selectedLocation={mockLocation}
          measurementsData={mockMeasurements}
          assessmentData={mockAssessment}
        />
      );

      expect(screen.getByText(/Active Station: Anand Vihar, Delhi - DPCC/i)).toBeInTheDocument();
      expect(screen.getByText(/28.6476°N, 77.3158°E/i)).toBeInTheDocument();
      expect(screen.getByText(/24 points/i)).toBeInTheDocument();
      expect(screen.getByText(/Above Reference/i)).toBeInTheDocument();
      expect(screen.getByText(/✓ Satisfied \(100.0%\)/i)).toBeInTheDocument();
    });

    it('displays network discovery card when no station is selected', async () => {
      vi.spyOn(api, 'fetchProviderStatus').mockResolvedValue({
        data: {
          provider: 'OpenAQ v3',
          is_configured: true,
          is_reachable: true,
          base_url: 'https://api.openaq.org/v3',
          message: 'Connected',
          key_instructions: 'Instructions',
        },
        error: null,
      });

      const onNavigateMock = vi.fn();
      render(<OverviewSection onNavigate={onNavigateMock} selectedLocation={null} />);

      expect(screen.getByText(/Verified Indian Monitoring Network/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Discover & Select Stations →/i }));
      expect(onNavigateMock).toHaveBeenCalledWith('investigate');
    });

    it('displays configuration notice when API key is unconfigured', async () => {
      vi.spyOn(api, 'fetchProviderStatus').mockResolvedValue({
        data: {
          provider: 'OpenAQ v3',
          is_configured: false,
          is_reachable: true,
          base_url: 'https://api.openaq.org/v3',
          message: 'Missing key',
          key_instructions: 'Set OPENAQ_API_KEY',
        },
        error: null,
      });

      render(<OverviewSection onNavigate={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/Configuration Guidance:/i)).toBeInTheDocument();
        expect(screen.getByText(/explore\.openaq\.org\/register/i)).toBeInTheDocument();
      });
    });
  });

  describe('Structured Evidence Export in Reports & Evidence', () => {
    it('renders Download Observations and Dossier buttons in ReportsSection and triggers download', () => {
      const downloadSpy = vi.spyOn(exportUtils, 'downloadFile').mockImplementation(() => {});

      render(
        <ReportsSection
          locationDetail={mockLocation}
          measurementsData={mockMeasurements}
          assessmentData={mockAssessment}
          onNavigate={vi.fn()}
        />
      );

      const csvBtn = screen.getByRole('button', { name: /Download verified observations CSV/i });
      const jsonBtn = screen.getByRole('button', { name: /Download complete evidence dossier JSON/i });
      const dossierCsvBtn = screen.getByRole('button', { name: /Download evidence dossier summary CSV/i });

      expect(csvBtn).toBeInTheDocument();
      expect(jsonBtn).toBeInTheDocument();
      expect(dossierCsvBtn).toBeInTheDocument();

      fireEvent.click(csvBtn);
      expect(downloadSpy).toHaveBeenCalledWith(
        expect.stringContaining('# EcoSentinel Verified Ambient Observations Export'),
        expect.stringContaining('ecosentinel_observations_8118_pm25_anand_vihar__delhi_-_dpcc.csv'),
        'text/csv'
      );

      fireEvent.click(jsonBtn);
      expect(downloadSpy).toHaveBeenCalledWith(
        expect.stringContaining('EcoSentinel-Environmental-Dossier-v1'),
        expect.stringContaining('ecosentinel_dossier_8118_anand_vihar__delhi_-_dpcc.json'),
        'application/json'
      );

      fireEvent.click(dossierCsvBtn);
      expect(downloadSpy).toHaveBeenCalledWith(
        expect.stringContaining('# EcoSentinel Five-Part Environmental Evidence Dossier'),
        expect.stringContaining('ecosentinel_dossier_summary_8118_anand_vihar__delhi_-_dpcc.csv'),
        'text/csv'
      );
    });

    it('renders Export Audit Observations (CSV) and Audit Record (JSON) in EvidenceSection', () => {
      const downloadSpy = vi.spyOn(exportUtils, 'downloadFile').mockImplementation(() => {});

      render(
        <EvidenceSection
          locationDetail={mockLocation}
          measurementsData={mockMeasurements}
          assessmentData={mockAssessment}
          onNavigate={vi.fn()}
        />
      );

      const csvBtn = screen.getByRole('button', { name: /Export audit observations to CSV/i });
      const jsonBtn = screen.getByRole('button', { name: /Export audit evidence record as JSON/i });

      expect(csvBtn).toBeInTheDocument();
      expect(jsonBtn).toBeInTheDocument();

      fireEvent.click(csvBtn);
      expect(downloadSpy).toHaveBeenCalledWith(
        expect.stringContaining('# EcoSentinel Verified Ambient Observations Export'),
        expect.stringContaining('.csv'),
        'text/csv'
      );

      fireEvent.click(jsonBtn);
      expect(downloadSpy).toHaveBeenCalledWith(
        expect.stringContaining('EcoSentinel-Environmental-Dossier-v1'),
        expect.stringContaining('.json'),
        'application/json'
      );
    });
  });
});
