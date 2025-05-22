import { FC, useEffect } from 'react';

import './Toast.css';

interface Props {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export const Toast: FC<Props> = ({ message, type, onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ️';

  return (
    <div className={`toast-container toast-${type}`}>
      <span className="toast-icon">{icon}</span>
      <span className="toast-message">{message}</span>
      <button className="toast-close-button" onClick={onClose}>
        &times;
      </button>
    </div>
  );
};
