import React, { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import type { LocationSummary } from '../../types';
import styles from './Stations.module.css';

export interface StationComboboxProps {
  locations: LocationSummary[];
  selectedId: number | null;
  onSelect: (stationId: number) => void;
  disabled?: boolean;
  labelId?: string;
}

/**
 * Searchable station selector built on Radix Popover + cmdk,
 * grouping stations by city/locality with live/stale dot indicators and keyboard nav.
 */
export const StationCombobox: React.FC<StationComboboxProps> = ({
  locations,
  selectedId,
  onSelect,
  disabled = false,
  labelId = 'station-combobox-label',
}) => {
  const [open, setOpen] = useState(false);

  const selectedStation = useMemo(
    () => locations.find((loc) => loc.id === selectedId) || null,
    [locations, selectedId]
  );

  const groupedByCity = useMemo(() => {
    const groups = new Map<string, LocationSummary[]>();
    for (const loc of locations) {
      const city = loc.locality?.trim() || 'Other Regions';
      const existing = groups.get(city);
      if (existing) {
        existing.push(loc);
      } else {
        groups.set(city, [loc]);
      }
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [locations]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-labelledby={labelId}
          aria-label={selectedStation ? `Selected Station: ${selectedStation.name}` : 'Selected Station'}
          data-selected-station={selectedStation ? String(selectedStation.id) : ''}
          className={styles.comboboxTrigger}
          disabled={disabled || locations.length === 0}
        >
          <span className={styles.triggerLeft}>
            {selectedStation && (
              <span
                className={`${styles.statusDot} ${
                  selectedStation.is_stale ? styles.dotStale : styles.dotLive
                }`}
                title={selectedStation.is_stale ? 'Stale (>24h)' : 'Active monitor'}
                aria-hidden="true"
              />
            )}
            <span className={styles.triggerName}>
              {selectedStation
                ? `#${selectedStation.id} · ${selectedStation.name}`
                : locations.length === 0
                  ? 'No stations loaded'
                  : 'Choose a monitoring station...'}
            </span>
          </span>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {selectedStation && <span className={styles.triggerMeta}>#{selectedStation.id}</span>}
            <ChevronsUpDown size={15} style={{ color: 'var(--eco-text-muted)' }} aria-hidden="true" />
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content className={styles.popoverContent} align="start" sideOffset={6}>
          <Command label="Filter monitoring stations">
            <div className={styles.cmdInputRow}>
              <Search size={14} aria-hidden="true" />
              <Command.Input
                className={styles.cmdInput}
                placeholder="Filter loaded stations by name, city, or ID..."
              />
            </div>

            <Command.List className={styles.cmdList}>
              <Command.Empty className={styles.cmdEmpty}>
                No loaded stations match your filter.
              </Command.Empty>

              {groupedByCity.map(([city, items]) => (
                <Command.Group key={city} heading={city} className={styles.cmdGroup}>
                  {items.map((loc) => {
                    const isSelected = loc.id === selectedId;
                    return (
                      <Command.Item
                        key={loc.id}
                        value={`${loc.name} ${city} ${loc.id} ${loc.provider_name}`}
                        data-station-id={loc.id}
                        className={styles.cmdItem}
                        onSelect={() => {
                          onSelect(loc.id);
                          setOpen(false);
                        }}
                      >
                        <div className={styles.cmdItemMain}>
                          <span
                            className={`${styles.statusDot} ${
                              loc.is_stale ? styles.dotStale : styles.dotLive
                            }`}
                            aria-hidden="true"
                          />
                          <span className={styles.cmdItemName}>{loc.name}</span>
                        </div>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontFamily: 'var(--eco-font-mono)',
                            fontSize: '11px',
                            color: 'var(--eco-text-muted)',
                            flexShrink: 0,
                          }}
                        >
                          #{loc.id}
                          {isSelected && <Check size={14} style={{ color: 'var(--eco-teal-text)' }} />}
                        </span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
