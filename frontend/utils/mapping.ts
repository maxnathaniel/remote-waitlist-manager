import { PartyStatus } from "../types";

export const partyStatusToLabelMapping = (status: PartyStatus) => {
  switch (status) {
    case PartyStatus.queued:
      return "Queued";
    case PartyStatus.cancelled:
      return "Cancelled";
    case PartyStatus.no_show:
      return "No Show";
    case PartyStatus.completed:
      return "Completed";
    case PartyStatus.ready_to_checkin:
      return "Ready to Check In";
    case PartyStatus.seated:
      return "Seated";
    default:
      return "Unknown";
  }
};
