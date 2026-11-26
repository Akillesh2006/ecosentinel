import React from 'react';
import { ExternalLink, KeyRound, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';
import styles from './ApiKeyMissingBanner.module.css';

export interface ApiKeyMissingBannerProps {
  onRetry?: () => void;
  title?: string;
  contextMessage?: string;
}

/**
 * Onboarding card shown whenever OpenAQ API v3 authentication is unconfigured.
 */
export const ApiKeyMissingBanner: React.FC<ApiKeyMissingBannerProps> = ({
  onRetry,
  title = 'OpenAQ API Key Required for Live Station Queries',
  contextMessage,
}) => {
  return (
    <div className={styles.card} role="alert">
      <div className={styles.iconBox} aria-hidden="true">
        <KeyRound size={22} />
      </div>

      <div className={styles.body}>
        <h3 className={styles.title}>{title}</h3>
        {contextMessage ? (
          <p className={styles.desc}>{contextMessage}</p>
        ) : (
          <p className={styles.desc}>
            OpenAQ API v3 enforces mandatory authentication via the <code>X-API-Key</code> header for all
            requests. To retrieve live observations for Indian stations, register for a free developer key:
          </p>
        )}

        <ol className={styles.steps}>
          <li>
            Visit{' '}
            <a
              href="https://explore.openaq.org/register"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              <span>explore.openaq.org/register</span>
              <ExternalLink size={12} aria-hidden="true" />
            </a>{' '}
            and generate a free developer key (60 req/min, 2,000 req/hr).
          </li>
          <li>
            In your EcoSentinel root directory, add the key to <code>.env</code>:
            <div className={styles.snippet}>OPENAQ_API_KEY="your_api_key_here"</div>
          </li>
          <li>Restart the backend or click retry below to load station telemetry.</li>
        </ol>

        {onRetry && (
          <div className={styles.retryRow}>
            <Button variant="secondary" size="sm" onClick={onRetry} leftIcon={<RefreshCw size={14} />}>
              Retry Station Query
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiKeyMissingBanner;
