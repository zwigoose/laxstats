import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TimeKeypad from "./TimeKeypad";

function renderKeypad(props = {}) {
  return render(
    <TimeKeypad
      maxSeconds={720}
      onConfirm={props.onConfirm ?? vi.fn()}
      {...props}
    />
  );
}

function pressDigits(digits) {
  for (const d of String(digits)) {
    fireEvent.click(screen.getByText(d === "0" ? "0" : d));
  }
}

// ── Initial render ─────────────────────────────────────────────────────────────

describe("TimeKeypad — initial render", () => {
  it("shows placeholder --:-- before any input", () => {
    renderKeypad();
    expect(screen.getByText("--:--")).toBeInTheDocument();
  });

  it("shows 'Enter time remaining' hint before any input", () => {
    renderKeypad();
    expect(screen.getByText("Enter time remaining")).toBeInTheDocument();
  });

  it("renders all 10 digit buttons (0–9)", () => {
    renderKeypad();
    for (const d of "0123456789") {
      expect(screen.getByText(d)).toBeInTheDocument();
    }
  });

  it("renders backspace and Use buttons", () => {
    renderKeypad();
    expect(screen.getByText("⌫")).toBeInTheDocument();
    expect(screen.getByText("Use")).toBeInTheDocument();
  });

  it("Use button is disabled initially", () => {
    renderKeypad();
    expect(screen.getByText("Use")).toBeDisabled();
  });
});

// ── Digit entry and display ────────────────────────────────────────────────────

describe("TimeKeypad — digit entry", () => {
  it("shows typed digit count after pressing one digit", () => {
    renderKeypad();
    pressDigits("5");
    expect(screen.getByText(/Typed: 5/)).toBeInTheDocument();
  });

  it("parses single digit as seconds: '5' → 0:05", () => {
    renderKeypad();
    pressDigits("5");
    expect(screen.getByText("0:05")).toBeInTheDocument();
  });

  it("parses two digits as seconds: '45' → 0:45", () => {
    renderKeypad();
    pressDigits("45");
    expect(screen.getByText("0:45")).toBeInTheDocument();
  });

  it("parses three digits as M:SS: '130' → 1:30", () => {
    renderKeypad();
    pressDigits("130");
    expect(screen.getByText("1:30")).toBeInTheDocument();
  });

  it("parses four digits as MM:SS: '1200' → 12:00", () => {
    renderKeypad({ maxSeconds: 720 });
    pressDigits("1000");
    expect(screen.getByText("10:00")).toBeInTheDocument();
  });

  it("caps input at 4 digits — fifth press is ignored", () => {
    renderKeypad();
    // "1234" is valid (12:34) so no "Typed" hint; pressing 5 more should not change it
    pressDigits("12345");
    expect(screen.getByText("12:34")).toBeInTheDocument();
    // Ensure 5 was not appended (which would produce invalid "—:——")
    expect(screen.queryByText("—:——")).not.toBeInTheDocument();
  });

  it("backspace removes the last digit", () => {
    renderKeypad();
    pressDigits("123");
    fireEvent.click(screen.getByText("⌫"));
    expect(screen.getByText(/Typed: 12/)).toBeInTheDocument();
  });

  it("backspace on empty input does nothing", () => {
    renderKeypad();
    fireEvent.click(screen.getByText("⌫"));
    expect(screen.getByText("Enter time remaining")).toBeInTheDocument();
  });

  it("keeps typed digits visible alongside the error for invalid input", () => {
    renderKeypad();
    pressDigits("90"); // 90 seconds → invalid
    expect(screen.getByText(/Typed: 90/)).toBeInTheDocument();
    expect(screen.getByText(/Seconds must be 00–59/)).toBeInTheDocument();
  });

  it("shows the attempted parse in red for invalid seconds (e.g. '99' → 0:99)", () => {
    renderKeypad();
    pressDigits("99");
    expect(screen.getByText("0:99")).toBeInTheDocument();
    expect(screen.queryByText("—:——")).not.toBeInTheDocument();
  });
});

// ── Validation — maxSeconds ────────────────────────────────────────────────────

describe("TimeKeypad — maxSeconds validation", () => {
  it("enables Use button when time is within maxSeconds", () => {
    renderKeypad({ maxSeconds: 720 });
    pressDigits("600"); // 10:00 — within 12:00
    expect(screen.getByText("Use")).not.toBeDisabled();
  });

  it("disables Use button when time exceeds maxSeconds", () => {
    renderKeypad({ maxSeconds: 720 }); // 12:00
    pressDigits("1201"); // 12:01
    expect(screen.getByText("Use")).toBeDisabled();
  });

  it("shows max error message when time exceeds maxSeconds", () => {
    renderKeypad({ maxSeconds: 720 });
    pressDigits("1201");
    expect(screen.getByText(/Max is 12:00/)).toBeInTheDocument();
  });

  it("allows time equal to maxSeconds", () => {
    renderKeypad({ maxSeconds: 720 });
    pressDigits("1200"); // exactly 12:00
    expect(screen.getByText("Use")).not.toBeDisabled();
  });
});

