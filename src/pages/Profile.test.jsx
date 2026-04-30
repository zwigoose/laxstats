import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Profile from "./Profile";

// ── Supabase mock ──────────────────────────────────────────────────────────────

const profileData = vi.hoisted(() => ({ value: { display_name: null } }));

vi.mock("../lib/supabase", () => {
  // update() must return something with .eq() AND be thenable itself.
  // Spread chain methods onto the thenable so the chain doesn't break.
  const makeUpdateResult = (error = null) => ({
    eq:   vi.fn().mockReturnValue({ then: (fn) => Promise.resolve({ error }).then(fn) }),
    then: (fn) => Promise.resolve({ error }).then(fn),
  });

  const chain = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() =>
      Promise.resolve({ data: profileData.value, error: null })
    ),
    update: vi.fn().mockReturnValue(makeUpdateResult()),
  };

  return {
    supabase: {
      from:    vi.fn().mockReturnValue(chain),
      auth: {
        updateUser: vi.fn().mockResolvedValue({ error: null }),
        signOut:    vi.fn().mockResolvedValue({}),
      },
      _chain: chain,
      _makeUpdateResult: makeUpdateResult,
    },
  };
});

import { supabase } from "../lib/supabase";

// ── AuthContext mock ───────────────────────────────────────────────────────────

const authState = vi.hoisted(() => ({
  user:    { id: "user-1", email: "john@laxstats.app", created_at: "2026-01-15T00:00:00Z" },
  loading: false,
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({ ...authState })),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route path="/profile" element={<Profile />} />
        <Route path="/"        element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  profileData.value = { display_name: null };
  authState.user    = { id: "user-1", email: "john@laxstats.app", created_at: "2026-01-15T00:00:00Z" };
  authState.loading = false;

  const eqAfterUpdate = { then: (fn) => Promise.resolve({ error: null }).then(fn) };
  supabase._chain.select.mockReturnThis();
  supabase._chain.eq.mockReturnThis();
  supabase._chain.single.mockImplementation(() =>
    Promise.resolve({ data: profileData.value, error: null })
  );
  supabase._chain.update.mockReturnValue(supabase._makeUpdateResult());
  supabase.from.mockReturnValue(supabase._chain);
  supabase.auth.updateUser.mockResolvedValue({ error: null });
  supabase.auth.signOut.mockResolvedValue({});
});

// ── Account info ───────────────────────────────────────────────────────────────

