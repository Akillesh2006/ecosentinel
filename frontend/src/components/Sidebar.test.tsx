import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SECTIONS } from '../config/navigation';

describe('Sidebar Component', () => {
  it('renders plain-language workspace links without Milestone or Dossier jargon badges', () => {
    const handleSelect = vi.fn();
    render(
      <MemoryRouter>
        <Sidebar
          sections={SECTIONS}
          activeSection="overview"
          onSelectSection={handleSelect}
          isCollapsed={false}
          onToggleCollapse={vi.fn()}
          isMobileOpen={false}
          onCloseMobile={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Stations' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anomalies' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Compare Nearby' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Data Quality' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Action Plan' })).toBeInTheDocument();

    expect(screen.queryByText(/Milestone 6/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Milestone 7/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Dossier')).not.toBeInTheDocument();
  });

  it('triggers onSelectSection when a navigation link is clicked', () => {
    const handleSelect = vi.fn();
    const handleCloseMobile = vi.fn();

    render(
      <MemoryRouter>
        <Sidebar
          sections={SECTIONS}
          activeSection="overview"
          onSelectSection={handleSelect}
          isCollapsed={false}
          onToggleCollapse={vi.fn()}
          isMobileOpen={false}
          onCloseMobile={handleCloseMobile}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('link', { name: 'Anomalies' }));
    expect(handleSelect).toHaveBeenCalledWith('anomalies');
    expect(handleCloseMobile).toHaveBeenCalledTimes(1);
  });

  it('handles desktop collapse toggle and hides labels when collapsed', () => {
    const handleToggleCollapse = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <Sidebar
          sections={SECTIONS}
          activeSection="overview"
          onSelectSection={vi.fn()}
          isCollapsed={false}
          onToggleCollapse={handleToggleCollapse}
          isMobileOpen={false}
          onCloseMobile={vi.fn()}
        />
      </MemoryRouter>
    );

    const collapseBtn = screen.getByRole('button', { name: /Collapse sidebar/i });
    fireEvent.click(collapseBtn);
    expect(handleToggleCollapse).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <Sidebar
          sections={SECTIONS}
          activeSection="overview"
          onSelectSection={vi.fn()}
          isCollapsed={true}
          onToggleCollapse={handleToggleCollapse}
          isMobileOpen={false}
          onCloseMobile={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.queryByText('Network map & station snapshot')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Expand sidebar/i })).toBeInTheDocument();
  });

  it('renders mobile drawer with backdrop when isMobileOpen is true and handles close', () => {
    const handleCloseMobile = vi.fn();
    render(
      <MemoryRouter>
        <Sidebar
          sections={SECTIONS}
          activeSection="investigate"
          onSelectSection={vi.fn()}
          isCollapsed={false}
          onToggleCollapse={vi.fn()}
          isMobileOpen={true}
          onCloseMobile={handleCloseMobile}
        />
      </MemoryRouter>
    );

    const closeBtn = screen.getByRole('button', { name: /Close navigation menu/i });
    fireEvent.click(closeBtn);
    expect(handleCloseMobile).toHaveBeenCalledTimes(1);
  });

  it('closes mobile drawer when Escape key is pressed', () => {
    const handleCloseMobile = vi.fn();
    render(
      <MemoryRouter>
        <Sidebar
          sections={SECTIONS}
          activeSection="investigate"
          onSelectSection={vi.fn()}
          isCollapsed={false}
          onToggleCollapse={vi.fn()}
          isMobileOpen={true}
          onCloseMobile={handleCloseMobile}
        />
      </MemoryRouter>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleCloseMobile).toHaveBeenCalledTimes(1);
  });

  it('displays active station context widget when a location is selected', () => {
    const mockLocation = {
      id: 8118,
      name: 'Anand Vihar, Delhi - DPCC',
      locality: 'Delhi',
      country_code: 'IN',
      country_name: 'India',
      provider_name: 'OpenAQ v3',
      is_monitor: true,
      is_mobile: false,
      available_parameters: ['pm25'],
      is_stale: false,
      timezone: 'Asia/Kolkata',
      instruments: [],
      licenses: [],
      sensors: [],
    };

    render(
      <MemoryRouter>
        <Sidebar
          sections={SECTIONS}
          activeSection="investigate"
          onSelectSection={vi.fn()}
          isCollapsed={false}
          onToggleCollapse={vi.fn()}
          isMobileOpen={false}
          onCloseMobile={vi.fn()}
          selectedLocation={mockLocation}
          selectedParameter="pm25"
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Active Station')).toBeInTheDocument();
    expect(screen.getByText(/#8118 · Anand Vihar, Delhi - DPCC/i)).toBeInTheDocument();
    expect(screen.getByText('PM2.5')).toBeInTheDocument();
  });
});
