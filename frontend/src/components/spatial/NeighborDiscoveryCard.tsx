import React from 'react';
import type {
  AirQualityApiError,
  NeighborStationSummary,
  SpatialNeighborsResponse,
} from '../../types';
import { ApiKeyMissingBanner } from '../ApiKeyMissingBanner';
import styles from './Spatial.module.css';

export interface NeighborDiscoveryCardProps {
  radiusKm: number;
  paramDisplayName: string;
  neighborsData: SpatialNeighborsResponse | null;
  selectedNeighborIds: number[];
  isLoadingNeighbors: boolean;
  neighborError: AirQualityApiError | null;
  onRefresh: () => void;
  onToggleNeighbor: (neighborId: number) => void;
}

/**
 * Displays candidate evaluation diagnostics and neighbor station selection checkboxes (max 4).
 */
export const NeighborDiscoveryCard: React.FC<NeighborDiscoveryCardProps> = ({
  radiusKm,
  paramDisplayName,
  neighborsData,
  selectedNeighborIds,
  isLoadingNeighbors,
  neighborError,
  onRefresh,
  onToggleNeighbor,
}) => {
  const isMaxNeighborsReached = selectedNeighborIds.length >= 4;

  return (
    <div className={`card neighbor-discovery-card ${styles.discoveryCard}`}>
      <div className={styles.discoveryHeader}>
        <div>
          <div className={styles.discoveryTitleRow}>
            <span className="card-badge">Spatial Discovery</span>
            <h3 className={styles.discoveryTitle}>
              Eligible Neighbor Stations within {radiusKm} km
            </h3>
          </div>
          <p className={styles.discoverySubtitle}>
            Select up to 4 neighboring stations to construct a multi-station comparison ensemble (maximum 5 stations total).
          </p>
        </div>

        <div className={styles.discoveryActions}>
          <span
            className={`badge ${selectedNeighborIds.length === 4 ? 'badge-warning' : 'badge-normal'} ${styles.badgeSmall}`}
          >
            {selectedNeighborIds.length} of 4 Neighbors Selected ({selectedNeighborIds.length + 1}/5 Total)
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoadingNeighbors}
            className={`btn btn-secondary ${styles.refreshBtn}`}
          >
            {isLoadingNeighbors ? 'Scanning...' : 'Refresh Neighbors'}
          </button>
        </div>
      </div>

      {neighborsData && (
        <div className={`spatial-diagnostics-bar ${styles.diagnosticsBar}`}>
          <div>
            Candidates Evaluated:{' '}
            <strong className={styles.diagStrong}>{neighborsData.candidates_examined_count}</strong>
          </div>
          <div>
            Eligible ({paramDisplayName}):{' '}
            <strong className={styles.diagTeal}>{neighborsData.eligible_neighbors_count}</strong>
          </div>
          <div>
            Excluded (Lacks {paramDisplayName}):{' '}
            <strong className={styles.diagElevated}>{neighborsData.pollutant_incompatible_count}</strong>
          </div>
          <div>
            Excluded (Missing Coords):{' '}
            <strong className={styles.diagMuted}>{neighborsData.missing_coordinates_count}</strong>
          </div>
          <div>
            Excluded (&gt;{radiusKm} km):{' '}
            <strong className={styles.diagMuted}>{neighborsData.outside_radius_count}</strong>
          </div>
        </div>
      )}

      {isLoadingNeighbors && (
        <div className={styles.centerMessage}>
          Scanning regional coordinates and querying OpenAQ station catalog...
        </div>
      )}

      {neighborError && (
        neighborError.error_code === 'MISSING_API_KEY' || neighborError.status === 503 ? (
          <div className={styles.apiBannerWrap}>
            <ApiKeyMissingBanner onRetry={onRefresh} />
          </div>
        ) : (
          <div className={`card card-error ${styles.errorBox}`}>
            <strong>Neighbor Discovery Failed:</strong> {neighborError.message}
          </div>
        )
      )}

      {!isLoadingNeighbors && neighborsData && neighborsData.neighbors.length === 0 && (
        <div className={styles.centerMessage}>
          No neighboring stations monitoring <strong>{paramDisplayName}</strong> were found within {radiusKm} km.
          Try increasing the search radius above.
        </div>
      )}

      {!isLoadingNeighbors && neighborsData && neighborsData.neighbors.length > 0 && (
        <div className={`neighbors-grid ${styles.neighborsGrid}`}>
          {neighborsData.neighbors.map((neighbor: NeighborStationSummary) => {
            const isSelected = selectedNeighborIds.includes(neighbor.id);
            const isDisabled = !isSelected && isMaxNeighborsReached;

            return (
              <label
                key={neighbor.id}
                className={`neighbor-card ${isSelected ? `selected ${styles.neighborCardSelected}` : ''} ${
                  isDisabled ? `disabled ${styles.neighborCardDisabled}` : ''
                } ${styles.neighborCard}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => onToggleNeighbor(neighbor.id)}
                  className={`${styles.neighborCheckbox} ${isDisabled ? styles.neighborCheckboxDisabled : ''}`}
                  aria-label={`Select ${neighbor.name} for comparison`}
                />
                <div className={styles.neighborInfo}>
                  <div className={styles.neighborTopRow}>
                    <strong className={styles.neighborName}>{neighbor.name}</strong>
                    <span className={styles.neighborDist}>{neighbor.distance_km.toFixed(1)} km</span>
                  </div>
                  <div className={styles.neighborMeta}>
                    {neighbor.provider_name} {neighbor.locality ? `• ${neighbor.locality}` : ''}
                  </div>
                  <div className={styles.neighborBadges}>
                    <span>Sensor #{neighbor.sensor_id ?? 'N/A'}</span>
                    {neighbor.is_stale && (
                      <span className={`badge badge-warning ${styles.staleBadge}`}>Stale</span>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {isMaxNeighborsReached && (
        <div className={styles.maxNotice}>
          Maximum selection reached: 4 neighbors + 1 reference station = 5 stations total. Deselect a neighbor to choose another.
        </div>
      )}
    </div>
  );
};