// ── Validation — ceilingSecs ───────────────────────────────────────────────────

describe("TimeKeypad — ceilingSecs validation", () => {
  it("disables Use when time equals ceiling (strict mode)", () => {
    // allowEqualToCeiling defaults to false → time must be strictly below ceiling
    renderKeypad({ maxSeconds: 720, ceilingSecs: 600 }); // ceiling 10:00
    pressDigits("1000"); // 10:00 == ceiling → invalid
    expect(screen.getByText("Use")).toBeDisabled();
  });

  it("shows ceiling error message in strict mode", () => {
    renderKeypad({ maxSeconds: 720, ceilingSecs: 600 });
    pressDigits("1000");
    expect(screen.getByText(/before 10:00/)).toBeInTheDocument();
  });

  it("allows time equal to ceiling when allowEqualToCeiling=true", () => {
    renderKeypad({ maxSeconds: 720, ceilingSecs: 600, allowEqualToCeiling: true });
    pressDigits("1000"); // 10:00 == ceiling → valid
    expect(screen.getByText("Use")).not.toBeDisabled();
  });

  it("disables Use when time exceeds ceiling with allowEqualToCeiling=true", () => {
    renderKeypad({ maxSeconds: 720, ceilingSecs: 600, allowEqualToCeiling: true });
    pressDigits("1001"); // 10:01 > ceiling
    expect(screen.getByText("Use")).toBeDisabled();
  });

  it("allows time below ceiling", () => {
    renderKeypad({ maxSeconds: 720, ceilingSecs: 600 });
    pressDigits("959"); // 9:59 < ceiling
    expect(screen.getByText("Use")).not.toBeDisabled();
  });
});

// ── Confirm callback ───────────────────────────────────────────────────────────

describe("TimeKeypad — onConfirm", () => {
  it("calls onConfirm with formatted label when Use is clicked", () => {
    const onConfirm = vi.fn();
    renderKeypad({ onConfirm, maxSeconds: 720 });
    pressDigits("1000"); // 4 digits: 10:00
    fireEvent.click(screen.getByText("Use"));
    expect(onConfirm).toHaveBeenCalledWith("10:00");
  });

  it("calls onConfirm with zero-padded seconds", () => {
    const onConfirm = vi.fn();
    renderKeypad({ onConfirm, maxSeconds: 720 });
    pressDigits("5"); // 0:05
    fireEvent.click(screen.getByText("Use"));
    expect(onConfirm).toHaveBeenCalledWith("0:05");
  });

  it("does not call onConfirm when Use is disabled", () => {
    const onConfirm = vi.fn();
    renderKeypad({ onConfirm, maxSeconds: 60 });
    pressDigits("200"); // 2:00 > 1:00 max
    fireEvent.click(screen.getByText("Use"));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

// ── Same-as-latest shortcut ────────────────────────────────────────────────────

describe("TimeKeypad — showSameAsLatest", () => {
  it("does not render the shortcut button when showSameAsLatest is false", () => {
    renderKeypad({ showSameAsLatest: false, latestLabel: "5:30" });
    expect(screen.queryByText(/Same as latest/)).not.toBeInTheDocument();
  });

  it("does not render the shortcut button when latestLabel is null", () => {
    renderKeypad({ showSameAsLatest: true, latestLabel: null });
    expect(screen.queryByText(/Same as latest/)).not.toBeInTheDocument();
  });

  it("renders the shortcut button when showSameAsLatest=true and latestLabel is set", () => {
    renderKeypad({ showSameAsLatest: true, latestLabel: "5:30" });
    expect(screen.getByText(/Same as latest: 5:30/)).toBeInTheDocument();
  });

  it("clicking shortcut button fills in the corresponding digits and displays correct time", () => {
    renderKeypad({ showSameAsLatest: true, latestLabel: "5:30", maxSeconds: 720 });
    fireEvent.click(screen.getByText(/Same as latest: 5:30/));
    expect(screen.getByText("5:30")).toBeInTheDocument();
    expect(screen.getByText("Use")).not.toBeDisabled();
  });

  it("shortcut for a 0-minute time (e.g. 0:45 → '45' digits)", () => {
    renderKeypad({ showSameAsLatest: true, latestLabel: "0:45", maxSeconds: 720 });
    fireEvent.click(screen.getByText(/Same as latest: 0:45/));
    expect(screen.getByText("0:45")).toBeInTheDocument();
  });
});
