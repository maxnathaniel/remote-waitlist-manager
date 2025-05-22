import { Server as SocketIOServer } from "socket.io";

import { PartyRepository } from "../repositories/PartyRepository";
import { PartyStatus, type Party } from "../types";
import {
  RESTAURANT_CAPACITY,
  SERVICE_TIME_PER_PERSON_SECONDS,
  CHECKIN_TIMEOUT_MINUTES,
} from "../config";

function calculateServiceEndTime(partySize: number): Date {
  const serviceDurationMs = partySize * SERVICE_TIME_PER_PERSON_SECONDS * 1000;
  return new Date(Date.now() + serviceDurationMs);
}

function calculateCheckinTimeout(readyAt: Date): number {
  return readyAt.getTime() + CHECKIN_TIMEOUT_MINUTES * 60 * 1000;
}

export class WaitlistService {
  private partyRepository: PartyRepository;
  private io: SocketIOServer;
  private waitlistQueue: Party[] = [];
  private availableSeats: number = RESTAURANT_CAPACITY;

  constructor(partyRepository: PartyRepository, io: SocketIOServer) {
    this.partyRepository = partyRepository;
    this.io = io;
  }

  public getWaitlist(): Party[] {
    return this.waitlistQueue.filter(
      (p) =>
        p.status === PartyStatus.queued ||
        p.status === PartyStatus.ready_to_checkin
    );
  }

  public getAvailableSeats(): number {
    return this.availableSeats;
  }

  public async initialize(): Promise<void> {
    await this.loadInitialState();
    this.checkCurrentOrNextParty();
  }

  private async loadInitialState(): Promise<void> {
    try {
      const activeParties = await this.partyRepository.findActiveParties();
      let initialWaitlist: Party[] = [];
      let occupiedSeats = 0;

      for (const party of activeParties) {
        if (party.status === PartyStatus.seated) {
          occupiedSeats += party.party_size;
          this.scheduleServiceCompletion(party);
        } else if (party.status === PartyStatus.ready_to_checkin) {
          await this.reconcileReadyPartyOnLoad(party, initialWaitlist);
        } else {
          initialWaitlist.push(party);
        }
      }

      this.waitlistQueue = this.sortQueue(initialWaitlist);
      this.availableSeats = RESTAURANT_CAPACITY - occupiedSeats;
      this.logInitialState();
      this.emitWaitlistUpdate();
    } catch (err) {
      console.error("Error loading initial state:", err);
    }
  }

  private scheduleServiceCompletion(party: Party): void {
    if (party.service_ends_at) {
      const timeLeft = party.service_ends_at.getTime() - Date.now();
      if (timeLeft > 0) {
        setTimeout(() => this.completeService(party.id), timeLeft);
        console.log(
          `[ServiceScheduler] Party ${
            party.id
          }: Scheduled service completion in ${Math.ceil(
            timeLeft / 1000
          )}s. Ends at: ${party.service_ends_at.toISOString()}`
        );
      } else {
        console.log(
          `[ServiceScheduler] Party ${party.id}: Service already ended. Completing immediately.`
        );
        this.completeService(party.id);
      }
    } else {
      console.warn(
        `[ServiceScheduler] Party ${party.id} is seated but has no 'service_ends_at' timestamp. Cannot schedule completion.`
      );
    }
  }

  private async reconcileReadyPartyOnLoad(
    party: Party,
    initialWaitlist: Party[]
  ): Promise<void> {
    if (!party.ready_at) {
      console.warn(
        `Party ${party.id} is 'ready_to_checkin' but has no 'ready_at' timestamp. Marking as 'no_show'.`
      );
      await this.partyRepository.updatePartyStatus(
        party.id,
        PartyStatus.no_show
      );
      return;
    }

    const timeoutExpiresAt = calculateCheckinTimeout(party.ready_at);
    if (Date.now() > timeoutExpiresAt) {
      console.log(
        `Server restart: Party ${party.name} (ID: ${party.id}) missed check-in. Marking as 'no_show'.`
      );
      await this.partyRepository.updatePartyStatus(
        party.id,
        PartyStatus.no_show
      );
    } else {
      const timeLeft = timeoutExpiresAt - Date.now();
      setTimeout(() => this.handleCheckinTimeout(party.id), timeLeft);
      console.log(
        `Rescheduled check-in timeout for party ${party.name} (ID: ${
          party.id
        }) in ${Math.ceil(timeLeft / (60 * 1000))} minutes.`
      );
      initialWaitlist.push(party);
    }
  }

