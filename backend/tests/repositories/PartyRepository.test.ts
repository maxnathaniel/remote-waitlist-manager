import { Pool, QueryResult, QueryResultRow } from "pg";

import { PartyRepository } from "../../src/repositories/PartyRepository";
import { Party, PartyStatus } from "../../src/types";

const createMockQueryResult = <T extends QueryResultRow>(
  rows: T[],
  command: string = "SELECT",
  rowCount?: number
): QueryResult<T> => ({
  rows,
  command,
  rowCount: rowCount !== undefined ? rowCount : rows.length,
  oid: 0,
  fields: [],
});

const mockDbPartyRow = {
  id: "party-123",
  name: "John Doe Party",
  party_size: 4,
  client_id: "client-abc-123",
  status: "queued",
  joined_at: "2025-05-21T10:00:00.000Z",
  ready_at: null,
  checked_in_at: null,
  service_ends_at: null,
};

const expectedMappedParty: Party = {
  ...mockDbPartyRow,
  joined_at: new Date(mockDbPartyRow.joined_at),
  ready_at: null,
  checked_in_at: null,
  service_ends_at: null,
  status: PartyStatus.queued,
};

const mockPool = {
  query: jest.fn<Promise<QueryResult<any>>, [string, any[] | undefined]>(),
} as unknown as Pool;

describe("PartyRepository", () => {
  let repository: PartyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PartyRepository(mockPool);
  });

  describe("findActiveParties", () => {
    it("should return a list of active parties mapped correctly", async () => {
      const mockRows = [
        mockDbPartyRow,
        {
          ...mockDbPartyRow,
          id: "party-124",
          name: "Jane Doe Party",
          status: PartyStatus.ready_to_checkin,
        },
      ];
      (mockPool.query as jest.Mock).mockResolvedValueOnce(
        createMockQueryResult(mockRows)
      );

      const parties = await repository.findActiveParties();

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM parties WHERE status IN ($1, $2, $3) ORDER BY joined_at ASC",
        [PartyStatus.queued, PartyStatus.ready_to_checkin, PartyStatus.seated]
      );
      expect(parties).toHaveLength(2);
      expect(parties[0]).toEqual(expectedMappedParty);
      expect(parties[1].status).toBe(PartyStatus.ready_to_checkin);
      expect(parties[0].joined_at).toBeInstanceOf(Date);
    });

    it("should return an empty array if no active parties are found", async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce(
        createMockQueryResult([])
      );

      const parties = await repository.findActiveParties();

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(parties).toEqual([]);
    });
  });

  describe("findPartyById", () => {
    it("should return a party when found by ID", async () => {
      const partyId = "party-123";
      (mockPool.query as jest.Mock).mockResolvedValueOnce(
        createMockQueryResult([mockDbPartyRow])
      );

      const party = await repository.findPartyById(partyId);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM parties WHERE id = $1",
        [partyId]
      );
      expect(party).toEqual(expectedMappedParty);
    });

    it("should return null when party is not found by ID", async () => {
      const partyId = "non-existent-id";
      (mockPool.query as jest.Mock).mockResolvedValueOnce(
        createMockQueryResult([])
      );

      const party = await repository.findPartyById(partyId);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(party).toBeNull();
    });
  });

  describe("findActivePartyByClientId", () => {
    it("should return an active party when found by client ID", async () => {
      const clientId = "client-abc-123";
      (mockPool.query as jest.Mock).mockResolvedValueOnce(
        createMockQueryResult([mockDbPartyRow])
      );

      const party = await repository.findActivePartyByClientId(clientId);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM parties WHERE client_id = $1 AND status IN ($2, $3, $4)",
        [
          clientId,
          PartyStatus.queued,
          PartyStatus.ready_to_checkin,
          PartyStatus.seated,
        ]
      );
      expect(party).toEqual(expectedMappedParty);
    });

    it("should return null when no active party is found by client ID", async () => {
      const clientId = "non-existent-client";
      (mockPool.query as jest.Mock).mockResolvedValueOnce(
        createMockQueryResult([])
      );

      const party = await repository.findActivePartyByClientId(clientId);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(party).toBeNull();
    });
  });

  describe("createNewParty", () => {
    it("should insert a new party and return the mapped result", async () => {
      const name = "New Party";
      const partySize = 2;
      const clientId = "new-client-id";
      const mockInsertedRow = {
        ...mockDbPartyRow,
        id: "new-party-id",
        name,
        party_size: partySize,
        client_id: clientId,
        joined_at: new Date().toISOString(),
        status: PartyStatus.queued,
      };
      const expectedNewParty = {
        ...mockInsertedRow,
        joined_at: new Date(mockInsertedRow.joined_at),
        ready_at: null,
        checked_in_at: null,
        service_ends_at: null,
        status: PartyStatus.queued,
      };
      (mockPool.query as jest.Mock).mockResolvedValueOnce(
        createMockQueryResult([mockInsertedRow], "INSERT")
      );

      const newParty = await repository.createNewParty(
        name,
        partySize,
        clientId
      );

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        "INSERT INTO parties (name, party_size, status, client_id) VALUES ($1, $2, $3, $4) RETURNING *",
        [name, partySize, PartyStatus.queued, clientId]
      );
      expect(newParty).toEqual(expectedNewParty);
    });
  });

  describe("updatePartyStatus", () => {
    it("should update the status of a party", async () => {
      const partyId = "party-to-update";
      const newStatus = PartyStatus.seated;
      (mockPool.query as jest.Mock).mockResolvedValueOnce(
        createMockQueryResult([], "UPDATE", 1)
      );

      await repository.updatePartyStatus(partyId, newStatus);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        "UPDATE parties SET status = $1 WHERE id = $2",
        [newStatus, partyId]
      );
    });
  });

  describe("markPartyReadyForCheckin", () => {
    it("should update party status and ready_at timestamp", async () => {
      const partyId = "party-to-ready";
      const readyAtDate = new Date("2025-05-21T15:30:00.000Z");
      (mockPool.query as jest.Mock).mockResolvedValueOnce(
        createMockQueryResult([], "UPDATE", 1)
      );

      await repository.markPartyReadyForCheckin(partyId, readyAtDate);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        "UPDATE parties SET status = $1, ready_at = $2 WHERE id = $3",
        [PartyStatus.ready_to_checkin, readyAtDate, partyId]
      );
    });
  });

  describe("updatePartyToSeated", () => {
    it("should update party to seated status with checked_in_at and service_ends_at", async () => {
      const partyId = "party-to-seat";
      const serviceEndsAtDate = new Date("2025-05-21T18:00:00.000Z");

      const dateSpy = jest
        .spyOn(global, "Date")
        .mockImplementation(() => new Date("2025-05-21T17:00:00.000Z") as any);

      (mockPool.query as jest.Mock).mockResolvedValueOnce(
        createMockQueryResult([], "UPDATE", 1)
      );

      await repository.updatePartyToSeated(partyId, serviceEndsAtDate);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        "UPDATE parties SET status = $1, checked_in_at = NOW(), service_ends_at = $2 WHERE id = $3",
        [PartyStatus.seated, serviceEndsAtDate, partyId]
      );

      dateSpy.mockRestore();
    });
  });
});
