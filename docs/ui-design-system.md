# EcoSentinel UI Design System

This guide documents the redesigned frontend architecture for **EcoSentinel**, built to make verified Indian ambient air-quality telemetry legible within five seconds for facility managers, EHS officers, municipal coordinators, and researchers.

---

## 1. Visual Foundations & Tokens

Defined in [tokens.css](file:///e:/projects/ecosentinel/frontend/src/styles/tokens.css) and loaded globally in [global.css](file:///e:/projects/ecosentinel/frontend/src/styles/global.css).

### Typography
- **Display headings (`h1`–`h3`, `.eco-display`):** `Space Grotesk`, tracking `-0.02em`
- **Body & UI copy:** `Inter`, sans-serif (`16px` root, `1.6` line height)
- **Telemetry numbers & timestamps (`.eco-mono`):** `IBM Plex Mono` with `font-variant-numeric: tabular-nums`

### 4 / 8 px Spacing Rhythm
`--eco-space-1` (`4px`), `--eco-space-2` (`8px`), `--eco-space-3` (`12px`), `--eco-space-4` (`16px`), `--eco-space-5` (`20px`), `--eco-space-6` (`24px`), `--eco-space-8` (`32px`), `--eco-space-10` (`40px`), `--eco-space-12` (`48px`), `--eco-space-16` (`64px`).

### Dual Theme System (`Obsidian Dark` & `Daylight Light`)
- Controlled via `ThemeProvider` ([ThemeContext.tsx](file:///e:/projects/ecosentinel/frontend/src/context/ThemeContext.tsx)), persisting to `localStorage['ecosentinel-theme']` with OS `prefers-color-scheme` fallback.
- A pre-hydration inline script in `frontend/index.html` sets `data-theme` and `colorScheme` on `<html>` before first paint to prevent theme flashing.
- **Dark tokens:** Obsidian canvas `#0A0E17`, cards `#131C2E`, elevated `#172236`, teal `#06B6D4` (`#22D3EE` accessible text), lime `#A3E635`.
- **Light tokens (`[data-theme="light"]`):** Daylight canvas `#F8FAFC`, cards `#FFFFFF`, slate borders `#E2E8F0`/`#CBD5E1`, accessible accents `#0891B2`/`#0E7490` and `#65A30D`/`#3F6212`, WCAG AA text (`#0F172A`, `#334155`, `#475569`).

---

## 2. Routing & Persistent Station Context

Configured in [navigation.ts](file:///e:/projects/ecosentinel/frontend/src/config/navigation.ts) and [App.tsx](file:///e:/projects/ecosentinel/frontend/src/App.tsx):

| Workspace | Route | Purpose |
| :--- | :--- | :--- |
| **Home** | `/` | Searchable station finder, India monitoring hub map, active station snapshot, gap-aware chart preview |
| **Stations** | `/stations` | City-grouped `StationCombobox`, plain-language verdict, pollutant switcher, CPCB/WHO benchmarks, UTC/IST log |
| **Anomalies** | `/anomalies` | Leave-one-out Jackknife MAD screening, spike/drop legend, and statistical safeguards disclosure |
| **Compare Nearby** | `/compare` | Haversine neighbor map (`1 + up to 4`), multi-station overlay chart, `[C]/[L]/[N]/[B]/[—]` timeline |
| **Data Quality** | `/quality` | Radial 75% completeness gate gauge (`18/24h` or `6/8h`), sensor recency, quarantined artifacts, CSV/JSON exports |
| **Action Plan** | `/action-plan` | Separated Measured Evidence vs. Modelled Engineering Scenarios, 5-part dossier, anti-idling & AP-42 worksheets |

- Legacy paths (`/overview`, `/investigate`, `/spatial`, `/evidence`, `/reports`) redirect cleanly.
- `StationProvider` ([StationContext.tsx](file:///e:/projects/ecosentinel/frontend/src/context/StationContext.tsx)) keeps selected station, parameter, time window, and cached telemetry synced across routes and URL query parameters (`?station=...&param=...&window=...`).
- Global command palette (`Ctrl+K` / `Cmd+K`, [CommandPalette.tsx](file:///e:/projects/ecosentinel/frontend/src/components/ui/CommandPalette.tsx)) supports keyboard jumping between workspaces, stations, and Dark/Light themes.

---

## 3. Core UI & Chart Primitives

- **Surface & Actions (`src/components/ui/`):** `Button`, `Card`, `Badge`, `SegmentedTabs`, `Skeleton` (`SkeletonKpiRow`, `SkeletonChart`), `EmptyState`.
- **Plain-Language Comprehension Layer:**
  - `VerdictBanner` ([VerdictBanner.tsx](file:///e:/projects/ecosentinel/frontend/src/components/ui/VerdictBanner.tsx)) paired with `deriveAssessmentVerdict`, `deriveAnomalyVerdict`, and `deriveSpatialVerdict` ([verdict.ts](file:///e:/projects/ecosentinel/frontend/src/utils/verdict.ts)).
  - `Disclosure` ([Disclosure.tsx](file:///e:/projects/ecosentinel/frontend/src/components/ui/Disclosure.tsx)) for `"Show the math"` progressive statistical disclosures.
  - `GlossaryTerm` ([Tooltip.tsx](file:///e:/projects/ecosentinel/frontend/src/components/ui/Tooltip.tsx) & [glossary.ts](file:///e:/projects/ecosentinel/frontend/src/utils/glossary.ts)) defining MAD, NMAD, Modified Z, Jackknife LOO, IQR, Haversine, Completeness Gate, CPCB NAAQS, WHO AQG, and Freshness.
- **Shared SVG Chart Primitives (`src/components/charts/`):** `ChartContainer`, `ChartAxes`, `ThresholdLines`, `ChartTooltip`, `ChartLegend`, and `segmentChronologicalSeries` ([chartUtils.ts](file:///e:/projects/ecosentinel/frontend/src/components/charts/chartUtils.ts)), sorting readings chronologically and breaking polylines cleanly at gaps exceeding 90 minutes.

---

## 4. Non-Negotiable Scientific & Accessibility Contracts

1. **Zero Fabrication or Imputation:** Missing intervals render as visual breaks and `'—'` / `'Unavailable'` states — never zero-filled or interpolated.
2. **75% Completeness Gate:** Rolling evaluations are withheld below `18/24h` (or `6/8h` for CO / O₃).
3. **Unit & Standard Integrity:** CO is displayed in OpenAQ physical `ppm` with WHO guidance omitted when unmapped (`Standard unavailable`).
4. **Cold-Start Resilience:** `StatusBanner` surfaces `"Waking up the server…"` with automatic retry backoff against hosted cold boots.
5. **Reduced Motion & Keyboard Focus:** `@media (prefers-reduced-motion: reduce)` disables draw-in and pulse animations globally; `:focus-visible` outlines (`2px solid var(--eco-border-focus)`) remain active across controls, charts, and SVG map markers.