  private logInitialState(): void {
    console.log(
      `Initial state loaded: Available seats: ${this.availableSeats}, Queued/Ready parties: ${this.waitlistQueue.length}`
    );
  }

  public async joinParty(
    name: string,
    partySize: number,
    clientId: string
  ): Promise<{ partyId: string; status: Party["status"]; message: string }> {
    try {
      const existingParty =
        await this.partyRepository.findActivePartyByClientId(clientId);
      if (existingParty) {
        console.log(
          `[JoinParty] Idempotent check: Client ${clientId} already has active party ${existingParty.id}.`
        );
        return {
          message: "You are already on the waitlist!",
          partyId: existingParty.id,
          status: existingParty.status,
        };
      }

      const newParty = await this.partyRepository.createNewParty(
        name,
        partySize,
        clientId
      );
      this.addPartyToQueue(newParty);

      if (this.waitlistQueue.length === 1) {
        this.checkCurrentOrNextParty();
      }

      this.emitWaitlistUpdate();
      console.log(
        `[JoinParty] Party ${newParty.id} (${newParty.name}) joined waitlist.`
      );
      return {
        message: "Successfully joined waitlist!",
        partyId: newParty.id,
        status: newParty.status,
      };
    } catch (err: any) {
      return await this.handleJoinPartyError(err, clientId);
    }
  }

  private addPartyToQueue(party: Party): void {
    this.waitlistQueue.push(party);
    this.waitlistQueue = this.sortQueue(this.waitlistQueue);
  }

  private async handleJoinPartyError(
    err: any,
    clientId: string
  ): Promise<{ partyId: string; status: Party["status"]; message: string }> {
    if (
      err.code === "23505" &&
      err.constraint === "idx_parties_client_id_active"
    ) {
      console.warn(
        `[JoinPartyError] Race condition detected for client ${clientId}. Retrying to get existing party.`
      );
      const existingParty =
        await this.partyRepository.findActivePartyByClientId(clientId);
      if (existingParty) {
        return {
          message: "You are already on the waitlist!",
          partyId: existingParty.id,
          status: existingParty.status,
        };
      }
    }
    console.error("[JoinPartyError] Unhandled error joining waitlist:", err);
    throw new Error("Internal server error.");
  }

  public async getPartyStatus(partyId: string): Promise<Party | null> {
    return this.partyRepository.findPartyById(partyId);
  }

  public async checkInParty(partyId: string): Promise<void> {
    console.log(`[CheckInRequest] Attempting check-in for party: ${partyId}`);
    await this.startService(partyId);
  }

  public async checkCurrentOrNextParty(): Promise<void> {
    this.waitlistQueue = this.sortQueue(this.waitlistQueue);
    const nextParty = this.waitlistQueue.find(
      (p) =>
        p.status === PartyStatus.queued && p.party_size <= this.availableSeats
    );

    if (nextParty) {
      console.log(
        `[CheckCurrentOrNextParty] Found next party: ${nextParty.name} (ID: ${nextParty.id}) with size ${nextParty.party_size}.`
      );
      await this.markPartyReadyForCheckin(nextParty);
      this.emitPartyStatusUpdate(nextParty.id, PartyStatus.ready_to_checkin);
      this.emitWaitlistUpdate();
      this.scheduleCheckinTimeout(nextParty);
    } else {
      console.log(
        `[CheckCurrentOrNextParty] No queued parties can be called now. Available seats: ${this.availableSeats}`
      );
    }
  }

