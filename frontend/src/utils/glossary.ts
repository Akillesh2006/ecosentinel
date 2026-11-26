export interface GlossaryEntry {
  label: string;
  plainExplanation: string;
}

export const GLOSSARY = {
  mad: {
    label: 'MAD (Median Absolute Deviation)',
    plainExplanation:
      'A robust measure of how spread out recent hourly readings are around the middle value. Unlike standard deviation, one giant pollution spike will not distort it.',
  },
  nmad: {
    label: 'Normalized MAD (NMAD)',
    plainExplanation:
      'MAD scaled by 1.4826 so the dispersion units match standard normal intervals while keeping outlier resistance.',
  },
  modifiedZ: {
    label: 'Modified Z-score (M ≥ 3.5)',
    plainExplanation:
      'Measures how many typical spreads away an hourly reading sits from the station baseline. Values reaching +3.5 or higher (or −3.5 or lower) flag unusually sharp departures.',
  },
  jackknifeLoo: {
    label: 'Jackknife Leave-One-Out Baseline',
    plainExplanation:
      'Calculates the baseline median and spread after temporarily removing the hour being checked, preventing a spike from inflating its own benchmark.',
  },
  iqr: {
    label: 'IQR (Interquartile Range)',
    plainExplanation:
      'The spread between the middle 50% of nearby stations at that hour (75th percentile minus 25th percentile). Narrow IQR means nearby monitors agree closely.',
  },
  completenessGate: {
    label: '75% Completeness Gate',
    plainExplanation:
      'Requires at least 3 out of 4 expected hours (18 of 24 h for most pollutants, or 6 of 8 h for ozone and CO) before computing an official rolling average or triggering alerts.',
  },
  cpcbNaaqs: {
    label: 'CPCB NAAQS (2009)',
    plainExplanation:
      'India’s statutory National Ambient Air Quality Standards published by the Central Pollution Control Board for short-term 24-hour or 8-hour residential/industrial exposure.',
  },
  whoAqg: {
    label: 'WHO AQG (2021)',
    plainExplanation:
      'Health-based Global Air Quality Guidelines from the World Health Organization — typically stricter than national legal thresholds.',
  },
  haversine: {
    label: 'Haversine Radius',
    plainExplanation:
      'Straight-line great-circle distance on Earth’s surface from the selected station to neighboring monitors, used to group nearby stations.',
  },
  freshness: {
    label: 'Sensor Freshness',
    plainExplanation:
      'Whether the pollutant sensor reported within the past 24 hours. Readings older than 24 h are labeled Stale and >30 days are labeled Historical so old episodes are never mistaken for live air quality.',
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;

