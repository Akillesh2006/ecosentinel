# EcoSentinel Sample Data Directory

This directory is designated for sample environmental datasets, benchmarking schemas, and demonstration data intended for subsequent milestones.

## Environmental Data Policy

1. **Explicit Data Origin**:
   - Every dataset placed in this repository must clearly state its origin: whether it is **real-world observational data** (with source attribution, licensing, and station metadata) or **synthetic demonstration data** generated for statistical model testing.
   - Synthetic or simulated data must **never** be presented as real-world environmental observations.

2. **Standard Target Pollutants & Measurements**:
   Future milestones will consume time-series observations covering key criteria air pollutants:
   - **PM2.5**: Fine particulate matter ($\mu\text{g}/\text{m}^3$)
   - **PM10**: Coarse particulate matter ($\mu\text{g}/\text{m}^3$)
   - **NO2**: Nitrogen dioxide ($\text{ppb}$ or $\mu\text{g}/\text{m}^3$)
   - **O3**: Ground-level ozone ($\text{ppb}$ or $\mu\text{g}/\text{m}^3$)
   - **SO2**: Sulfur dioxide ($\text{ppb}$ or $\mu\text{g}/\text{m}^3$)
   - **CO**: Carbon monoxide ($\text{ppm}$ or $\text{mg}/\text{m}^3$)

3. **Time-Aware Schema Guidelines**:
   All observational data will record:
   - `timestamp_utc`: ISO 8601 UTC timestamp.
   - `station_id`: Unique identifier of the monitoring sensor/station.
   - `parameter`: Pollutant code or meteorological parameter.
   - `value`: Numerical measurement.
   - `unit`: Standard physical measurement unit.
   - `data_quality_flag`: Quality assurance code (e.g., valid, suspicious, calibration, missing).

4. **Milestone 1 Status**:
   In accordance with Milestone 1 rules, live data ingestion and analytical pipelines are not active in this release. This directory contains placeholder documentation and schema definitions only.
