import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import styles from './Tabs.module.css';

export interface TabItem {
  value: string;
  label: string;
  badge?: string;
}

export interface SegmentedTabsProps {
  value: string;
  onValueChange: (value: string) => void;
  items: TabItem[];
  ariaLabel: string;
  className?: string;
}

/**
 * Accessible Radix segmented tab control for pollutant switches and time-window selectors.
 */
export const SegmentedTabs: React.FC<SegmentedTabsProps> = ({
  value,
  onValueChange,
  items,
  ariaLabel,
  className = '',
}) => {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange}>
      <TabsPrimitive.List className={`${styles.list} ${className}`.trim()} aria-label={ariaLabel}>
        {items.map((item) => (
          <TabsPrimitive.Trigger key={item.value} value={item.value} className={styles.trigger}>
            <span>{item.label}</span>
            {item.badge && <span className={styles.sub}>{item.badge}</span>}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
};

