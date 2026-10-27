import React, { useState } from 'react';
import type { MeasurementPoint } from '../types';

interface MeasurementTableProps {
  measurements: MeasurementPoint[];
  parameterDisplayName: string;
  units: string;
  stationName?: string;
  locationId?: number;
  sensorId?: number;
}

export function formatUtcWindow(fromUtc?: string | null, toUtc?: string | null): string {
  if (!fromUtc) return 'N/A';
  const cleanFrom = fromUtc
    .replace(/^(\d{4}-\d{2}-\d{2})T/, '$1 ')
    .replace(/Z$/, '')
    .replace(/\+00:00$/, '')
    .trim();
  if (!toUtc) return `${cleanFrom} UTC`;
  const cleanTo = toUtc
    .replace(/^(\d{4}-\d{2}-\d{2})T/, '$1 ')
    .replace(/Z$/, '')
    .replace(/\+00:00$/, '')
    .trim();

  const [fromDate] = cleanFrom.split(' ');
  const [toDate, toTime] = cleanTo.split(' ');
  if (fromDate && toDate && fromDate === toDate && toTime) {
    return `${cleanFrom} → ${toTime} UTC`;
  }
  return `${cleanFrom} → ${cleanTo} UTC`;
}

export function formatLocalWindow(fromLocal?: string | null, toLocal?: string | null): string {
  if (!fromLocal) return 'N/A';
  if (!toLocal) return fromLocal;

  const cleanFrom = fromLocal.replace(/^(\d{4}-\d{2}-\d{2})T/, '$1 ').trim();
  const cleanTo = toLocal.replace(/^(\d{4}-\d{2}-\d{2})T/, '$1 ').trim();

  const fromParts = cleanFrom.split(' ');
  const toParts = cleanTo.split(' ');
  if (fromParts.length >= 2 && toParts.length >= 2 && fromParts[0] === toParts[0]) {
    return `${cleanFrom} → ${toParts.slice(1).join(' ')}`;
  }
  return `${cleanFrom} → ${cleanTo}`;
}

export const MeasurementTable: React.FC<MeasurementTableProps> = ({
  measurements,
  parameterDisplayName,
  units,
  stationName,
  locationId,
  sensorId,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(measurements.length / pageSize));

  const startIndex = (currentPage - 1) * pageSize;
  const visibleRows = measurements.slice(startIndex, startIndex + pageSize);

  if (measurements.length === 0) {
    return (
      <div className="table-empty-box">
        <p>No observations available in this measurement window.</p>
      </div>
    );
  }

  return (
    <div className="table-component-wrapper">
      <div className="table-header-meta">
        <h3>
          Observation Records ({measurements.length} total)
          {stationName ? (
            <span style={{ fontWeight: 400, fontSize: '0.9rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
              — {stationName} {locationId ? `(Location ID: ${locationId})` : ''} {sensorId ? `· Sensor #${sensorId}` : ''}
            </span>
          ) : null}
        </h3>
        <span className="table-meta-note">
          Values are raw concentrations as reported by station sensors. Hourly observations represent 60-minute windows (OpenAQ Explorer labels by period end).
        </span>
      </div>

      <div className="table-container">
        <table
          className="styled-table"
          aria-label={`Observation records for ${parameterDisplayName}${stationName ? ` at ${stationName}` : ''}`}
        >
          <thead>
            <tr>
              <th scope="col">Observation Window (UTC)</th>
              <th scope="col">Local Timestamp (Start → End)</th>
              <th scope="col">Parameter</th>
              <th scope="col">Measured Concentration</th>
              <th scope="col">Interval</th>
              <th scope="col">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((m, idx) => (
              <tr key={idx}>
                <td>
                  <span className="font-mono">
                    {formatUtcWindow(m.datetime_from_utc, m.datetime_to_utc)}
                  </span>
                </td>
                <td>
                  <span className="font-mono">
                    {formatLocalWindow(m.datetime_from_local, m.datetime_to_local)}
                  </span>
                </td>
                <td>
                  <span className="pill-tag pill-active">{parameterDisplayName}</span>
                </td>
                <td>
                  <strong>{typeof m.value === 'number' ? m.value.toFixed(2) : m.value}</strong>{' '}
                  <span className="text-muted">{units}</span>
                </td>
                <td>{m.period_label || 'hour'}</td>
                <td>
                  {m.percent_complete !== null && m.percent_complete !== undefined ? (
                    <span className="pill-tag">
                      {m.percent_complete}%
                    </span>
                  ) : (
                    '100%'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="table-pagination">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            aria-label="Previous page of measurements"
          >
            ← Previous
          </button>
          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            aria-label="Next page of measurements"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
