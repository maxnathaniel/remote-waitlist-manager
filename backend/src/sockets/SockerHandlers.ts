import { Server as SocketIOServer, Socket } from "socket.io";

import { WaitlistService } from "../services/WaitlistService";

export function SocketHandlers(
  io: SocketIOServer,
  waitlistService: WaitlistService
): void {
  io.on("connection", (socket: Socket) => {
    console.log("A user connected:", socket.id);

    socket.emit("initialState", {
      waitlist: waitlistService.getWaitlist(),
      availableSeats: waitlistService.getAvailableSeats(),
    });

    socket.on("checkIn", async ({ partyId }: { partyId: string }) => {
      await waitlistService.checkInParty(partyId);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
}
