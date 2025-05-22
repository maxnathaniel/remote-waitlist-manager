import { render, screen, fireEvent } from '@testing-library/react';

import { WaitListForm } from './WaitListForm';

describe('WaitListForm Component', () => {
  const mockSetName = jest.fn();
  const mockSetPartySize = jest.fn();
  const mockOnSubmit = jest.fn((e) => e.preventDefault());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders form elements correctly', () => {
    render(
      <WaitListForm
        name="John"
        setName={mockSetName}
        partySize={2}
        setPartySize={mockSetPartySize}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/party size/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join waitlist/i })).toBeInTheDocument();
  });

  it('calls setName on input change', () => {
    render(
      <WaitListForm
        name=""
        setName={mockSetName}
        partySize={1}
        setPartySize={mockSetPartySize}
        onSubmit={mockOnSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Alice' },
    });

    expect(mockSetName).toHaveBeenCalledWith('Alice');
  });

  it('calls setPartySize with parsed value on change', () => {
    render(
      <WaitListForm
        name=""
        setName={mockSetName}
        partySize={1}
        setPartySize={mockSetPartySize}
        onSubmit={mockOnSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText(/party size/i), {
      target: { value: '4' },
    });

    expect(mockSetPartySize).toHaveBeenCalledWith(4);
  });

  it('submits the form on button click', () => {
    render(
      <WaitListForm
        name="Bob"
        setName={mockSetName}
        partySize={2}
        setPartySize={mockSetPartySize}
        onSubmit={mockOnSubmit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /join waitlist/i }));
    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it('prevents party size from being set to zero or less', () => {
    render(
      <WaitListForm
        name="Test"
        setName={mockSetName}
        partySize={1}
        setPartySize={mockSetPartySize}
        onSubmit={mockOnSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText(/party size/i), {
      target: { value: '0' },
    });

    expect(mockSetPartySize).toHaveBeenCalledWith(1);
  });
});
