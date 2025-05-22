export interface Party {
  id: string; // Backend generated UUID
  client_id: string; // Client generated UUID
  name: string;
  party_size: number;
  status: PartyStatus;
  joined_at: string;
  ready_at: string | null;
  checked_in_at: string | null;
  service_ends_at: string | null;
}

export enum PartyStatus {
  queued = 'queued',
  ready_to_checkin = 'ready_to_checkin',
  seated = 'seated',
  completed = 'completed',
  no_show = 'no_show',
  cancelled = 'cancelled',
}

declare global {
  interface Window {
    __INITIAL_DATA__?: {
      waitlist: Party[];
      availableSeats: number;
      currentPartyStatus: Party | null;
    };
  }
}
