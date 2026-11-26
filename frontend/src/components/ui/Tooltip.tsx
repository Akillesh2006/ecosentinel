import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { HelpCircle } from 'lucide-react';
import { GLOSSARY, type GlossaryKey } from '../../utils/glossary';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Radix-powered accessible tooltip compatible with standalone tests and app shell.
 */
export const Tooltip: React.FC<TooltipProps> = ({ content, children, side = 'top' }) => {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content className={styles.content} side={side} sideOffset={6}>
            {content}
            <TooltipPrimitive.Arrow className={styles.arrow} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
};

export interface GlossaryTermProps {
  termKey: GlossaryKey;
  children?: React.ReactNode;
  showIcon?: boolean;
}

/**
 * Wraps statistical or regulatory jargon with a plain-English glossary tooltip.
 */
export const GlossaryTerm: React.FC<GlossaryTermProps> = ({
  termKey,
  children,
  showIcon = true,
}) => {
  const entry = GLOSSARY[termKey];

  return (
    <Tooltip
      content={
        <span>
          <span className={styles.glossaryTitle}>{entry.label}</span>
          <span className={styles.glossaryBody}>{entry.plainExplanation}</span>
        </span>
      }
    >
      <button type="button" className={styles.glossaryTrigger} aria-label={`${entry.label}: ${entry.plainExplanation}`}>
        <span>{children ?? entry.label}</span>
        {showIcon && <HelpCircle size={12} style={{ opacity: 0.75, flexShrink: 0 }} aria-hidden="true" />}
      </button>
    </Tooltip>
  );
};

