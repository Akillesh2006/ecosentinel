import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBanner } from './StatusBanner';

describe('StatusBanner', () => {
  it('renders friendly Render cold-start wakeup state when backend is waking up', () => {
    render(
      <StatusBanner
        health={{
          isLoading: true,
          data: null,
          error: null,
          latencyMs: null,
          lastChecked: null,
        }}
        onRefresh={vi.fn()}
        isWakingUp={true}
        retryAttempt={1}
        maxRetries={3}
      />
    );

    expect(screen.getByText(/Waking up the server… \(Retry 1\/3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Render free-tier instances spin down/i)).toBeInTheDocument();
  });
});

