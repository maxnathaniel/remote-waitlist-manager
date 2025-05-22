export interface Party {
  id: string; // Backend generated UUID for party
  client_id: string; // Client generated UUID for idempotency
  name: string;
  party_size: number;
  status: PartyStatus;
  joined_at: Date;
  ready_at: Date | null;
  checked_in_at: Date | null;
  service_ends_at: Date | null;
}

export enum PartyStatus {
  queued = "queued",
  ready_to_checkin = "ready_to_checkin",
  seated = "seated",
  completed = "completed",
  no_show = "no_show",
  cancelled = "cancelled",
}
