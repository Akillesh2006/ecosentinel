import React from 'react';

export interface ApiKeyMissingBannerProps {
  onRetry?: () => void;
  title?: string;
  contextMessage?: string;
}

export const ApiKeyMissingBanner: React.FC<ApiKeyMissingBannerProps> = ({
  onRetry,
  title = 'OpenAQ API Key Required for Live Station Queries',
  contextMessage,
}) => {
  return (
    <div className="missing-key-card" role="alert">
      <div className="missing-key-icon" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div className="missing-key-body">
        <h3>{title}</h3>
        {contextMessage ? (
          <p>{contextMessage}</p>
        ) : (
          <p>
            OpenAQ API v3 enforces mandatory authentication via the <code>X-API-Key</code> header for all
            requests. To retrieve live observations for Indian stations, register for a free key:
          </p>
        )}
        <ol className="missing-key-steps">
          <li>
            Visit{' '}
            <a
              href="https://explore.openaq.org/register"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              explore.openaq.org/register ↗
            </a>{' '}
            and generate a free developer key (60 req/min, 2,000 req/hr).
          </li>
          <li>
            In your EcoSentinel root directory, set the key in <code>.env</code>:
            <div className="code-block-snippet">OPENAQ_API_KEY="your_api_key_here"</div>
          </li>
          <li>Restart the backend or click the button below to refresh.</li>
        </ol>
        {onRetry && (
          <button
            type="button"
            className="btn-secondary"
            onClick={onRetry}
            style={{ marginTop: '0.75rem' }}
          >
            Retry Station Query
          </button>
        )}
      </div>
    </div>
  );
};

export default ApiKeyMissingBanner;
