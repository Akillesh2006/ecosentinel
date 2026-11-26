import React, { useState } from 'react';
import { ArrowRight, MapPin, Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { useStationContext } from '../../context/StationContext';
import styles from './Home.module.css';

export interface HeroStationFinderProps {
  onGoToStations: () => void;
}

const FEATURED_CITIES = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Kolkata', 'Jaipur'];

/**
 * Plain-language station search prompt on the Home workspace.
 * Defers OpenAQ station queries until the user explicitly searches or picks a city.
 */
export const HeroStationFinder: React.FC<HeroStationFinderProps> = ({ onGoToStations }) => {
  const stationCtx = useStationContext();
  const [draftQuery, setDraftQuery] = useState(stationCtx?.searchQuery || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    stationCtx?.setSearchQuery(draftQuery.trim());
    onGoToStations();
  };

  const handlePickCity = (city: string) => {
    setDraftQuery(city);
    stationCtx?.setSearchQuery(city);
    onGoToStations();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--eco-space-3)' }}>
      <form className={styles.finderBar} onSubmit={handleSubmit}>
        <label htmlFor="home-station-finder" className="sr-only">
          Find your city or monitoring station
        </label>
        <div className={styles.finderInputWrap}>
          <Search size={16} className={styles.finderIcon} aria-hidden="true" />
          <input
            id="home-station-finder"
            type="search"
            className={styles.finderInput}
            placeholder="Find your city or monitoring station (e.g., Delhi, Mumbai, Bengaluru)..."
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" rightIcon={<ArrowRight size={15} />}>
          Find Stations
        </Button>
      </form>

      <div className={styles.finderQuickRow}>
        <span>Quick jump:</span>
        {FEATURED_CITIES.map((city) => (
          <button
            key={city}
            type="button"
            className={styles.cityChip}
            onClick={() => handlePickCity(city)}
          >
            <MapPin size={11} aria-hidden="true" />
            <span>{city}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

