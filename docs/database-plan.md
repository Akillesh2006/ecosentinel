# EcoSentinel Database Integration Plan

## 1. Overview and Rationale

EcoSentinel is designed as a software-only environmental intelligence platform. In Milestone 1 (Project Foundation), the application operates without requiring a running database service. For subsequent milestones requiring persistence, **PostgreSQL** is the designated relational database system, accessed through **SQLAlchemy 2.0+ (async)** and the **Psycopg 3 (`psycopg[binary]`)** driver.

PostgreSQL was selected because:
- **Time-Series Capabilities**: Native timestamp handling, partitioning support (pg_partman or native declarative range partitioning by timestamp), and compatibility with TimescaleDB if advanced hypertable compression is needed.
- **Relational Integrity**: Strong relational guarantees between monitoring stations, physical sensor locations, baselines, and investigation reports.
- **Explainability Auditing**: Ability to store structured audit trails showing the exact baseline parameters, statistical bounds, and evidence records used to flag an anomaly.

---

## 2. Planned Architecture

```
+-----------------------------------------------------------+
|                      EcoSentinel Backend                  |
|                                                           |
|   +-------------------+          +--------------------+   |
|   |  FastAPI Routers  | <----->  |  Service / Domain  |   |
|   +-------------------+          +--------------------+   |
|                                            |              |
|                                            v              |
|                                  +--------------------+   |
|                                  |  SQLAlchemy 2.0    |   |
|                                  |  Async Engine &    |   |
|                                  |  Session Factory   |   |
|                                  +--------------------+   |
+--------------------------------------------|--------------+
                                             |  Async connection pool
                                             |  (Psycopg 3)
                                             v
                             +-------------------------------+
                             |      PostgreSQL Database      |
                             |   - stations                  |
                             |   - observations (partitioned)|
                             |   - baselines                 |
                             |   - anomaly_findings          |
                             |   - investigation_reports     |
                             +-------------------------------+
```

---

## 3. Planned Entity Schemas

When persistence is introduced in future milestones, the following relational entities are planned:

### 3.1 `monitoring_stations`
Tracks physical and synthetic monitoring nodes.
- `id` (UUID / Integer, Primary Key)
- `station_code` (VARCHAR(64), Unique, Indexed)
- `name` (VARCHAR(255))
- `latitude` (DOUBLE PRECISION)
- `longitude` (DOUBLE PRECISION)
- `elevation_meters` (FLOAT, Nullable)
- `station_type` (VARCHAR(32)) — e.g., `urban_background`, `roadside`, `industrial`, `synthetic_benchmark`
- `is_active` (BOOLEAN, default True)
- `created_at` (TIMESTAMPTZ)

### 3.2 `air_quality_observations`
Time-series environmental measurements (partitioned monthly or weekly by `observed_at`).
- `id` (BIGINT, Primary Key)
- `station_id` (ForeignKey `monitoring_stations.id`, Indexed)
- `parameter` (VARCHAR(16), Indexed) — e.g., `PM25`, `PM10`, `NO2`, `O3`, `SO2`, `CO`
- `value` (DOUBLE PRECISION, NOT NULL)
- `unit` (VARCHAR(16)) — e.g., `ug/m3`, `ppb`, `ppm`
- `observed_at` (TIMESTAMPTZ, NOT NULL, Indexed)
- `quality_code` (VARCHAR(16)) — e.g., `valid`, `suspect`, `calibration_failure`, `sensor_drift`
- `is_synthetic` (BOOLEAN, default False) — Critical for data integrity

### 3.3 `baseline_models`
Historical baseline metrics against which current observations are evaluated.
- `id` (UUID, Primary Key)
- `station_id` (ForeignKey `monitoring_stations.id`)
- `parameter` (VARCHAR(16))
- `baseline_type` (VARCHAR(32)) — e.g., `diurnal_seasonal_rolling`, `historical_quantile`
- `window_start` (TIMESTAMPTZ)
- `window_end` (TIMESTAMPTZ)
- `sample_count` (INTEGER)
- `mean_value` (DOUBLE PRECISION)
- `std_deviation` (DOUBLE PRECISION)
- `median_value` (DOUBLE PRECISION)
- `p25` (DOUBLE PRECISION), `p75` (DOUBLE PRECISION), `p95` (DOUBLE PRECISION)
- `missing_data_fraction` (FLOAT)
- `computed_at` (TIMESTAMPTZ)

### 3.4 `anomaly_findings`
Statistical deviations detected by time-aware comparison routines.
- `id` (UUID, Primary Key)
- `station_id` (ForeignKey `monitoring_stations.id`)
- `parameter` (VARCHAR(16))
- `detected_at` (TIMESTAMPTZ)
- `observation_value` (DOUBLE PRECISION)
- `baseline_reference_id` (ForeignKey `baseline_models.id`)
- `expected_range_lower` (DOUBLE PRECISION)
- `expected_range_upper` (DOUBLE PRECISION)
- `deviation_sigma` (FLOAT)
- `confidence_score` (FLOAT)
- `status` (VARCHAR(32)) — e.g., `unreviewed`, `investigating`, `dismissed_sensor_fault`, `verified_pattern`

### 3.5 `investigation_reports`
User-facing or automated findings reports.
- `id` (UUID, Primary Key)
- `finding_id` (ForeignKey `anomaly_findings.id`, Nullable)
- `title` (VARCHAR(255))
- `summary` (TEXT)
- `supporting_evidence` (JSONB) — Raw observations, timestamps, baseline comparisons
- `limitations_and_caveats` (TEXT) — Explicit notes on missing data, weather confounding factors, or sensor calibration status
- `created_at` (TIMESTAMPTZ)

---

## 4. Migration and Implementation Strategy

1. **Alembic Migrations**:
   - Schema versioning will be managed exclusively using Alembic (`alembic/` directory).
   - All migrations will be deterministic, forward, and backward reversible.
2. **Environment Isolation**:
   - Test runs will utilize SQLite in-memory or a dedicated test PostgreSQL container, avoiding interference with development data.
3. **No Breaking Changes for Milestone 1**:
   - Milestone 1 services remain completely operational without requiring a database daemon to be active or installed.
