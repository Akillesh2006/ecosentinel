# EcoSentinel — Evidence-Based Environmental Intelligence

> **Milestone 2A: Build the First Functional Air Quality Investigation**  
> A software-only environmental intelligence platform designed to detect unusual air-quality patterns across India using verifiable sensor observations, time-aware comparisons, and explainable statistical methods.

---

## 1. Project Overview

**EcoSentinel** is an independent, software-only environmental intelligence application focused on air quality analysis in India. Rather than presenting arbitrary, unexplained air quality indices or speculative conclusions, EcoSentinel empowers researchers, municipal analysts, and community advocates to conduct transparent investigations based on physical observations from registered monitoring stations:

1. **What changed:** Physical concentrations of criteria pollutants (PM2.5, PM10, NO₂, O₃, CO, SO₂) measured by station sensors.
2. **When it occurred:** Accurate observation time windows, distinguishing UTC and local station timezones (`Asia/Kolkata`).
3. **Data Freshness & Staleness:** Automated 24-hour freshness rules flagging stations that have ceased active transmission.
4. **Supporting evidence:** Observation counts, data completeness calculations, and missing data intervals.
5. **Limitations and caveats:** Honest disclosure of monitoring station spatial limits (a single station does not represent an entire city), zero data fabrication, and distinguishing raw concentrations from calculated AQI.

---

## 2. Milestone 2A: What Now Works

With Milestone 2A complete, EcoSentinel is an application-first, functional air-quality investigation tool:

- **Upstream OpenAQ v3 Integration:** Secure backend client communicating with the documented OpenAQ v3 REST API (`https://api.openaq.org/v3`) with server-side authentication (`X-API-Key`).
- **Indian Station Search & Selection:** Query registered monitoring locations across India (`country=IN`) or filter by major metropolitan hubs (Delhi, Mumbai, Bengaluru, Kolkata, Chennai, Hyderabad).
- **Station Metadata & Sensor Inspection:** Displays station identity, provider name (CPCB, DPCC, MPCB), coordinates, monitor type (Reference Monitor vs Sensor Node), available pollutant sensors, and latest observation timestamps.
- **Observation Retrieval:** Fetches actual hourly observations for any available parameter across bounded time windows (`24h`, `7d`, `30d`).
- **Time-Series Charting:** Accessible, responsive SVG time-series visualization featuring gradient trend lines, observation data points, and interactive hover tooltips. Zero fake data is plotted on errors or empty windows.
- **Accessible Observation Table:** Paginated data table displaying start/end UTC windows, local timestamps, measured concentrations in standard units (`µg/m³`, `ppm`), and interval coverage percentages.
- **Evidence & Data Quality Audit:** Real-time data completeness metrics, missing observation quantification, and 24-hour staleness warnings.
- **Investigation Summary Dossiers:** Client-side descriptive statistical dossier (minimum, maximum, mean, median, observation count, and completeness rate) with clear caveats that automated anomaly scoring is reserved for Milestone 3.
- **Robust Error Handling:** Explicit UI states for loading, no matching stations, empty observation windows, missing API key (with registration steps), rate limits (HTTP 429), and upstream outages.

---

## 3. Data Provider & Access Requirements

