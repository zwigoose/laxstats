// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — the single source of truth for LaxStats' visual design.
//
// Every value here was extracted verbatim from previously-inline styles;
// introducing this file changed zero pixels. Ramp steps are ordered by
// luminance within each hue family. Near-duplicate steps (e.g. gray25–gray45,
// blue30–blue40) are consolidation candidates for a future redesign — they are
// kept distinct here for fidelity with the shipped UI.
//
// A redesign should land primarily in this file.
// ─────────────────────────────────────────────────────────────────────────────

// Colors
export const C = {
  // Neutrals (gray ramp, light → dark)
  white:   "#fff",
  gray25:  "#fafafa",   // page-adjacent backgrounds
  gray30:  "#f9f9f9",   // table header backgrounds
  gray35:  "#f7f8fa",   // cool-tinted panel background
  gray40:  "#f8f8f8",
  gray45:  "#f7f7f7",   // card/panel backgrounds, input backgrounds
  gray50:  "#f5f5f5",   // pills, table header rows
  gray75:  "#f0f0f0",   // badges, subtle borders, active nav background
  gray80:  "#efefef",
  gray85:  "#eee",
  gray90:  "#ebebeb",
  gray100: "#e8e8e8",   // dividers
  gray150: "#e5e5e5",   // standard border
  gray200: "#e0e0e0",   // light borders
  gray250: "#ddd",      // input borders
  gray275: "#d0d0d0",
  gray300: "#ccc",      // disabled backgrounds, dashed borders
  gray350: "#bbb",      // faint text
  gray400: "#aaa",      // disabled/hint text
  gray450: "#999",
  gray500: "#888",      // secondary/muted text, labels
  gray550: "#777",
  gray600: "#666",
  gray650: "#555",      // secondary text, fallback team color
  gray700: "#444",
  gray750: "#333",
  gray800: "#222",
  gray830: "#1e1e1e",
  gray850: "#1a1a1a",   // dark banners (final banner)
  gray900: "#111",      // primary text, primary buttons ("ink")
  gray950: "#0f1117",   // near-black blue-tinted dark surface

  // Red (danger / errors / away accents)
  red25:  "#fdf8f8",
  red50:  "#fff5f5",    // danger button background
  red55:  "#fff0f0",
  red60:  "#fef0f0",
  red65:  "#fff0ee",    // undo button background
  red100: "#fdd",
  red150: "#fcc",
  red200: "#f0c0c0",
  red250: "#e0b0b0",
  red300: "#f0a0a0",    // danger borders
  red310: "#e8a0a0",
  red320: "#e0a0a0",
  red400: "#e08080",
  red500: "#e53935",
  red600: "#c0392b",    // danger text/action, "canceled" status
  red700: "#c00",

  // Orange (warnings / pending / away-team default)
  orange25:  "#fffbf5",
  orange40:  "#fff8f0",
  orange50:  "#fff8ec",  // "giga" plan background
  orange100: "#fff3e0",
  orange200: "#f0d9b5",
  orange210: "#e0d0b0",
  orange250: "#ffd08a",
  orange300: "#f0c060",  // duplicate-badge border
  orange500: "#e67e22",  // overtime indicator
  orange550: "#f0a500",
  orange600: "#d4820a",  // warning/pending status
  orange700: "#b84e1a",  // away-team default color
  orange800: "#8b3a1a",  // preset team color (dark brown)
  orange850: "#9a4800",

  // Amber (warm warning boxes / edit banners)
  amber25:  "#fffdf5",
  amber50:  "#fffbf0",   // warning button background
  amber55:  "#fffbec",
  amber60:  "#fffbe6",
  amber100: "#fff3cd",   // duplicate-badge background
  amber150: "#f0e8c0",
  amber160: "#f5e9b8",
  amber200: "#ffe69c",
  amber210: "#ffe58f",
  amber250: "#e0d0a0",   // edit-banner border
  amber300: "#f0d080",
  amber310: "#ffd666",
  amber320: "#e0d080",
  amber400: "#e0c060",   // warning button border
  amber500: "#ffc107",
  amber550: "#c0a030",
  amber600: "#b8860b",
  amber650: "#9a7c20",
  amber700: "#8a6400",
  amber710: "#856404",
  amber800: "#7a5c00",   // warning text
  amber810: "#7a5700",
  amber850: "#664d03",
  amber860: "#664d00",

  // Green (success / live)
  green25:  "#f0fff4",
  green30:  "#f0faf2",
  green50:  "#eaf6ec",   // success box background, "max" plan
  green60:  "#e8f5e9",
  green75:  "#eaf3de",
  green100: "#c8e6c9",
  green110: "#c0e8c8",
  green200: "#b5e0c0",   // dashed add-button border
  green210: "#b7dfc1",
  green220: "#b2dfb8",
  green400: "#4caf50",   // "Live" badge
  green600: "#2a7a3b",   // success/active status, preset team color
  green800: "#1a5c2a",

  // Emerald (dark green surfaces)
  emerald300: "#9fe1cb",
  emerald400: "#34d399",
  emerald800: "#064e3b",
  emerald900: "#063e2e",

  // Teal
  teal600: "#1a7a7a",    // preset team color

  // Blue (info / links / home-team default)
  blue30:  "#f0f8ff",
  blue35:  "#f0f7ff",    // light blue highlight
  blue40:  "#f0f6ff",
  blue50:  "#eef4fb",    // info box background, "pro" plan
  blue60:  "#f0f4f8",
  blue100: "#e3f2fd",
  blue150: "#d0e4f8",
  blue160: "#c8dff5",
  blue200: "#c0d8f0",    // info borders
  blue250: "#b3d4f0",
  blue300: "#b0c8e0",
  blue600: "#1a6bab",    // home-team default, info/primary accent
  navy700: "#1a2e8b",    // preset team color

  // Purple
  purple600: "#8b1a8b",  // preset team color

  // White alpha ramp (used on team-colored surfaces)
  whiteA12: "rgba(255,255,255,0.12)",
  whiteA13: "rgba(255,255,255,0.13)",
  whiteA14: "rgba(255,255,255,0.14)",
  whiteA16: "rgba(255,255,255,0.16)",
  whiteA18: "rgba(255,255,255,0.18)",
  whiteA20: "rgba(255,255,255,0.2)",
  whiteA22: "rgba(255,255,255,0.22)",
  whiteA25: "rgba(255,255,255,0.25)",
  whiteA30: "rgba(255,255,255,0.3)",
  whiteA35: "rgba(255,255,255,0.35)",
  whiteA40: "rgba(255,255,255,0.4)",
  whiteA50: "rgba(255,255,255,0.5)",
  whiteA60: "rgba(255,255,255,0.6)",
  whiteA70: "rgba(255,255,255,0.7)",
  whiteA75: "rgba(255,255,255,0.75)",
  whiteA80: "rgba(255,255,255,0.8)",
  whiteA85: "rgba(255,255,255,0.85)",

  // Black alpha ramp (overlays, scrims)
  blackA04: "rgba(0,0,0,0.04)",
  blackA05: "rgba(0,0,0,0.05)",
  blackA06: "rgba(0,0,0,0.06)",
  blackA07: "rgba(0,0,0,0.07)",
  blackA08: "rgba(0,0,0,0.08)",
  blackA18: "rgba(0,0,0,0.18)",
  blackA20: "rgba(0,0,0,0.2)",
  blackA22: "rgba(0,0,0,0.22)",
  blackA25: "rgba(0,0,0,0.25)",
  blackA35: "rgba(0,0,0,0.35)",
  blackA50: "rgba(0,0,0,0.5)",   // modal overlay
  blackA55: "rgba(0,0,0,0.55)",
  blackA60: "rgba(0,0,0,0.6)",
  blackA70: "rgba(0,0,0,0.7)",   // dark modal overlay

  // Orange alpha (glow accents on #d4820a)
  orangeA15: "rgba(212,130,10,0.15)",
  orangeA20: "rgba(212,130,10,0.2)",
  orangeA30: "rgba(212,130,10,0.3)",
};

// Font stacks
export const F = {
  ui:    "system-ui, sans-serif",
  mono:  "monospace",
  serif: "Georgia, serif",
};

// Box shadows (low → high elevation)
export const SH = {
  crisp:   "0 1px 3px rgba(0,0,0,0.2)",
  hairline:"0 1px 4px rgba(0,0,0,0.05)",
  subtle2: "0 1px 6px rgba(0,0,0,0.04)",
  subtle:  "0 1px 6px rgba(0,0,0,0.05)",
  soft:    "0 1px 8px rgba(0,0,0,0.06)",
  card2:   "0 2px 10px rgba(0,0,0,0.06)",
  card3:   "0 2px 12px rgba(0,0,0,0.06)",
  card:    "0 2px 12px rgba(0,0,0,0.07)",
  pop:     "0 4px 20px rgba(0,0,0,0.22)",
  pop2:    "0 4px 20px rgba(0,0,0,0.25)",
  float:   "0 4px 24px rgba(0,0,0,0.08)",
  modal:   "0 8px 40px rgba(0,0,0,0.18)",
  hero:    "0 12px 48px rgba(0,0,0,0.5)",
};
