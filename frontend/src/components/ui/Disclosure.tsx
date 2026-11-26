import React, { useState } from 'react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { Calculator, ChevronDown } from 'lucide-react';
import styles from './Disclosure.module.css';

export interface DisclosureProps {
  label?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Progressive-disclosure panel ("Show the math") hiding technical formulas and
 * statistical detail until a reader chooses to inspect them.
 */
export const Disclosure: React.FC<DisclosureProps> = ({
  label = 'Show the math',
  icon,
  defaultOpen = false,
  children,
  className = '',
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <CollapsiblePrimitive.Root
      open={open}
      onOpenChange={setOpen}
      className={`${styles.root} ${className}`.trim()}
    >
      <CollapsiblePrimitive.Trigger className={styles.trigger}>
        <span className={styles.triggerLeft}>
          <span style={{ color: 'var(--eco-teal-text)', display: 'inline-flex' }} aria-hidden="true">
            {icon ?? <Calculator size={16} />}
          </span>
          <span>{label}</span>
        </span>
        <ChevronDown size={16} className={styles.chevron} aria-hidden="true" />
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Content className={styles.content}>
        <div className={styles.contentInner}>{children}</div>
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  );
};

