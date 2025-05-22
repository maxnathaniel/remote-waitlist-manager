import request from "supertest";
import express, { Application } from "express";
import bodyParser from "body-parser";

import { WaitlistController } from "../../src/controllers/WaitlistController";
import { WaitlistService } from "../../src/services/WaitlistService";
import { PartyStatus } from "../../src/types";

const mockWaitlistService: jest.Mocked<WaitlistService> = {
  joinParty: jest.fn(),
  getPartyStatus: jest.fn(),
} as any;

const createTestApp = (): Application => {
  const app = express();
  app.use(bodyParser.json());
  WaitlistController(app, mockWaitlistService);
  return app;
};

describe("WaitlistController", () => {
  let app: Application;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  describe("POST /api/waitlist", () => {
    it("returns 400 if party size exceeds capacity", async () => {
      const response = await request(app).post("/api/waitlist").send({
        name: "Test Party",
        partySize: 20,
        clientId: "abc123",
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Party size cannot exceed 10.");
    });

    it("returns 400 if required fields are missing or invalid", async () => {
      const response = await request(app).post("/api/waitlist").send({
        name: "",
        partySize: "four",
        clientId: 123,
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Name, valid party size, and a valid client ID are required."
      );
    });

    it("returns 201 and party data on success", async () => {
      mockWaitlistService.joinParty.mockResolvedValue({
        partyId: "xyz123",
        status: PartyStatus.queued,
        message: "Successfully joined waitlist!",
      });

      const response = await request(app).post("/api/waitlist").send({
        name: "Jane",
        partySize: 2,
        clientId: "client-xyz",
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: "Successfully joined waitlist!",
        partyId: "xyz123",
        status: PartyStatus.queued,
      });
    });

    it("returns 500 on service error", async () => {
      mockWaitlistService.joinParty.mockRejectedValue(new Error("DB fail"));

      const response = await request(app).post("/api/waitlist").send({
        name: "Jane",
        partySize: 2,
        clientId: "client-xyz",
      });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe("Internal server error.");
    });
  });

  describe("GET /api/waitlist/:partyId", () => {
    it("returns 404 if party is not found", async () => {
      mockWaitlistService.getPartyStatus.mockResolvedValue(null);

      const response = await request(app).get("/api/waitlist/nonexistent");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Party not found.");
    });

    it("returns 200 and party info if found", async () => {
      mockWaitlistService.getPartyStatus.mockResolvedValue({
        id: "p1",
        name: "Test Party",
        party_size: 2,
        client_id: "client-xyz",
        status: PartyStatus.queued,
        joined_at: new Date(),
        ready_at: null,
        checked_in_at: null,
        service_ends_at: null,
      });

      const response = await request(app).get("/api/waitlist/p1");

      expect(response.status).toBe(200);
      expect(response.body.id).toBe("p1");
      expect(response.body.name).toBe("Test Party");
    });

    it("returns 500 on service error", async () => {
      mockWaitlistService.getPartyStatus.mockRejectedValue(
        new Error("Failure")
      );

      const response = await request(app).get("/api/waitlist/p1");

      expect(response.status).toBe(500);
      expect(response.body.message).toBe("Internal server error.");
    });
  });
});
