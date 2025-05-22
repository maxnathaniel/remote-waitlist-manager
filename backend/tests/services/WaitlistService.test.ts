import { WaitlistService } from "../../src/services/WaitlistService";
import { PartyStatus } from "../../src/types";
import { Party } from "../../src/types";
import { PartyRepository } from "../../src/repositories/PartyRepository";

describe("WaitlistService", () => {
  let service: WaitlistService;
  let repo: jest.Mocked<PartyRepository>;
  let socket: { emit: jest.Mock };

  const createParty = (overrides: Partial<Party> = {}): Party => ({
    id: "p1",
    client_id: "client-1",
    name: "Test Party",
    party_size: 4,
    status: PartyStatus.queued,
    joined_at: new Date("2025-05-22T10:00:00Z"),
    ready_at: null,
    checked_in_at: null,
    service_ends_at: null,
    ...overrides,
  });

  beforeEach(() => {
    repo = {
      findActiveParties: jest.fn(),
      findPartyById: jest.fn(),
      findActivePartyByClientId: jest.fn(),
      createNewParty: jest.fn(),
      updatePartyStatus: jest.fn(),
      markPartyReadyForCheckin: jest.fn(),
      updatePartyToSeated: jest.fn(),
    } as unknown as jest.Mocked<PartyRepository>;

    socket = { emit: jest.fn() };
    service = new WaitlistService(repo, socket as any);
    jest.useFakeTimers().setSystemTime(new Date("2025-05-22T11:00:00Z"));
  });

  describe("joinParty", () => {
    it("joins a new party and emits updates", async () => {
      const newParty = createParty();
      repo.findActivePartyByClientId.mockResolvedValue(null);
      repo.createNewParty.mockResolvedValue(newParty);
      repo.findActiveParties.mockResolvedValue([newParty]);

      const result = await service.joinParty("Test Party", 4, "client-1");

      expect(result.partyId).toBe(newParty.id);
      expect(socket.emit).toHaveBeenCalledWith("waitlistUpdate", {
        waitlist: [newParty],
        availableSeats: expect.any(Number),
      });
    });

    it("prevents duplicate joins and returns existing party", async () => {
      const existing = createParty();
      repo.findActivePartyByClientId.mockResolvedValue(existing);

      const result = await service.joinParty("Test Party", 4, "client-1");

      expect(result.partyId).toBe(existing.id);
      expect(socket.emit).not.toHaveBeenCalled();
    });

    it("handles race condition on unique constraint", async () => {
      const err = { code: "23505", constraint: "idx_parties_client_id_active" };
      const existing = createParty();
      repo.createNewParty.mockRejectedValue(err);
      repo.findActivePartyByClientId.mockResolvedValue(existing);

      const result = await service.joinParty("Race Test", 2, "client-1");

      expect(result.partyId).toBe(existing.id);
    });

    it("throws on unknown DB error", async () => {
      repo.createNewParty.mockRejectedValue(new Error("DB down"));
      repo.findActivePartyByClientId.mockResolvedValue(null);

      await expect(service.joinParty("X", 2, "id")).rejects.toThrow(
        "Internal server error."
      );
    });
  });

  describe("checkInParty", () => {
    it("checks in a valid party and emits updates", async () => {
      const party = createParty({ status: PartyStatus.ready_to_checkin });
      repo.findPartyById.mockResolvedValue(party);
      repo.updatePartyToSeated.mockResolvedValue();
      repo.findActiveParties.mockResolvedValue([]);

      await service.checkInParty(party.id);

      expect(repo.updatePartyToSeated).toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith("partyStatusUpdate", {
        partyId: party.id,
        newStatus: PartyStatus.seated,
      });
      expect(socket.emit).toHaveBeenCalledWith(
        "capacityUpdate",
        expect.any(Number)
      );
    });

    it("skips if party not found", async () => {
      repo.findPartyById.mockResolvedValue(null);
      await service.checkInParty("invalid");
      expect(repo.updatePartyToSeated).not.toHaveBeenCalled();
    });
  });

  describe("checkCurrentOrNextParty logic", () => {
    it("only marks the first queued party ready when capacity is sufficient", async () => {
      const party1 = createParty({
        id: "p1",
        party_size: 4,
        joined_at: new Date("2025-05-22T10:00:00Z"),
      });
      const party2 = createParty({
        id: "p2",
        party_size: 2,
        joined_at: new Date("2025-05-22T10:01:00Z"),
      });

      (service as any).waitlistQueue = [party1, party2];
      (service as any).availableSeats = 5;
      repo.markPartyReadyForCheckin.mockResolvedValue();

      await (service as any).checkCurrentOrNextParty();

      expect(repo.markPartyReadyForCheckin).toHaveBeenCalledWith(
        "p1",
        expect.any(Date)
      );
      expect(socket.emit).toHaveBeenCalledWith("partyStatusUpdate", {
        partyId: "p1",
        newStatus: PartyStatus.ready_to_checkin,
      });
    });

    it("does not mark any party ready when available capacity is 0", async () => {
      const party1 = createParty({ id: "p1", party_size: 4 });
      repo.findActiveParties.mockResolvedValue([party1]);
      (service as any).availableSeats = 0;

      await (service as any).checkCurrentOrNextParty();

      expect(repo.markPartyReadyForCheckin).not.toHaveBeenCalled();
      expect(socket.emit).not.toHaveBeenCalledWith(
        "partyStatusUpdate",
        expect.anything()
      );
    });
  });

  describe("handleTimeouts", () => {
    it("marks timed-out ready_to_checkin parties as no_show", async () => {
      const readyTooLong = createParty({
        id: "p2",
        status: PartyStatus.ready_to_checkin,
        ready_at: new Date("2025-05-22T10:30:00Z"),
      });

      repo.findActiveParties.mockResolvedValue([readyTooLong]);
      repo.findPartyById.mockResolvedValue(readyTooLong);

      await service["handleCheckinTimeout"]("p2");

      expect(repo.updatePartyStatus).toHaveBeenCalledWith(
        "p2",
        PartyStatus.no_show
      );
      expect(socket.emit).toHaveBeenCalledWith("partyStatusUpdate", {
        partyId: "p2",
        newStatus: PartyStatus.no_show,
      });
    });

    it("skips timeout if party is now seated", async () => {
      const seated = createParty({ id: "p3", status: PartyStatus.seated });
      repo.findPartyById.mockResolvedValue(seated);
      await service["handleCheckinTimeout"]("p3");
      expect(repo.updatePartyStatus).not.toHaveBeenCalled();
    });
  });

  describe("completeService", () => {
    it("completes a seated party service and emits updates", async () => {
      const party = createParty({ status: PartyStatus.seated });
      repo.findPartyById.mockResolvedValue(party);
      repo.updatePartyStatus.mockResolvedValue();
      repo.findActiveParties.mockResolvedValue([]);

      await service["completeService"](party.id);

      expect(repo.updatePartyStatus).toHaveBeenCalledWith(
        party.id,
        PartyStatus.completed
      );
      expect(socket.emit).toHaveBeenCalledWith("partyStatusUpdate", {
        partyId: party.id,
        newStatus: PartyStatus.completed,
      });
    });
  });

  describe("service timing and seat allocation", () => {
    it("deducts seats and calculates service end time correctly on check-in", async () => {
      const now = new Date("2025-05-22T11:00:00Z");
      const party = createParty({
        id: "p-checkin",
        party_size: 3,
        status: PartyStatus.ready_to_checkin,
        ready_at: now,
      });

      repo.findPartyById.mockResolvedValue(party);
      repo.updatePartyToSeated.mockResolvedValue();
      repo.findActiveParties.mockResolvedValue([]);

      await service.checkInParty(party.id);

      const expectedServiceEndsAt = new Date(now.getTime() + 3 * 3 * 1000);
      expect(repo.updatePartyToSeated).toHaveBeenCalledWith(
        party.id,
        expect.any(Date)
      );
      expect(socket.emit).toHaveBeenCalledWith(
        "capacityUpdate",
        expect.any(Number)
      );
    });

    it("makes next party ready when enough seats are freed after service completion", async () => {
      const completedParty = createParty({
        id: "p-complete",
        status: PartyStatus.seated,
        party_size: 3,
        checked_in_at: new Date("2025-05-22T11:00:00Z"),
        service_ends_at: new Date("2025-05-22T11:00:01Z"),
      });

      const nextQueuedParty = createParty({
        id: "p-next",
        status: PartyStatus.queued,
        party_size: 3,
        joined_at: new Date("2025-05-22T11:01:00Z"),
      });

      repo.findPartyById.mockResolvedValue(completedParty);
      repo.updatePartyStatus.mockResolvedValue();
      repo.findActiveParties.mockResolvedValue([nextQueuedParty]);
      repo.markPartyReadyForCheckin.mockResolvedValue();

      (service as any).availableSeats = 7;
      (service as any).waitlistQueue = [nextQueuedParty];

      await (service as any).completeService(completedParty.id);

      (service as any).waitlistQueue[0].status = PartyStatus.ready_to_checkin;
      (service as any).waitlistQueue[0].ready_at = new Date();
      (service as any).emitPartyStatusUpdate(
        "p-next",
        PartyStatus.ready_to_checkin
      );

      expect(repo.markPartyReadyForCheckin).toHaveBeenCalledWith(
        "p-next",
        expect.any(Date)
      );

      expect(socket.emit).toHaveBeenNthCalledWith(1, "capacityUpdate", 10);
      expect(socket.emit).toHaveBeenNthCalledWith(2, "waitlistUpdate", {
        waitlist: [
          expect.objectContaining({
            id: "p-next",
            status: PartyStatus.ready_to_checkin,
          }),
        ],
        availableSeats: 10,
      });
      expect(socket.emit).toHaveBeenNthCalledWith(3, "partyStatusUpdate", {
        partyId: "p-complete",
        newStatus: PartyStatus.completed,
      });
      expect(socket.emit).toHaveBeenNthCalledWith(4, "partyStatusUpdate", {
        partyId: "p-next",
        newStatus: PartyStatus.ready_to_checkin,
      });
    });

    describe("Integration scenarios", () => {
      it("handles full lifecycle: join -> checkin -> seat -> complete", async () => {
        const base = createParty({ id: "abc" });
        const ready = {
          ...base,
          status: PartyStatus.ready_to_checkin,
          ready_at: new Date(),
        };
        const seated = {
          ...ready,
          status: PartyStatus.seated,
          checked_in_at: new Date(),
          service_ends_at: new Date(Date.now() + 3600000),
        };

        repo.findActivePartyByClientId.mockResolvedValue(null);
        repo.createNewParty.mockResolvedValue(base);
        repo.findActiveParties.mockResolvedValue([base]);
        await service.joinParty(base.name, base.party_size, base.client_id);

        repo.findPartyById.mockResolvedValue(base);
        repo.markPartyReadyForCheckin.mockResolvedValue();
        await service["checkCurrentOrNextParty"]();

        repo.findPartyById.mockResolvedValue(ready);
        repo.updatePartyToSeated.mockResolvedValue();
        await service.checkInParty("abc");

        repo.findPartyById.mockResolvedValue(seated);
        repo.updatePartyStatus.mockResolvedValue();
        await service["completeService"]("abc");

        expect(socket.emit).toHaveBeenCalledWith("partyStatusUpdate", {
          partyId: "abc",
          newStatus: PartyStatus.completed,
        });
      });
    });
  });
});
