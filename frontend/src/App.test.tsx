import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import App from "./App";

jest.mock("uuid", () => ({ v4: () => "mock-client-id" }));

const mockFetch = (window.fetch = jest.fn());

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

describe("App Component", () => {
  it("renders header and title", () => {
    render(<App />);
    expect(screen.getByText("Waitlist")).toBeInTheDocument();
  });

  it("renders the form if no partyId is in storage", () => {
    render(<App />);
    expect(
      screen.getByRole("button", { name: /join waitlist/i })
    ).toBeInTheDocument();
  });

  it("joins waitlist successfully and shows toast", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        partyId: "p1",
        message: "Successfully joined waitlist!",
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "p1",
        name: "Test",
        party_size: 2,
        status: "queued",
        client_id: "mock-client-id",
        joined_at: new Date().toISOString(),
        ready_at: null,
        checked_in_at: null,
        service_ends_at: null,
      }),
    });

    render(<App />);

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Test" },
    });
    fireEvent.change(screen.getByLabelText(/party size/i), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /join waitlist/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Successfully joined waitlist!")
      ).toBeInTheDocument();
    });
  });

  it("shows error toast on failed waitlist join", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Something went wrong" }),
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /join waitlist/i }));

    await waitFor(() => {
      expect(
        screen.findByText(/failed to join waitlist/i)
      ).resolves.toBeInTheDocument();
    });
  });

  it("fetches existing party status on mount with stored partyId", async () => {
    localStorage.setItem("partyId", "p123");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "p123",
        name: "Stored",
        party_size: 2,
        status: "queued",
        client_id: "mock-client-id",
        joined_at: new Date().toISOString(),
        ready_at: null,
        checked_in_at: null,
        service_ends_at: null,
      }),
    });

    render(<App />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/waitlist/p123");
    });
  });
});
