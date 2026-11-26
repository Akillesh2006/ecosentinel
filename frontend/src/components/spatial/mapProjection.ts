import type { Coordinates, StationComparisonMetadata } from '../../types';

export const NEIGHBOR_COLORS = ['#f59e0b', '#38bdf8', '#f43f5e', '#818cf8'];
export const REF_COLOR = '#14b8a6';

export interface ProjectedStation {
  station: StationComparisonMetadata;
  rawLat: number;
  rawLon: number;
  x: number;
  y: number;
  displayX: number;
  displayY: number;
  isCoLocated: boolean;
  color: string;
  roleLabel: string;
  neighborIndex?: number;
}

export interface MapProjectionResult {
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  offsetX: number;
  offsetY: number;
  usedW: number;
  usedH: number;
  midLat: number;
  boxLonMin: number;
  boxLonMax: number;
  projectedStations: ProjectedStation[];
  hasCoLocatedStations: boolean;
  ringDistances: number[];
  scaleBarKm: number;
  scaleBarPx: number;
  kmToPixels: (km: number) => number;
}

export function isValidCoordinate(c?: Coordinates | null): c is Coordinates {
  return (
    c !== null &&
    c !== undefined &&
    typeof c.latitude === 'number' &&
    typeof c.longitude === 'number' &&
    isFinite(c.latitude) &&
    isFinite(c.longitude) &&
    c.latitude >= -90 &&
    c.latitude <= 90 &&
    c.longitude >= -180 &&
    c.longitude <= 180
  );
}

/**
 * Computes cosine-adjusted equirectangular WGS-84 projection and resolves co-located marker offsets.
 */
export function projectSpatialMap(
  validStations: StationComparisonMetadata[],
  radiusKm: number
): MapProjectionResult {
  const width = 800;
  const height = 440;
  const paddingLeft = 60;
  const paddingRight = 60;
  const paddingTop = 45;
  const paddingBottom = 55;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const lats = validStations.map((st) => st.coordinates!.latitude);
  const lons = validStations.map((st) => st.coordinates!.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const midLat = (minLat + maxLat) / 2;
  const cosFactor = Math.max(0.1, Math.cos((midLat * Math.PI) / 180));
  const latSpanRaw = maxLat - minLat;
  const lonSpanRaw = maxLon - minLon;
  const KM_PER_DEG_LAT = 111.139;

  let boxLatMin: number;
  let boxLatMax: number;
  let boxLonMin: number;
  let boxLonMax: number;

  if (latSpanRaw < 0.0001 && lonSpanRaw < 0.0001) {
    const deltaDeg = (Math.max(radiusKm, 10) / KM_PER_DEG_LAT) * 1.25;
    boxLatMin = midLat - deltaDeg;
    boxLatMax = midLat + deltaDeg;
    boxLonMin = minLon - deltaDeg / cosFactor;
    boxLonMax = minLon + deltaDeg / cosFactor;
  } else {
    const padLat = Math.max(latSpanRaw * 0.25, 0.03);
    const padLon = Math.max(lonSpanRaw * 0.25, 0.03 / cosFactor);
    boxLatMin = minLat - padLat;
    boxLatMax = maxLat + padLat;
    boxLonMin = minLon - padLon;
    boxLonMax = maxLon + padLon;
  }

  const totalGeoW = (boxLonMax - boxLonMin) * cosFactor;
  const totalGeoH = boxLatMax - boxLatMin;
  const scale = Math.min(innerWidth / totalGeoW, innerHeight / totalGeoH);
  const usedW = totalGeoW * scale;
  const usedH = totalGeoH * scale;
  const offsetX = paddingLeft + (innerWidth - usedW) / 2;
  const offsetY = paddingTop + (innerHeight - usedH) / 2;

  const kmToPixels = (km: number): number => (km / KM_PER_DEG_LAT) * scale;

  let neighborCounter = 0;
  const projectedStations: ProjectedStation[] = validStations.map((st) => {
    const rawLat = st.coordinates!.latitude;
    const rawLon = st.coordinates!.longitude;
    const x = offsetX + (rawLon - boxLonMin) * cosFactor * scale;
    const y = offsetY + (boxLatMax - rawLat) * scale;

    let color = REF_COLOR;
    let roleLabel = 'Reference Anchor';
    let nIdx: number | undefined;

    if (!st.is_reference) {
      nIdx = neighborCounter + 1;
      color = NEIGHBOR_COLORS[neighborCounter % NEIGHBOR_COLORS.length];
      neighborCounter++;
      roleLabel = `Neighbor #${nIdx}`;
    }

    return {
      station: st,
      rawLat,
      rawLon,
      x,
      y,
      displayX: x,
      displayY: y,
      isCoLocated: false,
      color,
      roleLabel,
      neighborIndex: nIdx,
    };
  });

  let hasCoLocatedStations = false;
  for (let i = 0; i < projectedStations.length; i++) {
    for (let j = i + 1; j < projectedStations.length; j++) {
      const dx = projectedStations[i].x - projectedStations[j].x;
      const dy = projectedStations[i].y - projectedStations[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 24) {
        hasCoLocatedStations = true;
        projectedStations[i].isCoLocated = true;
        projectedStations[j].isCoLocated = true;
        const angle = Math.atan2(dy, dx);
        const offsetDist = (24 - dist) / 2 + 6;
        projectedStations[i].displayX = projectedStations[i].x + Math.cos(angle) * offsetDist;
        projectedStations[i].displayY = projectedStations[i].y + Math.sin(angle) * offsetDist;
        projectedStations[j].displayX = projectedStations[j].x - Math.cos(angle) * offsetDist;
        projectedStations[j].displayY = projectedStations[j].y - Math.sin(angle) * offsetDist;
      }
    }
  }

  const ringDistances =
    radiusKm <= 20
      ? [5, Math.round(radiusKm)]
      : radiusKm <= 40
      ? [10, Math.round(radiusKm)]
      : [20, Math.round(radiusKm)];

  let scaleBarKm = 10;
  if (radiusKm <= 15) scaleBarKm = 5;
  else if (radiusKm > 50) scaleBarKm = 25;

  return {
    width,
    height,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
    offsetX,
    offsetY,
    usedW,
    usedH,
    midLat,
    boxLonMin,
    boxLonMax,
    projectedStations,
    hasCoLocatedStations,
    ringDistances,
    scaleBarKm,
    scaleBarPx: kmToPixels(scaleBarKm),
    kmToPixels,
  };
}