describe("Profile — account info", () => {
  it("shows Username label and username for laxstats.app accounts", async () => {
    renderProfile();
    await waitFor(() => expect(screen.getByText("Username")).toBeTruthy());
    // "john" appears in both the account info span and the email description <strong>
    expect(screen.getAllByText("john").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Email label for real-email accounts", async () => {
    authState.user = { ...authState.user, email: "john@gmail.com" };
    renderProfile();
    await waitFor(() => expect(screen.getByText("Email")).toBeTruthy());
    expect(screen.getByText("john@gmail.com")).toBeTruthy();
  });

  it("shows member since month and year", async () => {
    renderProfile();
    await waitFor(() => expect(screen.getByText("January 2026")).toBeTruthy());
  });
});

// ── Display name ───────────────────────────────────────────────────────────────

describe("Profile — display name", () => {
  it("fetches display_name from profiles on mount", async () => {
    renderProfile();
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith("profiles");
      expect(supabase._chain.select).toHaveBeenCalledWith("display_name");
    });
  });

  it("populates the input with a saved display name", async () => {
    profileData.value = { display_name: "Coach John" };
    renderProfile();
    await waitFor(() =>
      expect(screen.getByPlaceholderText("john")).toHaveValue("Coach John")
    );
  });

  it("saves display name via profiles.update on Save click", async () => {
    renderProfile();
    await waitFor(() => screen.getByPlaceholderText("john"));
    fireEvent.change(screen.getByPlaceholderText("john"), { target: { value: "Coach John" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(supabase._chain.update).toHaveBeenCalledWith({ display_name: "Coach John" })
    );
  });

  it("shows 'Display name saved.' after successful save", async () => {
    renderProfile();
    await waitFor(() => screen.getByPlaceholderText("john"));
    fireEvent.change(screen.getByPlaceholderText("john"), { target: { value: "Test" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Display name saved.")).toBeTruthy());
  });

  it("shows error when save fails", async () => {
    supabase._chain.update.mockReturnValue(supabase._makeUpdateResult({ message: "DB error" }));
    renderProfile();
    await waitFor(() => screen.getByPlaceholderText("john"));
    fireEvent.change(screen.getByPlaceholderText("john"), { target: { value: "Test" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Failed to save. Try again.")).toBeTruthy());
  });

  it("saves null for a blank (whitespace-only) display name", async () => {
    renderProfile();
    await waitFor(() => screen.getByPlaceholderText("john"));
    fireEvent.change(screen.getByPlaceholderText("john"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(supabase._chain.update).toHaveBeenCalledWith({ display_name: null })
    );
  });
});

// ── Change email ───────────────────────────────────────────────────────────────

describe("Profile — change email", () => {
  it("calls auth.updateUser with the new email", async () => {
    renderProfile();
    await waitFor(() => screen.getByPlaceholderText("new@example.com"));
    fireEvent.change(screen.getByPlaceholderText("new@example.com"), {
      target: { value: "newemail@gmail.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() =>
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ email: "newemail@gmail.com" })
    );
  });

  it("shows confirmation message after successful email update", async () => {
    renderProfile();
    await waitFor(() => screen.getByPlaceholderText("new@example.com"));
    fireEvent.change(screen.getByPlaceholderText("new@example.com"), {
      target: { value: "newemail@gmail.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(screen.getByText(/Confirmation sent/)).toBeTruthy());
  });

  it("rejects @laxstats.app addresses without calling auth.updateUser", async () => {
    renderProfile();
    await waitFor(() => screen.getByPlaceholderText("new@example.com"));
    fireEvent.change(screen.getByPlaceholderText("new@example.com"), {
      target: { value: "admin@laxstats.app" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() =>
      expect(screen.getByText(/Enter a real email address/)).toBeTruthy()
    );
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("shows Supabase error when update fails", async () => {
    supabase.auth.updateUser.mockResolvedValue({ error: { message: "Email already in use" } });
    renderProfile();
    await waitFor(() => screen.getByPlaceholderText("new@example.com"));
    fireEvent.change(screen.getByPlaceholderText("new@example.com"), {
      target: { value: "taken@gmail.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(screen.getByText("Email already in use")).toBeTruthy());
  });
});

// ── Change password ────────────────────────────────────────────────────────────

describe("Profile — change password", () => {
  it("calls auth.updateUser with the new password when valid", async () => {
    renderProfile();
    await waitFor(() => screen.getByPlaceholderText("New password"));
    fireEvent.change(screen.getByPlaceholderText("New password"),         { target: { value: "newpass1" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm new password"), { target: { value: "newpass1" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() =>
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "newpass1" })
    );
  });

  it("shows success message after password change", async () => {
    renderProfile();
    await waitFor(() => screen.getByPlaceholderText("New password"));
    fireEvent.change(screen.getByPlaceholderText("New password"),         { target: { value: "newpass1" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm new password"), { target: { value: "newpass1" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() => expect(screen.getByText("Password updated.")).toBeTruthy());
  });

  it("rejects passwords shorter than 6 characters", async () => {
    renderProfile();
    await waitFor(() => screen.getByPlaceholderText("New password"));
    fireEvent.change(screen.getByPlaceholderText("New password"),         { target: { value: "abc" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm new password"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() =>
      expect(screen.getByText("Password must be at least 6 characters.")).toBeTruthy()
    );
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords", async () => {
    renderProfile();
    await waitFor(() => screen.getByPlaceholderText("New password"));
    fireEvent.change(screen.getByPlaceholderText("New password"),         { target: { value: "newpass1" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm new password"), { target: { value: "newpass2" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() => expect(screen.getByText("Passwords do not match.")).toBeTruthy());
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("shows Supabase error when password update fails", async () => {
    supabase.auth.updateUser.mockResolvedValue({ error: { message: "Password too weak" } });
    renderProfile();
    await waitFor(() => screen.getByPlaceholderText("New password"));
    fireEvent.change(screen.getByPlaceholderText("New password"),         { target: { value: "weakpw" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm new password"), { target: { value: "weakpw" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() => expect(screen.getByText("Password too weak")).toBeTruthy());
  });
});

// ── Sign out ───────────────────────────────────────────────────────────────────

describe("Profile — sign out", () => {
  it("calls auth.signOut and navigates to /", async () => {
    renderProfile();
    await waitFor(() => screen.getByRole("button", { name: "Sign out" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalled());
    expect(screen.getByText("Home")).toBeTruthy();
  });
});
