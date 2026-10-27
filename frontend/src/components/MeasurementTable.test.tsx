import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  MeasurementTable,
  formatUtcWindow,
  formatLocalWindow,
} from './MeasurementTable';
import type { MeasurementPoint } from '../types';

describe('MeasurementTable Window Formatting Helpers', () => {
  it('formats same-day UTC observation window with start and end times', () => {
    const formatted = formatUtcWindow('2026-10-20T13:30:00Z', '2026-10-20T14:30:00Z');
    expect(formatted).toBe('2026-10-20 13:30:00 → 14:30:00 UTC');
  });

  it('formats multi-day UTC observation window crossing midnight', () => {
    const formatted = formatUtcWindow('2026-10-20T23:30:00Z', '2026-10-21T00:30:00Z');
    expect(formatted).toBe('2026-10-20 23:30:00 → 2026-10-21 00:30:00 UTC');
  });

  it('falls back cleanly if toUtc is missing', () => {
    expect(formatUtcWindow('2026-10-20T13:30:00Z', null)).toBe('2026-10-20 13:30:00 UTC');
    expect(formatUtcWindow(null, null)).toBe('N/A');
  });

  it('formats same-day local timestamp window (ISO format)', () => {
    const formatted = formatLocalWindow('2026-10-20T19:00:00+05:30', '2026-10-20T20:00:00+05:30');
    expect(formatted).toBe('2026-10-20 19:00:00+05:30 → 20:00:00+05:30');
  });

  it('formats same-day local timestamp window (IST format)', () => {
    const formatted = formatLocalWindow('2026-10-26 16:30:00 IST', '2026-10-26 17:30:00 IST');
    expect(formatted).toBe('2026-10-26 16:30:00 IST → 17:30:00 IST');
  });

  it('formats multi-day local timestamp window crossing midnight', () => {
    const formatted = formatLocalWindow('2026-10-20T23:00:00+05:30', '2026-10-21T00:00:00+05:30');
    expect(formatted).toBe('2026-10-20 23:00:00+05:30 → 2026-10-21 00:00:00+05:30');
  });

  it('falls back cleanly if toLocal is missing', () => {
    expect(formatLocalWindow('2026-10-20T19:00:00+05:30', null)).toBe('2026-10-20T19:00:00+05:30');
    expect(formatLocalWindow(null, null)).toBe('N/A');
  });
});

describe('MeasurementTable Component', () => {
  const oct20Records: MeasurementPoint[] = [
    {
      value: 10.5,
      parameter: 'pm25',
      units: 'µg/m³',
      period_label: '1hour',
      interval: '01:00:00',
      datetime_from_utc: '2026-10-20T13:30:00Z',
      datetime_to_utc: '2026-10-20T14:30:00Z',
      datetime_from_local: '2026-10-20T19:00:00+05:30',
      datetime_to_local: '2026-10-20T20:00:00+05:30',
      is_missing: false,
      percent_complete: 75.0,
    },
    {
      value: 9.52,
      parameter: 'pm25',
      units: 'µg/m³',
      period_label: '1hour',
      interval: '01:00:00',
      datetime_from_utc: '2026-10-20T14:30:00Z',
      datetime_to_utc: '2026-10-20T15:30:00Z',
      datetime_from_local: '2026-10-20T20:00:00+05:30',
      datetime_to_local: '2026-10-20T21:00:00+05:30',
      is_missing: false,
      percent_complete: 75.0,
    },
  ];

  it('renders table headers and resolves period start/end disambiguation', () => {
    render(
      <MeasurementTable
        measurements={oct20Records}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    // Headers
    expect(screen.getByText('Observation Window (UTC)')).toBeInTheDocument();
    expect(screen.getByText('Local Timestamp (Start → End)')).toBeInTheDocument();
    expect(screen.getByText('Measured Concentration')).toBeInTheDocument();

    // Provenance note
    expect(
      screen.getByText(/Hourly observations represent 60-minute windows \(OpenAQ Explorer labels by period end\)/i)
    ).toBeInTheDocument();

    // Verify row 1 (10.5 µg/m³) displays both start (19:00) and end (20:00) IST
    expect(screen.getByText('10.50')).toBeInTheDocument();
    expect(screen.getByText('2026-10-20 13:30:00 → 14:30:00 UTC')).toBeInTheDocument();
    expect(screen.getByText('2026-10-20 19:00:00+05:30 → 20:00:00+05:30')).toBeInTheDocument();

    // Verify row 2 (9.52 µg/m³) displays both start (20:00) and end (21:00) IST
    expect(screen.getByText('9.52')).toBeInTheDocument();
    expect(screen.getByText('2026-10-20 14:30:00 → 15:30:00 UTC')).toBeInTheDocument();
    expect(screen.getByText('2026-10-20 20:00:00+05:30 → 21:00:00+05:30')).toBeInTheDocument();
  });

  it('renders empty message when measurements array is empty', () => {
    render(
      <MeasurementTable
        measurements={[]}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    expect(
      screen.getByText('No observations available in this measurement window.')
    ).toBeInTheDocument();
  });

  it('handles pagination correctly when measurements exceed pageSize', () => {
    const manyRecords: MeasurementPoint[] = Array.from({ length: 15 }, (_, i) => ({
      value: 10 + i,
      parameter: 'pm25',
      units: 'µg/m³',
      period_label: '1hour',
      interval: '01:00:00',
      datetime_from_utc: `2026-10-20T${String(i).padStart(2, '0')}:00:00Z`,
      datetime_to_utc: `2026-10-20T${String(i + 1).padStart(2, '0')}:00:00Z`,
      datetime_from_local: `2026-10-20T${String(i).padStart(2, '0')}:00:00+05:30`,
      datetime_to_local: `2026-10-20T${String(i + 1).padStart(2, '0')}:00:00+05:30`,
      is_missing: false,
    }));

    render(
      <MeasurementTable
        measurements={manyRecords}
        parameterDisplayName="PM2.5"
        units="µg/m³"
      />
    );

    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    const nextBtn = screen.getByRole('button', { name: /Next page of measurements/i });
    fireEvent.click(nextBtn);
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('renders station provenance (stationName, locationId, sensorId) in table header', () => {
    render(
      <MeasurementTable
        measurements={oct20Records}
        parameterDisplayName="PM2.5"
        units="µg/m³"
        stationName="Perungudi, Chennai - TNPCB"
        locationId={12046}
        sensorId={12236290}
      />
    );

    expect(screen.getByText(/Perungudi, Chennai - TNPCB/i)).toBeInTheDocument();
    expect(screen.getByText(/Location ID: 12046/i)).toBeInTheDocument();
    expect(screen.getByText(/Sensor #12236290/i)).toBeInTheDocument();
  });
});