### OpenAQ API v3
- **Base URL:** `https://api.openaq.org/v3`
- **Documentation:** [https://docs.openaq.org/](https://docs.openaq.org/)
- **Authentication:** OpenAQ v3 mandates an API key passed via the `X-API-Key` HTTP header. Unauthenticated requests receive HTTP 401 Unauthorized.
- **Rate Limits:** Free developer tier allows 60 requests/minute and 2,000 requests/hour.
- **How to Obtain a Key:**
  1. Visit [https://explore.openaq.org/register](https://explore.openaq.org/register).
  2. Create a free developer account.
  3. Generate an API key from your OpenAQ dashboard.

### Operational Gracefulness (No Hard Key Dependency)
- The backend starts and operates cleanly **without** an API key. Unrelated functionality (such as `GET /api/health` and provider reachability checks) remains fully functional.
- When an air quality query is executed without an API key, the backend returns a structured `503 Service Unavailable` response with `error_code: "MISSING_API_KEY"` and setup instructions.
- The frontend renders an informative registration card with setup steps and a retry button rather than crashing or substituting fake data.

---

## 4. Environment Configuration

Copy the template to create your `.env` configuration in the workspace root:

```bash
cp .env.example .env
```

Configuration variables:

```ini
# Environment
ENVIRONMENT=development
LOG_LEVEL=INFO

# OpenAQ API v3 Configuration
# Register for a free API key at: https://explore.openaq.org/register
OPENAQ_API_KEY=""
OPENAQ_BASE_URL="https://api.openaq.org/v3"
OPENAQ_TIMEOUT_SECONDS=10.0

# Air Quality Analysis Thresholds
STALE_DATA_THRESHOLD_HOURS=24
```

> **Security Note:** Never commit `.env` or expose `OPENAQ_API_KEY` to the frontend. All upstream requests are proxied and validated securely through the FastAPI backend.

---

## 5. Backend Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health, version (`0.2.0`), uptime, and environment |
| `GET` | `/api/air-quality/provider-status` | Operational status of the OpenAQ provider (configured, reachable) |
| `GET` | `/api/air-quality/locations?country=IN&search=...` | List matching Indian monitoring stations from OpenAQ v3 |
| `GET` | `/api/air-quality/locations/{location_id}` | Detailed station metadata, coordinates, provider, and sensor list |
| `GET` | `/api/air-quality/locations/{location_id}/measurements` | Bounded time-series observations for a location, parameter, and date range |

Interactive OpenAPI documentation is available at `http://127.0.0.1:8000/api/docs`.

---

## 6. Installation & Execution

### Backend Setup

```powershell
# Windows (PowerShell)
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend Setup

```bash
# In frontend/ directory
npm install
npm run dev
```

The frontend investigation workspace will launch at `http://localhost:5173`.

---

## 7. Automated Testing Results

Both the backend and frontend include automated test suites using mocked HTTP fixtures that run without requiring a real API key or live network connection.

### Backend Tests (Pytest)
Command:
```powershell
.\.venv\Scripts\pytest.exe -v
```
Output:
```
============================= test session starts =============================
platform win32 -- Python 3.14.8, pytest-9.1.1
collected 19 items

tests/test_air_quality.py::test_provider_status_endpoint PASSED          [  5%]
tests/test_air_quality.py::test_locations_missing_api_key PASSED         [ 10%]
tests/test_air_quality.py::test_locations_success_with_mock PASSED      [ 15%]
tests/test_air_quality.py::test_locations_search_filter PASSED           [ 21%]
tests/test_air_quality.py::test_location_detail_success PASSED           [ 26%]
tests/test_air_quality.py::test_location_detail_not_found PASSED         [ 31%]
tests/test_air_quality.py::test_measurements_success PASSED              [ 36%]
tests/test_air_quality.py::test_measurements_empty_period PASSED         [ 42%]
tests/test_air_quality.py::test_measurements_invalid_date_range PASSED   [ 47%]
tests/test_air_quality.py::test_measurements_excessive_date_range PASSED [ 52%]
tests/test_air_quality.py::test_measurements_unsupported_pollutant PASSED [ 57%]
tests/test_air_quality.py::test_upstream_auth_failure PASSED             [ 63%]
tests/test_air_quality.py::test_upstream_rate_limiting PASSED            [ 68%]
tests/test_air_quality.py::test_upstream_server_error PASSED             [ 73%]
tests/test_air_quality.py::test_upstream_timeout PASSED                  [ 78%]
tests/test_health.py::test_health_check_returns_200_ok PASSED            [ 84%]
tests/test_health.py::test_root_discovery_endpoint PASSED                [ 89%]
tests/test_health.py::test_not_found_returns_404 PASSED                  [ 94%]
tests/test_health.py::test_cors_headers_allowed_origin PASSED            [100%]

======================== 19 passed, 1 warning in 0.54s ========================
```

### Frontend Tests (Vitest)
Command:
```bash
npm test -- --run
```
Output:
```
 ✓ src/App.test.tsx (12 tests) 482ms

 Test Files  1 passed (1)
      Tests  12 passed (12)
   Duration  1.17s
```

### Production Build Validation
Command:
```bash
npm run build
```
Output:
```
vite v8.3.5 building client environment for production...
✓ 26 modules transformed.
dist/index.html                   1.06 kB │ gzip:  0.55 kB
dist/assets/index-D0GgYzlC.css   19.63 kB │ gzip:  3.90 kB
dist/assets/index-d8QXH_Wr.js   265.04 kB │ gzip: 79.77 kB
✓ built in 313ms
```

---

## 8. Environmental Data Integrity Principles

EcoSentinel adheres strictly to scientific data integrity:
1. **Zero Data Fabrication:** No placeholder or synthetic numbers are substituted when an API query fails or when a station has no observations.
2. **Raw Concentration vs. AQI:** Observations are explicitly labeled with their physical measurement units (e.g., `µg/m³` for PM2.5/PM10, `ppm` for CO). Concentrations are never falsely presented as official Air Quality Index (AQI) values.
3. **No Speculative Causality:** Elevated pollutant concentrations reflect physical observations at a sensor. EcoSentinel never claims measurements prove the cause of pollution or establish regulatory violations.
4. **Spatial Non-Generalizability:** Monitoring stations are localized; readings from a single station (e.g. Anand Vihar, Delhi) do not represent the entire National Capital Region or metropolitan area.
5. **Observation Freshness:** A 24-hour threshold marks stations with inactive reporting so historical readings are never mistaken for real-time measurements.

---

## 9. Known Limitations & Intentionally Deferred Features

### Known Limitations
- **OpenAQ v3 Key Requirement:** Queries to live upstream Indian stations require an OpenAQ API key due to OpenAQ v3 access policies.
- **Data Completeness & Latency:** Some Indian monitoring stations report intermittently or experience multi-day transmission pauses. Missing observation hours are reported transparently.
- **Indian National AQI Dashboard Scraping Prohibited:** CPCB's web portal (`app.cpcbccr.com/AQIIndia`) lacks a public documented REST API without web scraping; OpenAQ v3 is therefore utilized as the candidate programmatic source.

### Features Intentionally Deferred
- **Statistical Anomaly Detection Engine (Milestone 3):** Robust rolling baselines, diurnal profiling, and anomaly scoring algorithms.
- **Persistent Database Storage (Milestone 4):** PostgreSQL storage and Alembic schema migrations.
- **Dossier & PDF Export (Milestone 4):** Automated dossier generation and export.
- **Multi-Station Spatial Correlation Maps (Milestone 5):** Geospatial map layers and regional clustering.

---

## 10. License

EcoSentinel is an open-source environmental intelligence project created for scientific transparency and public benefit.
