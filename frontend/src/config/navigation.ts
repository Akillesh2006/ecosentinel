import type { NavSection, SectionId } from '../types';

export interface RouteSection extends NavSection {
  path: string;
}

export const SECTIONS: RouteSection[] = [
  {
    id: 'overview',
    path: '/',
    label: 'Home',
    shortDescription: 'Network map & station snapshot',
    statusBadge: '',
    statusType: 'active',
  },
  {
    id: 'investigate',
    path: '/stations',
    label: 'Stations',
    shortDescription: 'Search monitors, trends & limits',
    statusBadge: '',
    statusType: 'active',
  },
  {
    id: 'anomalies',
    path: '/anomalies',
    label: 'Anomalies',
    shortDescription: 'Spot sudden spikes & flatlines',
    statusBadge: '',
    statusType: 'active',
  },
  {
    id: 'spatial',
    path: '/compare',
    label: 'Compare Nearby',
    shortDescription: 'Nearby monitors & local vs. regional',
    statusBadge: '',
    statusType: 'active',
  },
  {
    id: 'evidence',
    path: '/quality',
    label: 'Data Quality',
    shortDescription: 'Completeness gate, freshness & audit',
    statusBadge: '',
    statusType: 'active',
  },
  {
    id: 'reports',
    path: '/action-plan',
    label: 'Action Plan',
    shortDescription: 'Mitigation checklist & dossier exports',
    statusBadge: '',
    statusType: 'active',
  },
];

export const SECTION_PATH_MAP: Record<SectionId, string> = {
  overview: '/',
  investigate: '/stations',
  anomalies: '/anomalies',
  spatial: '/compare',
  evidence: '/quality',
  reports: '/action-plan',
};

export function getSectionByPath(pathname: string): RouteSection {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const match = SECTIONS.find((s) => s.path === normalized);
  return match ?? SECTIONS[0];
}