  private async markPartyReadyForCheckin(party: Party): Promise<void> {
    const now = new Date();
    await this.partyRepository.markPartyReadyForCheckin(party.id, now);
    const index = this.waitlistQueue.findIndex((p) => p.id === party.id);
    if (index !== -1) {
      this.waitlistQueue[index].status = PartyStatus.ready_to_checkin;
      this.waitlistQueue[index].ready_at = now;
    }
    console.log(
      `[PartyStatus] Party ${party.id} marked as 'ready_to_checkin'.`
    );
  }

  private scheduleCheckinTimeout(party: Party): void {
    const timeoutMs = CHECKIN_TIMEOUT_MINUTES * 60 * 1000;
    setTimeout(() => this.handleCheckinTimeout(party.id), timeoutMs);
    console.log(
      `[TimeoutScheduler] Party ${party.name} (ID: ${party.id}): Scheduled check-in timeout in ${CHECKIN_TIMEOUT_MINUTES} minutes.`
    );
  }

  private async handleCheckinTimeout(partyId: string): Promise<void> {
    try {
      const party = await this.partyRepository.findPartyById(partyId);

      if (!party) {
        console.log(
          `[CheckInTimeout] Party ${partyId} not found during timeout handling. Already processed?`
        );
        return;
      }

      if (party.status === PartyStatus.ready_to_checkin) {
        console.log(
          `[CheckInTimeout] Party ${party.name} (ID: ${party.id}) missed check-in (status was 'ready_to_checkin'). Marking as 'no_show'.`
        );
        await this.partyRepository.updatePartyStatus(
          party.id,
          PartyStatus.no_show
        );
        this.removePartyFromQueue(party.id);
        this.emitPartyStatusUpdate(party.id, PartyStatus.no_show);
        this.emitWaitlistUpdate();
        this.checkCurrentOrNextParty();
      } else {
        console.log(
          `[CheckInTimeout] Party ${party.id} status changed to '${party.status}' before timeout. No action needed.`
        );
      }
    } catch (err) {
      console.error(
        `[CheckInTimeoutError] Error handling check-in timeout for party ${partyId}:`,
        err
      );
    }
  }

  private async startService(partyId: string): Promise<void> {
    console.log(
      `[StartService] Attempting to start service for party ${partyId}.`
    );
    try {
      const party = await this.validatePartyForService(partyId);
      if (!party) {
        console.warn(
          `[StartService] Failed validation for party ${partyId}. Service not started.`
        );
        return;
      }

      this.deductSeats(party.party_size);
      const serviceEndsAt = calculateServiceEndTime(party.party_size);
      await this.partyRepository.updatePartyToSeated(party.id, serviceEndsAt);

      party.service_ends_at = serviceEndsAt;

      this.removePartyFromQueue(party.id);

      this.emitCapacityUpdate();
      this.emitWaitlistUpdate();
      this.emitPartyStatusUpdate(party.id, PartyStatus.seated);

      console.log(
        `[StartService] Party ${party.id} seated. Available seats: ${
          this.availableSeats
        }. Service ends at: ${serviceEndsAt.toISOString()}`
      );
      this.scheduleServiceCompletion(party);
      this.checkCurrentOrNextParty();
    } catch (err) {
      console.error(
        `[StartServiceError] Error starting service for party ${partyId}:`,
        err
      );
    }
  }

