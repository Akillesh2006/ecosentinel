export interface CityHub {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  monitoringNote: string;
  primaryPollutants: string;
}

/** Simplified, verified geographic boundary coordinates of India [lon, lat]. */
export const INDIA_BORDER_COORDS: [number, number][] = [
  [74.5, 35.5], [77.5, 35.8], [79.0, 34.5], [79.8, 32.5], [78.8, 31.2],
  [80.8, 30.2], [80.2, 28.9], [81.6, 27.9], [84.0, 27.3], [88.1, 27.8],
  [88.9, 27.1], [91.5, 27.8], [95.4, 29.2], [97.3, 28.1], [95.2, 26.5],
  [94.7, 25.2], [93.2, 22.0], [92.6, 23.8], [91.2, 23.9], [92.2, 25.1],
  [89.8, 25.9], [88.1, 24.8], [89.0, 22.0], [86.9, 21.5], [85.0, 19.3],
  [83.3, 17.7], [81.2, 16.2], [80.3, 14.0], [80.2, 12.6], [79.8, 10.3],
  [77.5, 8.1],  [76.2, 9.9],  [74.8, 12.9], [73.8, 15.4], [72.8, 19.1],
  [72.6, 21.6], [70.2, 20.8], [68.8, 22.8], [69.0, 23.9], [70.9, 24.6],
  [70.1, 27.2], [72.9, 29.3], [74.6, 31.6], [74.2, 33.4], [74.5, 35.5],
];

export const INDIA_CITY_HUBS: CityHub[] = [
  {
    id: 'delhi',
    name: 'Delhi NCR',
    state: 'Delhi',
    lat: 28.6139,
    lon: 77.209,
    monitoringNote: 'High-density CPCB & DPCC urban corridor',
    primaryPollutants: 'PM2.5, PM10, NO₂, O₃',
  },
  {
    id: 'jaipur',
    name: 'Jaipur',
    state: 'Rajasthan',
    lat: 26.9124,
    lon: 75.7873,
    monitoringNote: 'Semi-arid RSPCB particulate & CO monitors',
    primaryPollutants: 'PM10, PM2.5, CO',
  },
  {
    id: 'lucknow',
    name: 'Lucknow',
    state: 'Uttar Pradesh',
    lat: 26.8467,
    lon: 80.9462,
    monitoringNote: 'Indo-Gangetic Basin UPPCB stations',
    primaryPollutants: 'PM2.5, NO₂, SO₂',
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    state: 'Maharashtra',
    lat: 19.076,
    lon: 72.8777,
    monitoringNote: 'Coastal MPCB & IITM urban stations',
    primaryPollutants: 'PM2.5, PM10, NO₂',
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad',
    state: 'Telangana',
    lat: 17.385,
    lon: 78.4867,
    monitoringNote: 'Deccan urban TSPCB monitoring ring',
    primaryPollutants: 'PM2.5, O₃, SO₂',
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru',
    state: 'Karnataka',
    lat: 12.9716,
    lon: 77.5946,
    monitoringNote: 'KSPCB urban traffic & background sites',
    primaryPollutants: 'PM2.5, NO₂, CO',
  },
  {
    id: 'chennai',
    name: 'Chennai',
    state: 'Tamil Nadu',
    lat: 13.0827,
    lon: 80.2707,
    monitoringNote: 'Coastal TNPCB industrial & city network',
    primaryPollutants: 'PM2.5, SO₂, NO₂',
  },
  {
    id: 'kolkata',
    name: 'Kolkata',
    state: 'West Bengal',
    lat: 22.5726,
    lon: 88.3639,
    monitoringNote: 'Eastern delta WBPCB continuous monitors',
    primaryPollutants: 'PM2.5, PM10, CO',
  },
];

const MAP_WIDTH = 440;
const MAP_HEIGHT = 420;
const LON_MIN = 67.5;
const LON_MAX = 98.0;
const LAT_MIN = 6.5;
const LAT_MAX = 36.8;

/** Project geographic [lon, lat] onto the 440x420 India SVG coordinate space. */
export function projectIndiaPoint(lon: number, lat: number): { x: number; y: number } {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (MAP_WIDTH - 48) + 24;
  const y = MAP_HEIGHT - (((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * (MAP_HEIGHT - 44) + 22);
  return {
    x: Number(x.toFixed(1)),
    y: Number(y.toFixed(1)),
  };
}

export const INDIA_OUTLINE_PATH = INDIA_BORDER_COORDS.map((coord, idx) => {
  const { x, y } = projectIndiaPoint(coord[0], coord[1]);
  return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
}).join(' ') + ' Z';

