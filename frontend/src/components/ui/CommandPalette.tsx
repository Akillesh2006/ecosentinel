import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import {
  Activity,
  ClipboardCheck,
  Home,
  Moon,
  Radio,
  Search,
  Share2,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import type { LocationSummary, SectionId } from '../../types';
import { SECTIONS } from '../../config/navigation';
import { useTheme } from '../../context/ThemeContext';
import { fetchLocations } from '../../services/api';
import styles from './CommandPalette.module.css';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cachedStations: LocationSummary[];
  onStationsLoaded?: (stations: LocationSummary[]) => void;
  onNavigateSection: (sectionId: SectionId) => void;
  onSelectStation: (stationId: number) => void;
}

function getIcon(id: SectionId) {
  switch (id) {
    case 'overview':
      return <Home size={15} />;
    case 'investigate':
      return <Radio size={15} />;
    case 'anomalies':
      return <Activity size={15} />;
    case 'spatial':
      return <Share2 size={15} />;
    case 'evidence':
      return <ShieldCheck size={15} />;
    case 'reports':
      return <ClipboardCheck size={15} />;
  }
}

/**
 * Global keyboard-first command palette (Ctrl/Cmd + K) to jump across workspaces,
 * toggle dark/light theme, and search/select Indian air-quality monitoring stations.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onOpenChange,
  cachedStations,
  onStationsLoaded,
  onNavigateSection,
  onSelectStation,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [remoteStations, setRemoteStations] = useState<LocationSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Register global Ctrl/Cmd+K hotkey
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  // Fetch stations on demand only when palette opens cleanly
  useEffect(() => {
    if (!open || cachedStations.length > 0) return;
    let active = true;
    Promise.resolve().then(() => {
      if (active) setIsSearching(true);
    });
    fetchLocations(query.trim() || undefined).then((res) => {
      if (!active) return;
      setIsSearching(false);
      if (res.data) {
        setRemoteStations(res.data);
        onStationsLoaded?.(res.data);
      }
    });
    return () => {
      active = false;
    };
  }, [open, cachedStations.length, query, onStationsLoaded]);

  const stationPool = cachedStations.length > 0 ? cachedStations : remoteStations;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.dialog} aria-label="Quick navigation and station search">
          <Dialog.Title className="sr-only">EcoSentinel Quick Command Palette</Dialog.Title>
          <Command label="Command Palette" shouldFilter>
            <div className={styles.inputWrap}>
              <Search size={16} style={{ color: 'var(--eco-text-muted)', flexShrink: 0 }} aria-hidden="true" />
              <Command.Input
                className={styles.input}
                placeholder="Type a station name, city, or page..."
                value={query}
                onValueChange={setQuery}
              />
            </div>

            <Command.List className={styles.list}>
              <Command.Empty className={styles.empty}>
                {isSearching ? 'Searching monitoring stations…' : 'No matching stations or commands.'}
              </Command.Empty>

              <Command.Group heading={<div className={styles.groupHeading}>Workspaces</div>}>
                {SECTIONS.map((s) => (
                  <Command.Item
                    key={s.id}
                    value={`${s.label} ${s.shortDescription}`}
                    className={styles.item}
                    onSelect={() => {
                      onNavigateSection(s.id);
                      onOpenChange(false);
                    }}
                  >
                    <span className={styles.itemLeft}>
                      {getIcon(s.id)}
                      <span>{s.label}</span>
                    </span>
                    <span className={styles.itemMeta}>{s.path}</span>
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Group heading={<div className={styles.groupHeading}>Preferences</div>}>
                <Command.Item
                  value={`toggle theme ${theme === 'dark' ? 'light mode' : 'dark mode'}`}
                  className={styles.item}
                  onSelect={() => {
                    toggleTheme();
                    onOpenChange(false);
                  }}
                >
                  <span className={styles.itemLeft}>
                    {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                    <span>Switch to {theme === 'dark' ? 'light' : 'dark'} theme</span>
                  </span>
                  <span className={styles.itemMeta}>Theme</span>
                </Command.Item>
              </Command.Group>

              {stationPool.length > 0 && (
                <Command.Group heading={<div className={styles.groupHeading}>Monitoring Stations</div>}>
                  {stationPool.slice(0, 35).map((st) => (
                    <Command.Item
                      key={st.id}
                      value={`${st.name} ${st.locality || ''} ${st.id} ${st.provider_name}`}
                      className={styles.item}
                      onSelect={() => {
                        onSelectStation(st.id);
                        onOpenChange(false);
                      }}
                    >
                      <span className={styles.itemLeft}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: st.is_stale ? 'var(--eco-status-elevated)' : 'var(--eco-status-normal)',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {st.name}
                        </span>
                      </span>
                      <span className={styles.itemMeta}>
                        {st.locality || 'IN'} · {st.is_stale ? 'Stale' : 'Live'}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>

            <div className={styles.hintFooter}>
              <span>↑↓ Navigate · ↵ Open</span>
              <span>Esc to close</span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
