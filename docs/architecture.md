# EcoSentinel System Architecture

## 1. System Overview

EcoSentinel is an environmental intelligence application focused on detecting unusual air-quality patterns using time-aware baseline comparisons and explainable statistical analysis.

The architecture emphasizes:
- **Modularity**: Separation between presentation (React/TS), API service (FastAPI), analysis pipeline (NumPy/Pandas in future milestones), and data persistence (PostgreSQL).
- **Explainability**: Every calculation and anomaly alert can be traced back to underlying observations and baseline distributions.
- **Portability**: Operable in standard development environments without heavy container or cloud infrastructure dependencies for core milestones.

---

## 2. High-Level Architecture Diagram

```
+------------------------------------------------------------------------+
|                          Frontend Layer (Vite + React + TS)            |
|                                                                        |
|   +-------------------+  +-------------------+  +------------------+   |
|   |  Overview Section |  | Air Quality Panel |  | Evidence & Data  |   |
|   +-------------------+  +-------------------+  +------------------+   |
|                                                                        |
|                   +-------------------------------+                    |
|                   | Investigation Reports Section |                    |
|                   +-------------------------------+                    |
|                                   |                                    |
|                       REST API Client (Fetch/Axios)                    |
+-----------------------------------|------------------------------------+
                                    |  JSON over HTTP (CORS filtered)
                                    v
+------------------------------------------------------------------------+
|                          Backend Service Layer (FastAPI)               |
|                                                                        |
|   +----------------------------------------------------------------+   |
|   |                         FastAPI Router                         |   |
|   |   - /api/health (Service status & metadata)                    |   |
|   |   - /api/observations (Planned M2)                             |   |
|   |   - /api/anomalies (Planned M3)                                |   |
|   |   - /api/reports (Planned M4)                                  |   |
|   +----------------------------------------------------------------+   |
|                                   |                                    |
|       +---------------------------+----------------------------+       |
|       |                                                        |       |
|       v                                                        v       |
| +-----------------------------+              +-----------------------+ |
| | Statistical Analysis Engine |              | Persistence Layer     | |
| | (Planned M3: NumPy/Pandas)  |              | (Planned M2: SQLA/PG) | |
| +-----------------------------+              +-----------------------+ |
+------------------------------------------------------------------------+
```

---

## 3. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | React 19 + TypeScript | Component-based, type-safe user interface |
| **Frontend Tooling** | Vite | Fast HMR dev server and optimized production bundling |
| **Frontend Styling** | Vanilla CSS with Design Tokens | High-performance, accessible, custom environmental theme |
| **Backend Framework** | FastAPI (Python 3.10+) | High-performance asynchronous REST API |
| **Data Validation** | Pydantic v2 & Pydantic-Settings | Request/response schemas and environment configuration |
| **Testing** | Pytest + HTTPX (Backend), Vitest (Frontend) | Unit and integration testing |
| **Data Analysis (Planned)** | NumPy, Pandas, SciPy | Time-aware baseline modeling and statistical deviation detection |
| **Database (Planned)** | PostgreSQL + SQLAlchemy 2.0 + Psycopg 3 | Reliable, ACID-compliant time-series and metadata storage |

---

## 4. Milestone Roadmap

- **Milestone 1 (Current)**: Project foundation. FastAPI service structure, health check endpoint, test suite, React + TypeScript + Vite frontend dashboard skeleton with structured empty states, responsive accessible UI, documentation, and integrity principles.
- **Milestone 2 (Planned)**: Data ingestion layer. Support for open environmental standards (EPA / OpenAQ format), schema models, and baseline data ingestion.
- **Milestone 3 (Planned)**: Statistical anomaly detection engine. Diurnal/seasonal baselines, quantile thresholds, confidence scoring, and missing data quantification.
- **Milestone 4 (Planned)**: Evidence and investigation reporting. Structured reports detailing what changed, when, evidence quality, and limitations.
- **Milestone 5 (Planned)**: Interactive visualization, exportable summary dossiers, and multi-station comparative analysis.
