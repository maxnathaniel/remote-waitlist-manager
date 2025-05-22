import { render, screen } from '@testing-library/react';

import { PartyStatusDisplay } from './PartyStatusDisplay';
import { PartyStatus } from '../../types';

describe('PartyStatusDisplay Component', () => {
  const baseParty = {
    id: 'p1',
    name: 'Alice',
    party_size: 2,
    client_id: 'client-1',
    status: PartyStatus.queued,
    joined_at: new Date().toISOString(),
    ready_at: null,
    checked_in_at: null,
    service_ends_at: null,
  };

  const mockGetPosition = jest.fn().mockReturnValue(3);
  const mockCheckIn = jest.fn();

  it('displays queue message and position for queued party', () => {
    render(
      <PartyStatusDisplay
        availableSeats={5}
        party={{ ...baseParty, status: PartyStatus.queued }}
        getQueuePosition={mockGetPosition}
        onCheckIn={mockCheckIn}
      />,
    );

    expect(screen.getByText(/you are now in the queue/i)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('displays check-in button when party is ready and seats are available', () => {
    render(
      <PartyStatusDisplay
        availableSeats={5}
        party={{ ...baseParty, status: PartyStatus.ready_to_checkin }}
        getQueuePosition={mockGetPosition}
        onCheckIn={mockCheckIn}
      />,
    );

    expect(screen.getByText(/your table is ready/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check in/i })).toBeInTheDocument();
  });

  it('displays seated message', () => {
    render(
      <PartyStatusDisplay
        availableSeats={5}
        party={{ ...baseParty, status: PartyStatus.seated }}
        getQueuePosition={mockGetPosition}
        onCheckIn={mockCheckIn}
      />,
    );

    expect(screen.getByText(/you are now seated/i)).toBeInTheDocument();
    expect(screen.getByText(/Bon appétit—but make it fabulous/i)).toBeInTheDocument();
  });

  it('displays completed message', () => {
    render(
      <PartyStatusDisplay
        availableSeats={5}
        party={{ ...baseParty, status: PartyStatus.completed }}
        getQueuePosition={mockGetPosition}
        onCheckIn={mockCheckIn}
      />,
    );

    expect(screen.getByText(/your service has completed/i)).toBeInTheDocument();
  });

  it('returns null when party is null', () => {
    const { container } = render(
      <PartyStatusDisplay availableSeats={5} party={null} getQueuePosition={mockGetPosition} onCheckIn={mockCheckIn} />,
    );

    expect(container.firstChild).toBeNull();
  });
});
