import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StatusBanner } from './StatusBanner';

describe('StatusBanner', () => {
  it('renders calm wake-up state with shimmer when backend is waking up', () => {
    render(
      <StatusBanner
        health={{
          isLoading: false,
          data: null,
          error: 'Timeout',
          latencyMs: null,
        }}
        onRefresh={vi.fn()}
        isWakingUp={true}
        retryAttempt={1}
        maxRetries={3}
      />
    );

    expect(screen.getByText(/Waking the data service… \(Attempt 1\/3\)/i)).toBeInTheDocument();
  });
});
