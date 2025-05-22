import React, { useState, useEffect, useRef, useCallback } from 'react';
import io, { Socket as SocketType } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { styled } from '@mui/material/styles';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import StepConnector, { stepConnectorClasses } from '@mui/material/StepConnector';

import { WaitListForm } from './components/WaitListForm';
import { PartyStatusDisplay } from './components/PartyStatusDisplay';
import { Toast } from './components/Toast/Toast';
import { PartyStatus, type Party } from './types';
import Banner from './assets/banner.jpg';

import './App.css';
import { Container } from '@mui/material';

interface AppProps {
  initialData?: {
    waitlist: Party[];
    availableSeats: number;
    currentPartyStatus: Party | null;
  };
}

const STEPS = ['Lobby', 'Waiting Area', 'Check in', 'Seated'];

const QontoConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 10,
    left: 'calc(-50% + 16px)',
    right: 'calc(50% + 16px)',
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: '#784af4',
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: '#784af4',
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    borderColor: '#eaeaf0',
    borderTopWidth: 3,
    borderRadius: 1,
    ...theme.applyStyles('dark', {
      borderColor: theme.palette.grey[800],
    }),
  },
}));

function App({ initialData }: AppProps) {
  const [name, setName] = useState<string>('');
  const [partySize, setPartySize] = useState<number>(1);
  const [clientId, setClientId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      let storedClientId = localStorage.getItem('clientId');
      if (!storedClientId) {
        storedClientId = uuidv4();
        localStorage.setItem('clientId', storedClientId);
      }
      return storedClientId;
    }
    return uuidv4();
  });
  const [partyId, setPartyId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return initialData?.currentPartyStatus?.id || localStorage.getItem('partyId') || null;
    }
    return initialData?.currentPartyStatus?.id || null;
  });
  const [currentPartyStatus, setCurrentPartyStatus] = useState<Party | null>(initialData?.currentPartyStatus || null);
  const [waitlist, setWaitlist] = useState<Party[]>(initialData?.waitlist || []);
  const [availableSeats, setAvailableSeats] = useState<number>(initialData?.availableSeats || 0);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const socketRef = useRef<SocketType | null>(null);

  const clearPartyData = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('partyId');
    }
    setPartyId(null);
    setCurrentPartyStatus(null);
    setName('');
    setPartySize(1);
  }, []);

  const fetchPartyStatus = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/waitlist/${id}`);
        if (response.ok) {
          const data: Party = await response.json();
          setCurrentPartyStatus(data);
          if (typeof window !== 'undefined') {
            localStorage.setItem('partyId', data.id);
            if (!localStorage.getItem('clientId') || localStorage.getItem('clientId') !== data.client_id) {
              localStorage.setItem('clientId', data.client_id);
              setClientId(data.client_id);
            }
          }

          if (
            data.status === PartyStatus.completed ||
            data.status === PartyStatus.no_show ||
            data.status === PartyStatus.cancelled
          ) {
            clearPartyData();
          }
        } else {
          console.error('Failed to fetch party status:', await response.text());
          clearPartyData();
        }
      } catch (error) {
        console.error('Network error fetching party status:', error);
        clearPartyData();
      }
    },
    [setCurrentPartyStatus, setClientId, clearPartyData],
  );

  useEffect(() => {
    socketRef.current = io();

    socketRef.current.on('initialState', (data: { waitlist: Party[]; availableSeats: number }) => {
      setWaitlist(data.waitlist);
      setAvailableSeats(data.availableSeats);
    });

    socketRef.current.on('waitlistUpdate', (data: { waitlist: Party[]; availableSeats: number }) => {
      setWaitlist(data.waitlist);
      setAvailableSeats(data.availableSeats);
      if (partyId) {
        const updatedParty = data.waitlist.find((p) => p.id === partyId);
        if (updatedParty) {
          setCurrentPartyStatus(updatedParty);
        } else {
          fetchPartyStatus(partyId);
        }
      }
    });

    socketRef.current.on('partyStatusUpdate', (data: { partyId: string; newStatus: PartyStatus }) => {
      if (partyId === data.partyId) {
        setCurrentPartyStatus((prev) => {
          if (prev) {
            const updated = { ...prev, status: data.newStatus };
            if (updated.status === PartyStatus.ready_to_checkin) {
              showToast('You can check in now!', 'info');
            }
            if (
              updated.status === PartyStatus.completed ||
              updated.status === PartyStatus.no_show ||
              updated.status === PartyStatus.cancelled
            ) {
              clearPartyData();

              if (updated.status === PartyStatus.completed) {
                showToast(`Thank you for dining with us. See you again!`, 'success');
              }
              if (updated.status === PartyStatus.no_show) {
                showToast(`Reservation cancalled due to no show.`, 'error');
              }

              if (updated.status === PartyStatus.cancelled) {
                showToast(`Reservation cancelled for ${data.partyId}.`, 'error');
              }
            }
            return updated;
          }
          return null;
        });
      }
    });

    socketRef.current.on('capacityUpdate', (newCapacity: number) => {
      setAvailableSeats(newCapacity);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [partyId, clearPartyData, fetchPartyStatus]);

  useEffect(() => {
    if (partyId && !currentPartyStatus) {
      fetchPartyStatus(partyId);
    }
  }, [partyId, currentPartyStatus, fetchPartyStatus]);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
  };

  const hideToast = () => {
    setToast(null);
  };

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`api/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, partySize, clientId }),
      });

      if (response.ok) {
        const data: {
          message: string;
          partyId: string;
          status?: Party['status'];
        } = await response.json();
        setPartyId(data.partyId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('partyId', data.partyId);
        }
        fetchPartyStatus(data.partyId);
        showToast(`Successfully joined waitlist!`, 'success');
      } else {
        const errorData = await response.json();
        showToast(`Failed to join waitlist: ${errorData.message || 'Unknown error'}`, 'error');
      }
    } catch (error: any) {
      console.error('Error joining waitlist:', error);
      showToast(error.message || 'Error joining waitlist. Please try again.', 'error');
    }
  };

  const handleCheckIn = () => {
    if (partyId && socketRef.current) {
      socketRef.current.emit('checkIn', { partyId });
    }
  };

  const getQueuePosition = (id: string) => {
    const sortedQueue = [...waitlist]
      .filter((p) => p.status === 'queued')
      .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
    const index = sortedQueue.findIndex((p) => p.id === id);
    return index !== -1 ? index + 1 : null;
  };

  const getActiveStep = () => {
    if (currentPartyStatus === null) {
      return 0;
    }
    switch (currentPartyStatus.status) {
      case null:
        return 0;
      case PartyStatus.queued:
        return 1;
      case PartyStatus.ready_to_checkin:
        return 2;
      case PartyStatus.seated:
        return 3;
      default:
        return 0;
    }
  };

  return (
    <>
      <div>
        <img src={Banner} width="100%" alt="banner" />
      </div>
      <div className="App">
        <div>
          <Stepper alternativeLabel activeStep={getActiveStep()} connector={<QontoConnector />}>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel className="custom-step-label">{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </div>
        <Container maxWidth="lg">
          {!partyId ? (
            <WaitListForm
              name={name}
              setName={setName}
              partySize={partySize}
              setPartySize={setPartySize}
              onSubmit={handleJoinWaitlist}
            />
          ) : (
            <PartyStatusDisplay
              availableSeats={availableSeats}
              party={currentPartyStatus}
              getQueuePosition={getQueuePosition}
              onCheckIn={handleCheckIn}
            />
          )}
        </Container>
        {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      </div>
    </>
  );
}

export default App;
