export interface TimedPoint {
  timestampMs: number;
  value: number;
}

export interface ThresholdSpec {
  id: string;
  label: string;
  value: number;
  color: string;
  dashArray?: string;
}

export interface AxisTick {
  x: number;
  label: string;
}

/** Default interval above which adjacent hourly readings are broken instead of interpolated (90 min). */
export const DEFAULT_GAP_BREAK_MS = 90 * 60 * 1000;

/** Parse an ISO timestamp string to epoch milliseconds, returning NaN when invalid. */
export function parseTimestampMs(iso?: string | null): number {
  if (!iso) return NaN;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

/**
 * Sort chronological points ascending by timestamp and break into contiguous segments
 * whenever adjacent timestamps exceed `maxGapMs`. Never interpolates missing intervals.
 */
export function segmentChronologicalSeries<T extends { timestampMs: number }>(
  points: T[],
  maxGapMs: number = DEFAULT_GAP_BREAK_MS
): T[][] {
  const validSorted = [...points]
    .filter((p) => Number.isFinite(p.timestampMs))
    .sort((a, b) => a.timestampMs - b.timestampMs);

  if (validSorted.length === 0) return [];

  const segments: T[][] = [];
  let current: T[] = [validSorted[0]];

  for (let i = 1; i < validSorted.length; i++) {
    const prev = validSorted[i - 1];
    const curr = validSorted[i];
    if (curr.timestampMs - prev.timestampMs > maxGapMs) {
      segments.push(current);
      current = [curr];
    } else {
      current.push(curr);
    }
  }
  segments.push(current);
  return segments;
}

/** Compute balanced SVG Y-axis bounds and clean tick values. */
export function computeYDomain(
  values: number[],
  extraReferenceValues: number[] = [],
  tickCount: number = 4
): { minVal: number; maxVal: number; ticks: number[] } {
  const finiteValues = values.filter((v) => Number.isFinite(v));
  const rawMin = finiteValues.length > 0 ? Math.min(...finiteValues) : 0;
  const rawMax = finiteValues.length > 0 ? Math.max(...finiteValues) : 10;

  const baseMin = rawMin < 0 ? rawMin : 0;
  const relevantRefs = extraReferenceValues.filter(
    (ref) => Number.isFinite(ref) && ref <= Math.max(rawMax * 2.2, 20)
  );
  const candidateMax = Math.max(rawMax, ...relevantRefs, baseMin + 1);
  const paddedMax = candidateMax * 1.12;

  const span = Math.max(paddedMax - baseMin, 1e-6);
  const roughStep = span / Math.max(1, tickCount - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const fraction = roughStep / magnitude;
  let niceFraction = 1;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;

  const step = niceFraction * magnitude;
  const minVal = baseMin === 0 ? 0 : Math.floor(baseMin / step) * step;
  const maxVal = Math.max(minVal + step, Math.ceil(paddedMax / step) * step);

  const ticks: number[] = [];
  const count = Math.min(8, Math.round((maxVal - minVal) / step));
  for (let i = 0; i <= count; i++) {
    ticks.push(Number((minVal + i * step).toFixed(4)));
  }

  return { minVal, maxVal, ticks };
}

/** Format an epoch ms value into compact IST clock/date label for X-axis ticks. */
export function formatAxisTickIst(ms: number, totalSpanMs: number): string {
  const d = new Date(ms);
  if (totalSpanMs > 36 * 3600 * 1000) {
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
    });
  }
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Format a numeric tick cleanly for compact Y-axis display. */
export function formatAxisValue(val: number): string {
  if (Math.abs(val) >= 100) return String(Math.round(val));
  if (Math.abs(val) >= 10) return val % 1 === 0 ? String(val) : val.toFixed(1);
  return val % 1 === 0 ? String(val) : val.toFixed(2);
}

/** Build evenly spaced X-axis ticks between `minTs` and `maxTs`. */
export function buildXTicks(
  minTs: number,
  maxTs: number,
  plotLeft: number,
  plotWidth: number,
  desiredCount: number = 5
): AxisTick[] {
  if (!Number.isFinite(minTs) || !Number.isFinite(maxTs)) return [];
  const span = maxTs - minTs;
  if (span <= 0) {
    return [{ x: plotLeft + plotWidth / 2, label: formatAxisTickIst(minTs, 0) }];
  }
  const count = Math.max(2, desiredCount);
  const ticks: AxisTick[] = [];
  for (let i = 0; i < count; i++) {
    const frac = i / (count - 1);
    const ts = minTs + frac * span;
    ticks.push({
      x: plotLeft + frac * plotWidth,
      label: formatAxisTickIst(ts, span),
    });
  }
  return ticks;
}