  private async validatePartyForService(
    partyId: string
  ): Promise<Party | null> {
    const party = await this.partyRepository.findPartyById(partyId);

    if (!party) {
      console.warn(`[StartServiceValidation] Party ${partyId} not found.`);
      return null;
    }
    if (party.status !== PartyStatus.ready_to_checkin) {
      console.warn(
        `[StartServiceValidation] Party ${partyId} is not 'ready_to_checkin' (current status: ${party.status}).`
      );
      return null;
    }
    if (party.party_size > this.availableSeats) {
      console.warn(
        `[StartServiceValidation] Not enough seats for party ${partyId}. Seats needed: ${party.party_size}, Available: ${this.availableSeats}`
      );
      return null;
    }
    console.log(
      `[StartServiceValidation] Party ${partyId} passed validation. Status: ${party.status}, Size: ${party.party_size}.`
    );
    return party;
  }

  private async completeService(partyId: string): Promise<void> {
    console.log(
      `[CompleteService] Attempting to complete service for party ID: ${partyId}`
    );
    try {
      const party = await this.partyRepository.findPartyById(partyId);
      if (!party) {
        console.warn(
          `[CompletionValidation] Party ${partyId} not found during completion.`
        );
        return;
      }
      if (party.status !== PartyStatus.seated) {
        console.warn(
          `[CompletionValidation] Party ${partyId} is not 'seated' (current status: ${party.status}). Cannot complete service.`
        );
        return;
      }
      console.log(
        `[CompletionValidation] Party ${partyId} passed validation. Status: ${party.status}.`
      );

      this.addSeats(party.party_size);
      await this.partyRepository.updatePartyStatus(
        party.id,
        PartyStatus.completed
      );
      console.log(
        `[DBUpdate] Party ${party.id} status updated to 'completed'. Seats released: ${party.party_size}.`
      );

      this.emitCapacityUpdate();
      this.emitWaitlistUpdate();
      this.emitPartyStatusUpdate(party.id, PartyStatus.completed);
      console.log(`[CompleteService] Emitted updates for party ${party.id}.`);

      console.log(
        `[ServiceCompleted] Service completed for party ${party.name}. Available seats now: ${this.availableSeats}`
      );
      this.checkCurrentOrNextParty();
    } catch (err) {
      console.error(
        `[CompleteServiceError] Error completing service for party ${partyId}:`,
        err
      );
    }
  }

  private deductSeats(count: number): void {
    this.availableSeats -= count;
    console.log(
      `[SeatUpdate] Deducted ${count} seats. Available: ${this.availableSeats}`
    );
  }

  private addSeats(count: number): void {
    this.availableSeats += count;
    console.log(
      `[SeatUpdate] Added ${count} seats. Available: ${this.availableSeats}`
    );
  }

  private removePartyFromQueue(partyId: string): void {
    const originalLength = this.waitlistQueue.length;
    this.waitlistQueue = this.waitlistQueue.filter((p) => p.id !== partyId);
    if (this.waitlistQueue.length < originalLength) {
      console.log(`[QueueUpdate] Party ${partyId} removed from local queue.`);
    } else {
      console.log(
        `[QueueUpdate] Party ${partyId} not found in local queue (already removed?).`
      );
    }
  }

  private sortQueue(queue: Party[]): Party[] {
    return [...queue].sort(
      (a, b) => a.joined_at.getTime() - b.joined_at.getTime()
    );
  }

  private emitWaitlistUpdate(): void {
    this.io.emit("waitlistUpdate", {
      waitlist: this.getWaitlist(),
      availableSeats: this.availableSeats,
    });
    console.log(
      `[SocketEmit] Emitted 'waitlistUpdate'. Waitlist size: ${
        this.getWaitlist().length
      }, Seats: ${this.availableSeats}`
    );
  }

  private emitPartyStatusUpdate(partyId: string, newStatus: PartyStatus): void {
    this.io.emit("partyStatusUpdate", { partyId, newStatus });
    console.log(
      `[SocketEmit] Emitted 'partyStatusUpdate' for ${partyId}: '${newStatus}'.`
    );
  }

  private emitCapacityUpdate(): void {
    this.io.emit("capacityUpdate", this.availableSeats);
    console.log(
      `[SocketEmit] Emitted 'capacityUpdate'. Seats: ${this.availableSeats}`
    );
  }
}
