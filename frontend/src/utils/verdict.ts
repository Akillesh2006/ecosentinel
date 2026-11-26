import type {
  AirQualityAnomalyResponse,
  RiskAssessmentResponse,
  SpatialComparisonResponse,
} from '../types';

export type VerdictTone = 'normal' | 'elevated' | 'anomaly' | 'historical' | 'muted';

export interface PlainVerdict {
  tone: VerdictTone;
  chipLabel: string;
  headline: string;
  subline?: string;
}

function formatRatio(ratio?: number | null): string | null {
  if (ratio === null || ratio === undefined || !isFinite(ratio)) return null;
  return `${ratio.toFixed(ratio >= 2 ? 1 : 2)}×`;
}

/**
 * Derives a plain-English verdict directly from a RiskAssessmentResponse.
 * Preserves completeness gate, CO standard unavailability, and non-fabrication rules.
 */
export function deriveAssessmentVerdict(
  assessment: RiskAssessmentResponse | null | undefined
): PlainVerdict | null {
  if (!assessment) return null;

  const param = assessment.parameter_display_name || assessment.parameter.toUpperCase();
  const pct = Math.round(assessment.completeness_percentage);
  const ratioStr = formatRatio(assessment.ratio_to_standard);
  const hasAverage =
    assessment.calculated_average !== null && assessment.calculated_average !== undefined;
  const whoThreshold = assessment.secondary_benchmark_threshold;
  const hasWho = whoThreshold !== null && whoThreshold !== undefined && hasAverage;

  switch (assessment.status) {
    case 'historical_data': {
      const lastDate = assessment.sensor_datetime_last_utc
        ? assessment.sensor_datetime_last_utc.split('T')[0]
        : 'over 30 days ago';
      return {
        tone: 'historical',
        chipLabel: 'Historical Archive',
        headline: `${param} sensor stopped reporting (${lastDate})`,
        subline:
          'This station reports archival records (>30 days old). Live air quality judgment and action planning are paused.',
      };
    }

    case 'stale_data':
      return {
        tone: 'muted',
        chipLabel: 'Outdated Readings (>24h)',
        headline: `${param} readings are more than 24 hours old`,
        subline:
          assessment.freshness_message ||
          'Live operational alerts are suppressed until the station reports current hours.',
      };

    case 'insufficient_data':
      return {
        tone: 'elevated',
        chipLabel: 'Not Enough Data',
        headline: `Not enough data to judge (${pct}% of hours reported; 75% needed)`,
        subline: `Received ${assessment.valid_observations} of ${assessment.expected_observations} expected hourly readings (${assessment.averaging_period_label} window). Missing hours are never guessed.`,
      };

    case 'unsupported_parameter':
    case 'unavailable':
      return {
        tone: 'muted',
        chipLabel: 'Standard Unavailable',
        headline: `${param} is reported in ${assessment.units}; cannot compare directly to the Indian limit`,
        subline:
          assessment.screening_limitations ||
          'Direct unit conversion is omitted because local temperature and pressure are not measured here.',
      };

    case 'above_reference': {
      const ratioClause = ratioStr ? `${ratioStr} the Indian limit` : 'above the Indian limit';
      const whoClause =
        hasWho && assessment.calculated_average! > whoThreshold!
          ? ' and above WHO guidance'
          : '';
      return {
        tone: 'anomaly',
        chipLabel: 'Above Indian Limit',
        headline: `${param} is ${ratioClause}${whoClause}`,
        subline: `${assessment.averaging_period_label} average is ${assessment.calculated_average?.toFixed(1)} ${assessment.units} vs. Indian CPCB limit of ${assessment.standard_threshold} ${assessment.standard_unit || assessment.units}. Operational screening only.`,
      };
    }

    case 'below_reference': {
      const withinClause = ratioStr
        ? `within the Indian limit (${ratioStr})`
        : 'within the Indian limit';
      let headline = `${param} is ${withinClause}`;
      if (hasWho && assessment.calculated_average! > whoThreshold!) {
        headline = `${param} is ${withinClause}, though above stricter WHO guidance (${whoThreshold} ${assessment.secondary_benchmark_unit || assessment.units})`;
      } else if (hasWho) {
        headline = `${param} is within both the Indian limit and WHO guidance`;
      }
      return {
        tone: 'normal',
        chipLabel: 'Within Indian Limit',
        headline,
        subline: `${assessment.averaging_period_label} average is ${assessment.calculated_average?.toFixed(1)} ${assessment.units} vs. Indian CPCB limit of ${assessment.standard_threshold} ${assessment.standard_unit || assessment.units}.`,
      };
    }

    default:
      return {
        tone: 'muted',
        chipLabel: assessment.status_label || 'Pending',
        headline: `${param}: ${assessment.status_label}`,
        subline: assessment.freshness_message,
      };
  }
}

/**
 * Derives a plain-English summary for anomaly detection responses without altering scientific rules.
 */
