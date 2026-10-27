import React from 'react';

export const AirQualitySection: React.FC = () => {
  return (
    <article id="panel-air-quality" role="tabpanel" aria-labelledby="tab-air-quality">
      <header className="section-header">
        <h2>Air Quality Observations & Patterns</h2>
        <p className="section-subtitle">
          Time-aware observation capture and historical baseline comparison for criteria air pollutants.
        </p>
      </header>

      {/* Helpful, informative empty state */}
      <div className="empty-state-box">
        <div className="empty-state-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
            <path d="M12 12v9" />
            <path d="m8 17 4 4 4-4" />
          </svg>
        </div>
        <h3 className="empty-state-title">Environmental Data Integration Pending</h3>
        <p className="empty-state-desc">
          Live environmental data feeds and observational storage are not yet active in Milestone 1.
          In accordance with our data integrity principles, no placeholder or simulated pollution readings
          are displayed as real data. Ingestion pipelines for standard observation formats (EPA / OpenAQ)
          will be introduced in Milestone 2.
        </p>
        <div className="empty-state-meta-box">
          <div className="meta-item">
            <span className="meta-label">Current Phase</span>
            <span className="meta-val">Milestone 1 — Foundation</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Next Target</span>
            <span className="meta-val">Milestone 2 — Data Ingestion</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Active Sensors</span>
            <span className="meta-val">0 (Awaiting connection)</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">
          <span className="card-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
          </span>
          Planned Measurement Coverage & Baseline Architecture
        </h3>
        <p>
          When data ingestion is activated, observations will be organized by physical station and
          evaluated using rolling temporal baseline distributions (e.g., diurnal cycle, weekday vs.
          weekend profiles).
        </p>

        <div className="table-container">
          <table className="styled-table" aria-label="Planned air quality parameters">
            <thead>
              <tr>
                <th scope="col">Parameter</th>
                <th scope="col">Description</th>
                <th scope="col">Standard Units</th>
                <th scope="col">Planned Baseline Method</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>PM2.5</strong></td>
                <td>Fine particulate matter (&le; 2.5 &micro;m)</td>
                <td>&micro;g/m&sup3;</td>
                <td>24-hr rolling quantile &amp; diurnal profile</td>
                <td><span className="pill-tag pill-pending">Pending M2</span></td>
              </tr>
              <tr>
                <td><strong>PM10</strong></td>
                <td>Coarse particulate matter (&le; 10 &micro;m)</td>
                <td>&micro;g/m&sup3;</td>
                <td>Rolling seasonal median &amp; IQR</td>
                <td><span className="pill-tag pill-pending">Pending M2</span></td>
              </tr>
              <tr>
                <td><strong>NO2</strong></td>
                <td>Nitrogen dioxide (combustion tracer)</td>
                <td>ppb or &micro;g/m&sup3;</td>
                <td>Hour-of-day rush-hour baseline</td>
                <td><span className="pill-tag pill-pending">Pending M2</span></td>
              </tr>
              <tr>
                <td><strong>O3</strong></td>
                <td>Ground-level ozone (photochemical)</td>
                <td>ppb or &micro;g/m&sup3;</td>
                <td>Solar peak &amp; temperature-indexed window</td>
                <td><span className="pill-tag pill-pending">Pending M2</span></td>
              </tr>
              <tr>
                <td><strong>SO2</strong></td>
                <td>Sulfur dioxide (industrial indicator)</td>
                <td>ppb or &micro;g/m&sup3;</td>
                <td>Background threshold &amp; peak duration</td>
                <td><span className="pill-tag pill-pending">Pending M2</span></td>
              </tr>
              <tr>
                <td><strong>CO</strong></td>
                <td>Carbon monoxide</td>
                <td>ppm or mg/m&sup3;</td>
                <td>8-hour rolling baseline</td>
                <td><span className="pill-tag pill-pending">Pending M2</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
};
