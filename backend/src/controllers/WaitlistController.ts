import { Application, Request, Response } from "express";

import { WaitlistService } from "../services/WaitlistService";
import { RESTAURANT_CAPACITY } from "../config";

export const WaitlistController = (
  app: Application,
  waitlistService: WaitlistService
) => {
  app.post("/api/waitlist", async (req: Request, res: Response) => {
    const { name, partySize, clientId } = req.body;

    if (partySize > RESTAURANT_CAPACITY) {
      res.status(400).json({
        message: `Party size cannot exceed ${RESTAURANT_CAPACITY}.`,
      });
      return;
    }

    if (
      !name ||
      !partySize ||
      typeof partySize !== "number" ||
      partySize <= 0 ||
      !clientId ||
      typeof clientId !== "string"
    ) {
      res.status(400).json({
        message: "Name, valid party size, and a valid client ID are required.",
      });
      return;
    }

    try {
      const { partyId, status, message } = await waitlistService.joinParty(
        name,
        partySize,
        clientId
      );
      res.status(201).json({ message, partyId, status });
    } catch (err) {
      console.error("Error in joining Waitlist:", err);
      res.status(500).json({ message: "Internal server error." });
    }
  });

  app.get("/api/waitlist/:partyId", async (req: Request, res: Response) => {
    const { partyId } = req.params;
    try {
      const party = await waitlistService.getPartyStatus(partyId);
      if (!party) {
        res.status(404).json({ message: "Party not found." });
        return;
      }
      res.status(200).json(party);
    } catch (err) {
      console.error("Error in retrieving Waitlist:", err);
      res.status(500).json({ message: "Internal server error." });
    }
  });
};