export function deriveAnomalyVerdict(
  data: AirQualityAnomalyResponse | null | undefined
): PlainVerdict | null {
  if (!data) return null;

  const pct = Math.round(data.completeness_percentage);
  if (!data.is_coverage_satisfied || data.coverage_state === 'INSUFFICIENT_COVERAGE') {
    return {
      tone: 'elevated',
      chipLabel: 'Not Enough Data',
      headline: `Not enough data to check for spikes (${pct}% reported; 75% needed)`,
      subline: `Need at least ${data.expected_observations === 24 ? 18 : 126} valid hours in the ${data.window_preset} window to build a reliable baseline.`,
    };
  }

  if (data.summary.scale_indeterminate || data.baseline_metrics?.scale_state === 'INDETERMINATE_ZERO_MAD') {
    return {
      tone: 'elevated',
      chipLabel: 'Flat / Constant Readings',
      headline: 'Readings stayed unchanged across half or more of the window',
      subline:
        'Statistical spike scoring is paused because zero baseline variation creates false divide-by-zero alerts.',
    };
  }

  const totalAnomalies = data.summary.total_anomalies_detected;
  const spikes = data.summary.total_spikes;
  const drops = Math.max(0, totalAnomalies - spikes);

  if (totalAnomalies > 0) {
    const parts: string[] = [];
    if (spikes > 0) parts.push(`${spikes} sharp spike${spikes === 1 ? '' : 's'}`);
    if (drops > 0) parts.push(`${drops} sudden drop${drops === 1 ? '' : 's'}`);
    return {
      tone: 'anomaly',
      chipLabel: `${totalAnomalies} Unusual Shift${totalAnomalies === 1 ? '' : 's'} Found`,
      headline: `Flagged ${parts.join(' and ')} compared to this station's recent baseline`,
      subline:
        'A spike or drop is a statistical departure from recent hours — not proof of a specific factory or traffic source.',
    };
  }

  if (data.summary.total_moderate_elevations > 0) {
    const modCount = data.summary.total_moderate_elevations;
    return {
      tone: 'elevated',
      chipLabel: 'Moderate Shifts',
      headline: `No extreme spikes, with ${modCount} hour${modCount === 1 ? '' : 's'} moderately above recent norms`,
      subline: 'Click any point on the chart or table below to inspect the hour-by-hour readings.',
    };
  }

  return {
    tone: 'normal',
    chipLabel: 'Steady Pattern',
    headline: `No sudden statistical spikes across ${data.valid_observations} valid hours`,
    subline:
      'Hourly levels stayed consistent with this station’s own baseline (even if overall pollution exceeds national limits).',
  };
}

/**
 * Derives a plain-English summary for multi-station spatial comparisons.
 */
export function deriveSpatialVerdict(
  comparison: SpatialComparisonResponse | null | undefined
): PlainVerdict | null {
  if (!comparison) return null;

  const summary = comparison.neighborhood_screening_summary;
  if (!summary) {
    return {
      tone: 'muted',
      chipLabel: `${comparison.total_valid_stations} Stations Compared`,
      headline: `Synced ${comparison.all_stations_coincident_hours} overlapping hours across nearby monitors`,
    };
  }

  if (summary.evaluation_status !== 'EVALUATED') {
    return {
      tone: 'elevated',
      chipLabel: 'Regional Timeline Paused',
      headline:
        summary.window_preset === '48h'
          ? 'Area-wide vs. local spike classification only runs on 24h and 7d windows'
          : 'Not enough overlapping station data to separate regional vs. local events',
      subline: summary.suppression_reason || undefined,
    };
  }

  const concurrent = summary.concurrent_elevation_hours_count;
  const localized = summary.station_localized_elevation_hours_count;

  if (concurrent > 0 && localized > 0) {
    return {
      tone: 'anomaly',
      chipLabel: 'Mixed Regional & Local Spikes',
      headline: `${concurrent} hour(s) rose together across nearby stations; ${localized} hour(s) spiked only at the main station`,
      subline: 'Click any hour block in the timeline below to see which stations rose together.',
    };
  }

  if (concurrent > 0) {
    return {
      tone: 'anomaly',
      chipLabel: 'Regional Event Signal',
      headline: `${concurrent} hour(s) spiked at both the main station and nearby monitors at the same time`,
      subline: 'Shared timing suggests wider area conditions, though monitor proximity alone does not prove wind transport.',
    };
  }

  if (localized > 0) {
    return {
      tone: 'elevated',
      chipLabel: 'Local Station Spike',
      headline: `${localized} hour(s) spiked at the main station while nearby monitors stayed normal`,
      subline: 'Points toward conditions near the primary sensor rather than the whole surrounding network.',
    };
  }

  return {
    tone: 'normal',
    chipLabel: 'Stations in Agreement',
    headline: `Main station and nearby monitors moved within normal ranges across ${summary.evaluable_hours_count} evaluated hours`,
    subline: 'Comparison reflects individual monitor locations, not a continuous city-wide concentration map.',
  };
}

