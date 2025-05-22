import { FC, FormEvent } from 'react';
import Button from '@mui/material/Button';

import './WaitListForm.css';

interface Props {
  name: string;
  setName: (name: string) => void;
  partySize: number;
  setPartySize: (size: number) => void;
  onSubmit: (e: FormEvent) => void;
}

export const WaitListForm: FC<Props> = ({ name, setName, partySize, setPartySize, onSubmit }) => {
  return (
    <div className="waitlist-form-container">
      <h2 className="waitlist-form-title">Waitlist</h2>
      <form onSubmit={onSubmit} className="waitlist-form">
        <div className="waitlist-form-group">
          <label htmlFor="name" className="waitlist-form-label">
            Name
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="waitlist-form-input"
          />
        </div>
        <div className="waitlist-form-group">
          <label htmlFor="partySize" className="waitlist-form-label">
            Party Size
          </label>
          <input
            id="partySize"
            value={partySize}
            onChange={(e) => setPartySize(Math.max(1, parseInt(e.target.value) || 1))}
            type="number"
            min="1"
            required
            className="waitlist-form-input"
          />
        </div>
        <Button type="submit" variant="contained" disabled={name === '' || partySize === 0}>
          Join Waitlist
        </Button>
      </form>
    </div>
  );
};
