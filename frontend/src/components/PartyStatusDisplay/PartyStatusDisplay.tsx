import type { FC } from 'react';
import Button from '@mui/material/Button';

import { PartyStatus, type Party } from '../../types';
import './PartyStatusDisplay.css';

interface Props {
  availableSeats: number;
  party: Party | null;
  getQueuePosition: (id: string) => number | null;
  onCheckIn: () => void;
}

export const PartyStatusDisplay: FC<Props> = ({ availableSeats, party, getQueuePosition, onCheckIn }) => {
  if (!party) {
    return null;
  }

  const getPosition = () => {
    return getQueuePosition(party.id) !== null ? getQueuePosition(party.id) : 'Calculating...';
  };

  return (
    <div className="party-status-display">
      {party.status === PartyStatus.queued && <h2>Hey {party.name}, you are now in the queue!</h2>}
      {party.status === PartyStatus.ready_to_checkin && <h2>Hey {party.name}, your table is ready!</h2>}
      {party.status === PartyStatus.seated && <h2>Hey {party.name}, you are now seated!</h2>}
      {party.status === PartyStatus.queued && (
        <>
          <p className="position-value">{getPosition()}</p>
          {(getPosition() ?? 0) > 1 ? (
            <p className="position-subtext">GROUPS AHEAD OF YOU</p>
          ) : (
            <p className="position-subtext">GROUP AHEAD OF YOU</p>
          )}
          <p className="queue-number">Queue ID: {party.id}</p>
        </>
      )}
      {party.status === PartyStatus.ready_to_checkin && availableSeats >= party.party_size && (
        <div>
          <p className="welcome-text">
            We are delighted to inform you that your table is now ready.
            <br />
            Kindly check in within the <b>next minute</b> to enjoy your dining experience.
            <br />
            We look forward to welcoming you
          </p>
          <Button type="submit" variant="contained" onClick={onCheckIn} fullWidth>
            Check In
          </Button>
          <p className="queue-number">Queue ID: {party.id}</p>
        </div>
      )}
      {party.status === PartyStatus.seated && (
        <>
          <p className="meal-text">Bon appétit—but make it fabulous!</p>
          <p className="queue-number">Queue ID: {party.id}</p>
        </>
      )}
      {(party.status === PartyStatus.completed ||
        party.status === PartyStatus.no_show ||
        party.status === PartyStatus.cancelled) && (
        <div>
          <p>
            {party.status === PartyStatus.completed && 'Your service has completed. Thank you!'}
            {party.status === PartyStatus.no_show &&
              "You missed your check-in window and were marked as 'no-show'. Please join the waitlist again if you wish to be seated."}
            {party.status === PartyStatus.cancelled &&
              'Your party has been cancelled. Please join the waitlist again if you wish to be seated.'}
          </p>
        </div>
      )}
    </div>
  );
};
