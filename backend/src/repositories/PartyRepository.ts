import { Pool, QueryResult } from "pg";

import { Party, PartyStatus } from "../types";

function mapRowToParty(row: any): Party {
  return {
    ...row,
    joined_at: new Date(row.joined_at),
    ready_at: row.ready_at ? new Date(row.ready_at) : null,
    checked_in_at: row.checked_in_at ? new Date(row.checked_in_at) : null,
    service_ends_at: row.service_ends_at ? new Date(row.service_ends_at) : null,
  };
}

export class PartyRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  public async findActiveParties(): Promise<Party[]> {
    const res: QueryResult<Party> = await this.pool.query(
      "SELECT * FROM parties WHERE status IN ($1, $2, $3) ORDER BY joined_at ASC",
      [PartyStatus.queued, PartyStatus.ready_to_checkin, PartyStatus.seated]
    );
    return res.rows.map(mapRowToParty);
  }

  public async findPartyById(partyId: string): Promise<Party | null> {
    const res: QueryResult<Party> = await this.pool.query(
      "SELECT * FROM parties WHERE id = $1",
      [partyId]
    );
    return res.rows.length === 0 ? null : mapRowToParty(res.rows[0]);
  }

  public async findActivePartyByClientId(
    clientId: string
  ): Promise<Party | null> {
    const res: QueryResult<Party> = await this.pool.query(
      "SELECT * FROM parties WHERE client_id = $1 AND status IN ($2, $3, $4)",
      [
        clientId,
        PartyStatus.queued,
        PartyStatus.ready_to_checkin,
        PartyStatus.seated,
      ]
    );
    return res.rows.length > 0 ? mapRowToParty(res.rows[0]) : null;
  }

  public async createNewParty(
    name: string,
    partySize: number,
    clientId: string
  ): Promise<Party> {
    const insertRes: QueryResult<Party> = await this.pool.query(
      "INSERT INTO parties (name, party_size, status, client_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, partySize, PartyStatus.queued, clientId]
    );
    return mapRowToParty(insertRes.rows[0]);
  }

  public async updatePartyStatus(
    partyId: string,
    status: PartyStatus
  ): Promise<void> {
    await this.pool.query("UPDATE parties SET status = $1 WHERE id = $2", [
      status,
      partyId,
    ]);
  }

  public async markPartyReadyForCheckin(
    partyId: string,
    readyAt: Date
  ): Promise<void> {
    await this.pool.query(
      "UPDATE parties SET status = $1, ready_at = $2 WHERE id = $3",
      [PartyStatus.ready_to_checkin, readyAt, partyId]
    );
  }

  public async updatePartyToSeated(
    partyId: string,
    serviceEndsAt: Date
  ): Promise<void> {
    await this.pool.query(
      "UPDATE parties SET status = $1, checked_in_at = NOW(), service_ends_at = $2 WHERE id = $3",
      [PartyStatus.seated, serviceEndsAt, partyId]
    );
  }
}
