import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import type { NavSection, SectionId } from '../types';

const mockSections: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    shortDescription: 'Project scope & architecture',
    statusBadge: 'Active',
    statusType: 'active',
  },
  {
    id: 'investigate',
    label: 'Station Telemetry',
    shortDescription: 'Indian monitoring stations & measurements',
    statusBadge: 'Active',
    statusType: 'active',
  },
  {
    id: 'anomalies',
    label: 'Pollution Intelligence',
    shortDescription: 'Statistical anomaly detection & baseline screening',
    statusBadge: 'Milestone 6',
    statusType: 'active',
  },
  {
    id: 'evidence',
    label: 'Evidence & Data Quality',
    shortDescription: 'Coverage, freshness & integrity bounds',
    statusBadge: 'Verified',
    statusType: 'active',
  },
  {
    id: 'reports',
    label: 'Environmental Action Plan',
    shortDescription: 'Facility mitigation dossier & emission abatement',
    statusBadge: 'Dossier',
    statusType: 'active',
  },
];

describe('Sidebar Component', () => {
  it('renders all primary navigation sections with accessible tab roles and badges', () => {
    const handleSelect = vi.fn();
    render(
      <Sidebar
        sections={mockSections}
        activeSection="overview"
        onSelectSection={handleSelect}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        isMobileOpen={false}
        onCloseMobile={vi.fn()}
      />
    );

    expect(screen.getByRole('tab', { name: /Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Investigate/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Pollution Intelligence/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Evidence & Data Quality/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Investigation Reports/i })).toBeInTheDocument();

    // Verify badges
    expect(screen.getByText('Milestone 6')).toBeInTheDocument();
    expect(screen.getByText('Dossier')).toBeInTheDocument();
  });

  it('triggers onSelectSection when a navigation tab is clicked', () => {
    const handleSelect = vi.fn();
    const handleCloseMobile = vi.fn();

    render(
      <Sidebar
        sections={mockSections}
        activeSection="overview"
        onSelectSection={handleSelect}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        isMobileOpen={false}
        onCloseMobile={handleCloseMobile}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Pollution Intelligence/i }));
    expect(handleSelect).toHaveBeenCalledWith('anomalies');
    expect(handleCloseMobile).toHaveBeenCalledTimes(1);
  });

  it('handles desktop collapse toggle and hides labels when collapsed', () => {
    const handleToggleCollapse = vi.fn();
    const { rerender } = render(
      <Sidebar
        sections={mockSections}
        activeSection="overview"
        onSelectSection={vi.fn()}
        isCollapsed={false}
        onToggleCollapse={handleToggleCollapse}
        isMobileOpen={false}
        onCloseMobile={vi.fn()}
      />
    );

    const collapseBtn = screen.getByRole('button', { name: /Collapse sidebar/i });
    fireEvent.click(collapseBtn);
    expect(handleToggleCollapse).toHaveBeenCalledTimes(1);

    // Rerender collapsed
    rerender(
      <Sidebar
        sections={mockSections}
        activeSection="overview"
        onSelectSection={vi.fn()}
        isCollapsed={true}
        onToggleCollapse={handleToggleCollapse}
        isMobileOpen={false}
        onCloseMobile={vi.fn()}
      />
    );

    // When collapsed, descriptions and full brand text are hidden
    expect(screen.queryByText('Project scope & architecture')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Expand sidebar/i })).toBeInTheDocument();
  });

  it('renders mobile drawer with backdrop when isMobileOpen is true and handles close', () => {
    const handleCloseMobile = vi.fn();
    render(
      <Sidebar
        sections={mockSections}
        activeSection="investigate"
        onSelectSection={vi.fn()}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        isMobileOpen={true}
        onCloseMobile={handleCloseMobile}
      />
    );

    // Mobile close button
    const closeBtn = screen.getByRole('button', { name: /Close navigation menu/i });
    fireEvent.click(closeBtn);
    expect(handleCloseMobile).toHaveBeenCalledTimes(1);
  });

  it('closes mobile drawer when Escape key is pressed', () => {
    const handleCloseMobile = vi.fn();
    render(
      <Sidebar
        sections={mockSections}
        activeSection="investigate"
        onSelectSection={vi.fn()}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        isMobileOpen={true}
        onCloseMobile={handleCloseMobile}
      />
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
      <Sidebar
        sections={mockSections}
        activeSection="investigate"
        onSelectSection={vi.fn()}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        isMobileOpen={false}
        onCloseMobile={vi.fn()}
        selectedLocation={mockLocation}
        selectedParameter="pm25"
      />
    );

    expect(screen.getByText('Active Station')).toBeInTheDocument();
    expect(screen.getByText(/Node #8118 · Anand Vihar, Delhi - DPCC/i)).toBeInTheDocument();
    expect(screen.getByText('PM2.5')).toBeInTheDocument();
  });
});
