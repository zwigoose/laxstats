import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

// caused_to renamed to forced_to
export const EVENTS = [
  { id: "goal",        label: "Goal",         icon: "🥍" },
  { id: "shot",        label: "Shot",         icon: "🎯" },
  { id: "ground_ball", label: "Ground Ball",  icon: "🪣" },
  { id: "faceoff_win", label: "Faceoff W",    icon: "🔄" },
  { id: "turnover",    label: "Turnover",     icon: "↩️" },
  { id: "forced_to",   label: "Forced TO",    icon: "🥊" },
  { id: "penalty",     label: "Penalty",      icon: "🟨" },
  { id: "mdd_success", label: "MDD Stop",     icon: "🛡️", teamStat: true },
  { id: "timeout",     label: "Timeout",      icon: "⏸️" },
  { id: "clear",        label: "Successful Clear", icon: "⬆️", teamStat: true },
  { id: "failed_clear", label: "Failed Clear",     icon: "⬇️", teamStat: true },
];

export const STAT_KEYS =["goal","emo_goal","emo_fail","mdd_success","mdd_fail","shot","sog","shot_saved","shot_post","shot_blocked","ground_ball","faceoff_win","turnover","forced_to","penalty_tech","penalty_min","assist","clear","failed_clear","successful_ride","failed_ride"];
export const STAT_LABELS ={ goal:"G", emo_goal:"EMO", emo_fail:"FEMO", mdd_success:"MDD", mdd_fail:"FMDD", shot:"Sh", sog:"SOG", shot_saved:"Sv", shot_post:"Post", shot_blocked:"Blk", ground_ball:"GB", faceoff_win:"FW", turnover:"TO", forced_to:"FTO", penalty_tech:"Tech", penalty_min:"PF Min", assist:"A", clear:"Clr", failed_clear:"FCl", successful_ride:"SRide", failed_ride:"FRide" };

const PRESET_COLORS = ["#1a6bab","#b84e1a","#2a7a3b","#8b1a8b","#c0392b","#d4820a","#1a7a7a","#555","#1a2e8b","#8b3a1a"];

const PENALTY_OPTIONS = [
  { name: "Conduct",                 type: "tech" },
  { name: "Cross Check",             type: "personal" },
  { name: "Holding",                 type: "tech" },
  { name: "Illegal Body Check",      type: "personal" },
  { name: "Illegal Equipment",       type: "personal" },
  { name: "Illegal Procedure",       type: "tech" },
  { name: "Interference",            type: "tech" },
  { name: "Offsides",                type: "tech" },
  { name: "Pushing",                 type: "tech" },
  { name: "Slashing",                type: "personal" },
  { name: "Tripping",                type: "personal" },
  { name: "Unnecessary Roughness",   type: "personal" },
  { name: "Unsportsmanlike Conduct", type: "personal" },
];

let _nextId = 1;
function nextId() { return _nextId++; }

function parseRoster(text) {
  return text.split("\n").map(l => l.trim()).filter(Boolean).map(line => {
    const m = line.match(/^#?(\d+)\s+(.+)$/) || line.match(/^(.+)\s+#?(\d+)$/);
    if (m) { if (/^\d+$/.test(m[1])) return { num: m[1], name: m[2].trim() }; return { num: m[2], name: m[1].trim() }; }
    const n = line.match(/^#?(\d+)$/);
    if (n) return { num: n[1], name: `#${n[1]}` };
    return { num: "", name: line };
  }).filter(p => p.name).sort((a, b) => parseInt(a.num, 10) - parseInt(b.num, 10));
}

function findDuplicateNums(rosterText) {
  const players = parseRoster(rosterText);
  const seen = new Set(), dupes = new Set();
  players.forEach(p => {
    if (!p.num) return;
    if (seen.has(p.num)) dupes.add(`#${p.num}`);
    else seen.add(p.num);
  });
  return [...dupes];
}

export function buildPlayerStats(entries) {
  // Build group lookup so we can determine SOG per shot
  const groups = {};
  entries.forEach(e => {
    if (!groups[e.groupId]) groups[e.groupId] = [];
    groups[e.groupId].push(e);
  });

  const map = {};
  entries.forEach(e => {
    if (e.teamStat) return;
    const k = `${e.teamIdx}__${e.player.num}__${e.player.name}`;
    if (!map[k]) map[k] = { teamIdx: e.teamIdx, player: e.player, ...Object.fromEntries(STAT_KEYS.map(s => [s, 0])) };
    if (e.event === "penalty_tech") map[k].penalty_tech++;
    else if (e.event === "penalty_min") map[k].penalty_min += e.penaltyMin || 0;
    else if (e.event === "goal") {
      map[k].goal++;
      if (e.emo) map[k].emo_goal++;
      map[k].sog++; // a goal is always on goal
    }
    else if (e.event === "shot") {
      map[k].shot++;
      // SOG: saved (group has shot_saved) or hit the post (group has shot_post for same team)
      const group = groups[e.groupId] || [];
      const onGoal = group.some(ge => ge.event === "shot_saved")
                  || group.some(ge => ge.event === "shot_post" && ge.teamIdx === e.teamIdx);
      if (onGoal) map[k].sog++;
    }
    else if (map[k][e.event] !== undefined) map[k][e.event]++;
  });
  return Object.values(map);
}

export function buildTeamTotals(entries) {
  const totals = [0, 1].map(ti => {
    const tot = Object.fromEntries(STAT_KEYS.map(k => [k, 0]));
    entries.filter(e => e.teamIdx === ti).forEach(e => {
      if (e.event === "penalty_tech") tot.penalty_tech++;
      else if (e.event === "penalty_min") tot.penalty_min += e.penaltyMin || 0;
      else if (e.event === "goal") { tot.goal++; if (e.emo) tot.emo_goal++; }
      else if (tot[e.event] !== undefined) tot[e.event]++;
    });
    return tot;
  });
  // Ride stats mirror the opposing team's clear stats
  totals[0].successful_ride = totals[1].failed_clear;
  totals[0].failed_ride     = totals[1].clear;
  totals[1].successful_ride = totals[0].failed_clear;
  totals[1].failed_ride     = totals[0].clear;
  // MDD fail mirrors the opposing team's EMO goals
  totals[0].mdd_fail = entries.filter(e => e.event === "goal" && e.emo && e.teamIdx === 1).length;
  totals[1].mdd_fail = entries.filter(e => e.event === "goal" && e.emo && e.teamIdx === 0).length;
  // EMO fail mirrors the opposing team's MDD stops (a stopped EMO = a successful MDD)
  totals[0].emo_fail = totals[1].mdd_success;
  totals[1].emo_fail = totals[0].mdd_success;
  // SOG = goals + shots off post + saves by the opposing goalie (goals are always on goal)
  totals[0].sog = totals[0].goal + totals[0].shot_post + totals[1].shot_saved;
  totals[1].sog = totals[1].goal + totals[1].shot_post + totals[0].shot_saved;
  return totals;
}

export function qLabel(q) { return q <= 4 ? `Q${q}` : `OT${q - 4}`; }
export function isOT(q) { return q > 4; }

// ── Penalty time math helpers ─────────────────────────────────────────────────
export function toSecs(t) { const [m, s] = t.split(":").map(Number); return m * 60 + s; }
const qLenSecs = q => q <= 4 ? 720 : 240;
function absElapsedSecs(quarter, remainSecs) {
  let base = 0;
  for (let i = 1; i < quarter; i++) base += qLenSecs(i);
  return base + (qLenSecs(quarter) - remainSecs);
}
function absSecsToQtrTime(absSeconds) {
  let q = 1, elapsed = 0;
  while (q <= 20) {
    const ql = qLenSecs(q);
    if (absSeconds <= elapsed + ql) return { q, remainSecs: Math.max(0, elapsed + ql - absSeconds) };
    elapsed += ql;
    q++;
  }
  return { q: 20, remainSecs: 0 };
}
function penaltyDurSecs(e) { return e.event === "penalty_tech" ? 30 : (e.penaltyMin || 1) * 60; }

// Derives all penalty serving windows from the log, handling:
//   Consecutive fouls  — same player, same team, same dead-ball time → NR-first ordering, chained release
//   Simultaneous fouls — different teams, same dead-ball time → overlapping window is forced NR for both
// Returns an array of windows: { entry, absStart, absEnd, nrEnd }
//   nrEnd = absEnd  → fully NR (either explicit or forced by simultaneous)
//   nrEnd = absStart → fully releasable
//   absStart < nrEnd < absEnd → split: [absStart,nrEnd) NR + [nrEnd,absEnd) releasable
function computePenaltyWindows(log) {
  const penalties = log.filter(e => e.penaltyTime && (e.event === "penalty_tech" || e.event === "penalty_min"));
  // Group by dead-ball cycle: same quarter + same penaltyTime
  const cycles = new Map();
  for (const p of penalties) {
    const key = `${p.quarter}:${p.penaltyTime}`;
    if (!cycles.has(key)) cycles.set(key, []);
    cycles.get(key).push(p);
  }
  const allWindows = [];
  for (const cyclePens of cycles.values()) {
    const absPen = absElapsedSecs(cyclePens[0].quarter, toSecs(cyclePens[0].penaltyTime));
    // Build windows per team
    const teamWindows = [0, 1].map(ti => {
      const wins = [];
      const byPlayer = new Map();
      for (const p of cyclePens.filter(p => p.teamIdx === ti)) {
        const pid = p.player?.num ?? p.id; // jersey # is unique per team; no id on player objects
        if (!byPlayer.has(pid)) byPlayer.set(pid, []);
        byPlayer.get(pid).push(p);
      }
      for (const [, playerPens] of byPlayer) {
        // NR-first ordering for consecutive fouls on same player
        const sorted = [...playerPens].sort((a, b) => {
          if (!!a.nonReleasable !== !!b.nonReleasable) return a.nonReleasable ? -1 : 1;
          return penaltyDurSecs(b) - penaltyDurSecs(a);
        });
        let cur = absPen;
        for (const p of sorted) {
          const dur = penaltyDurSecs(p);
          // forcedNREnd starts at absStart (no forced NR yet); updated by simultaneous detection below
          wins.push({ entry: p, absStart: cur, absEnd: cur + dur, isNRBase: !!p.nonReleasable, forcedNREnd: cur });
          cur += dur;
        }
      }
      return wins;
    });
    // Simultaneous: cross-team window overlaps → force NR up to the overlap end
    for (const wA of teamWindows[0]) {
      for (const wB of teamWindows[1]) {
        const oStart = Math.max(wA.absStart, wB.absStart);
        const oEnd   = Math.min(wA.absEnd,   wB.absEnd);
        if (oEnd > oStart) {
          if (!wA.isNRBase) wA.forcedNREnd = Math.max(wA.forcedNREnd, oEnd);
          if (!wB.isNRBase) wB.forcedNREnd = Math.max(wB.forcedNREnd, oEnd);
        }
      }
    }
    // Resolve nrEnd for each window
    for (const w of [...teamWindows[0], ...teamWindows[1]]) {
      w.nrEnd = w.isNRBase ? w.absEnd : w.forcedNREnd;
      allWindows.push(w);
    }
  }
  return allWindows;
}

// Returns [timeoutsLeftTeam0, timeoutsLeftTeam1] for the current timeout period.
// Q1+Q2 = first half (2 each), Q3+Q4 = second half (2 each), each OT quarter = 1 each.
// Unused timeouts do not carry between periods.
function getTimeoutsLeft(log, currentQuarter) {
  let periodQuarters, allowed;
  if (currentQuarter <= 2)      { periodQuarters = [1, 2]; allowed = 2; }
  else if (currentQuarter <= 4) { periodQuarters = [3, 4]; allowed = 2; }
  else                          { periodQuarters = [currentQuarter]; allowed = 1; }
  return [0, 1].map(ti =>
    Math.max(0, allowed - log.filter(e => e.event === "timeout" && e.teamIdx === ti && periodQuarters.includes(e.quarter)).length)
  );
}

export function entryDisplayInfo(entry) {
  let icon = EVENTS.find(e => e.id === entry.event)?.icon || "•";
  let label = EVENTS.find(e => e.id === entry.event)?.label || entry.event;
  if (entry.event === "shot_saved") { icon = "🧤"; label = "Save"; }
  if (entry.event === "penalty_tech") { icon = "🟨"; label = entry.foulName ? `${entry.foulName} (Technical)` : "Technical foul"; }
  if (entry.event === "penalty_min") { icon = "🟥"; label = entry.foulName ? `${entry.foulName} (${entry.penaltyMin}min)` : `Personal foul (${entry.penaltyMin}min)`; }
  if (entry.event === "goal" && entry.emo) label = "Goal (EMO)";
  return { icon, label, player: entry.teamStat ? null : entry.player };
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  app: { fontFamily: "system-ui, sans-serif", maxWidth: 600, margin: "0 auto", padding: "0 16px 40px", background: "#fff" },
  nav: { display: "flex", borderBottom: "1px solid #e5e5e5", marginBottom: 20 },
  navBtn: (active, disabled) => ({ flex: 1, padding: "10px 4px", fontSize: 13, fontWeight: 500, border: "none", background: "transparent", cursor: disabled ? "default" : "pointer", color: active ? "#111" : "#888", borderBottom: active ? "2px solid #111" : "2px solid transparent", opacity: disabled ? 0.35 : 1 }),
  setupGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  setupCard: (c) => ({ border: "1px solid #e5e5e5", borderTop: `3px solid ${c}`, borderRadius: 12, padding: 16 }),
  teamLabel: (c) => ({ fontSize: 11, fontWeight: 600, color: c, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }),
  textInput: { width: "100%", padding: "8px 10px", fontSize: 15, fontWeight: 500, border: "1px solid #ddd", borderRadius: 8, background: "#f7f7f7", marginBottom: 12, boxSizing: "border-box" },
  textarea: { width: "100%", height: 160, padding: 10, fontSize: 13, fontFamily: "monospace", border: "1px solid #ddd", borderRadius: 8, background: "#f7f7f7", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" },
  hint: { fontSize: 11, color: "#aaa", marginTop: 6 },
  chip: { display: "inline-block", background: "#f5f5f5", border: "1px solid #e5e5e5", borderRadius: 20, padding: "3px 10px", fontSize: 12, margin: "3px" },
  chipNum: { fontWeight: 600, color: "#888", marginRight: 4 },
  colorRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  colorSwatch: (c, sel) => ({ width: 26, height: 26, borderRadius: "50%", background: c, border: sel ? "3px solid #111" : "2px solid #e5e5e5", cursor: "pointer", flexShrink: 0, boxSizing: "border-box" }),
  colorPickerInput: { width: 32, height: 26, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", padding: 2 },
  startBtn: (disabled) => ({ width: "100%", marginTop: 20, padding: 14, fontSize: 16, fontWeight: 500, background: disabled ? "#ccc" : "#111", color: "#fff", border: "none", borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer" }),
  stepLabel: { fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 },
  teamBtns: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 },
  teamBigBtn: (c, isHome) => isHome
    ? { padding: "28px 12px", fontWeight: 600, border: `5px solid ${c}`, borderRadius: 14, background: "#fff", color: c, cursor: "pointer", textAlign: "center", lineHeight: 1.3, width: "100%", boxSizing: "border-box" }
    : { padding: "28px 12px", fontWeight: 500, border: "none", borderRadius: 14, background: c, color: "#fff", cursor: "pointer", textAlign: "center", lineHeight: 1.3, width: "100%" },
  endQtrBtn: (disabled) => ({ width: "100%", padding: 13, fontSize: 14, fontWeight: 500, border: "1px solid #e0d0b0", borderRadius: 10, background: disabled ? "#f5f5f5" : "#fffbf0", color: disabled ? "#bbb" : "#7a5c00", cursor: disabled ? "default" : "pointer", marginTop: 4, opacity: disabled ? 0.5 : 1 }),
  eventGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 },
  eventBtn: (sel) => ({ padding: "18px 10px", fontSize: 13, fontWeight: 500, border: sel ? "2px solid #111" : "1px solid #ddd", borderRadius: 12, background: sel ? "#f0f0f0" : "#fff", color: "#111", cursor: "pointer", textAlign: "center", width: "100%" }),
  evIcon: { fontSize: 24, display: "block", marginBottom: 6 },
  playerGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10, maxHeight: "calc(100dvh - 260px)", overflowY: "auto" },
  playerBtn: (sel, color, isHome) => ({
    padding: "18px 10px", fontSize: 14, borderRadius: 12, cursor: "pointer", textAlign: "center", width: "100%",
    background: isHome ? (sel ? (color || "#555") : "#fff") : (color || "#555"),
    border: isHome
      ? (sel ? "3px solid #fff" : `4px solid ${color || "#555"}`)
      : (sel ? "3px solid #fff" : "2px solid transparent"),
    outline: sel ? "2px solid " + (color || "#555") : "none",
    boxSizing: "border-box",
  }),
  playerNum: (sel, isHome, color) => ({ fontSize: 20, fontWeight: 600, display: "block", color: (isHome && !sel) ? (color || "#555") : "#fff" }),
  playerName: (sel, isHome, color) => ({ fontSize: 12, color: (isHome && !sel) ? "#aaa" : "rgba(255,255,255,0.75)", marginTop: 3, wordBreak: "break-word" }),
  backBtn: { fontSize: 13, color: "#888", background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 14 },
  confirmCard: { background: "#f7f7f7", borderRadius: 12, padding: 24, textAlign: "center", marginBottom: 14 },
  confirmBtns: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  yesNoRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 },
  threeColRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 },
  btnPrimary: { padding: 13, fontSize: 15, fontWeight: 500, border: "none", borderRadius: 10, background: "#111", color: "#fff", cursor: "pointer", width: "100%" },
  btnSecondary: { padding: 13, fontSize: 15, fontWeight: 500, border: "1px solid #ddd", borderRadius: 10, background: "transparent", color: "#111", cursor: "pointer", width: "100%" },
  btnWarning: { padding: 13, fontSize: 15, fontWeight: 500, border: "1px solid #e0c060", borderRadius: 10, background: "#fffbf0", color: "#7a5c00", cursor: "pointer", width: "100%" },
  btnDanger: { padding: 13, fontSize: 15, fontWeight: 500, border: "1px solid #f0a0a0", borderRadius: 10, background: "#fff5f5", color: "#c0392b", cursor: "pointer", width: "100%" },
  btnYes: { padding: 13, fontSize: 15, fontWeight: 500, border: "none", borderRadius: 10, background: "#111", color: "#fff", cursor: "pointer", width: "100%" },
  btnNo: { padding: 13, fontSize: 15, fontWeight: 500, border: "1px solid #ddd", borderRadius: 10, background: "transparent", color: "#555", cursor: "pointer", width: "100%" },
  qtrPill: { display: "inline-flex", alignItems: "center", gap: 6, background: "#f5f5f5", border: "1px solid #e5e5e5", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600, color: "#555" },
  scoreHeader: { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", marginBottom: 16, gap: 12 },
  scoreBig: { fontSize: 38, fontWeight: 500, textAlign: "center", letterSpacing: 2 },
  tabsRow: { display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  tabBtn: (active) => ({ padding: "6px 14px", fontSize: 13, border: "1px solid #ddd", borderRadius: 20, background: active ? "#111" : "transparent", color: active ? "#fff" : "#888", cursor: "pointer" }),
  summaryGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 },
  summaryCard: { background: "#f7f7f7", borderRadius: 10, padding: "12px 14px" },
  summaryLabel: { fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 },
  summaryRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 },
  tableWrap: { border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden", marginBottom: 20 },
  tableTitle: { fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#888", padding: "10px 14px 8px", borderBottom: "1px solid #e5e5e5", background: "#f9f9f9", display: "flex", justifyContent: "space-between", alignItems: "center" },
  table: { width: "100%", fontSize: 13, borderCollapse: "collapse" },
  thLeft: { padding: "8px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e5e5e5", background: "#f5f5f5", whiteSpace: "nowrap" },
  th: (sorted) => ({ padding: "8px 8px", textAlign: "right", fontWeight: 600, fontSize: 11, color: sorted ? "#111" : "#888", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e5e5e5", background: "#f5f5f5", cursor: "pointer", whiteSpace: "nowrap" }),
  tdLeft: { padding: "9px 14px", borderBottom: "1px solid #f0f0f0", color: "#111", textAlign: "left", whiteSpace: "nowrap" },
  td: { padding: "9px 8px", borderBottom: "1px solid #f0f0f0", color: "#111", textAlign: "right" },
  numBadge: { display: "inline-block", width: 24, height: 24, borderRadius: "50%", background: "#f0f0f0", fontSize: 11, fontWeight: 600, textAlign: "center", lineHeight: "24px", marginRight: 6, color: "#888" },
  logList: { maxHeight: 380, overflowY: "auto" },
  logGroup: { borderBottom: "1px solid #f0f0f0" },
  logGroupMain: { display: "flex", alignItems: "center", gap: 8, padding: "9px 14px 4px", fontSize: 13 },
  logGroupSub: { display: "flex", flexWrap: "wrap", gap: 4, padding: "0 14px 8px 30px" },
  logSubChip: { fontSize: 11, color: "#888", background: "#f5f5f5", borderRadius: 10, padding: "2px 8px" },
  logDot: (c) => ({ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0 }),
  qtrDivider: { display: "flex", alignItems: "center", padding: "6px 14px", background: "#f5f5f5", borderBottom: "1px solid #e5e5e5", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em" },
  logActionBtn: (c) => ({ fontSize: 12, background: "none", border: `1px solid ${c || "#e5e5e5"}`, borderRadius: 4, padding: "2px 7px", cursor: "pointer", color: c || "#888", flexShrink: 0, lineHeight: 1.4 }),
  undoBtn: { fontSize: 11, fontWeight: 700, background: "#fff0ee", border: "1px solid #f0a0a0", borderRadius: 4, padding: "2px 6px", cursor: "pointer", color: "#c0392b", flexShrink: 0, letterSpacing: "0.03em" },
  emptyState: { textAlign: "center", padding: "40px 16px", color: "#aaa", fontSize: 14 },
  questionCard: { background: "#f7f7f7", borderRadius: 12, padding: "20px 20px 16px", marginBottom: 14 },
  questionText: { fontSize: 17, fontWeight: 500, textAlign: "center", marginBottom: 4 },
  questionSub: { fontSize: 13, color: "#888", textAlign: "center" },
  pendingBubble: (c) => ({ background: "#f7f7f7", borderLeft: `3px solid ${c}`, borderRadius: "0 8px 8px 0", padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#555" }),
  finalBanner: { background: "#1a1a1a", color: "#fff", borderRadius: 12, padding: "20px", textAlign: "center", marginBottom: 20 },
  editBanner: { background: "#fffbf0", border: "1px solid #e0d0a0", borderRadius: 8, padding: "8px 14px", marginBottom: 14, fontSize: 13, color: "#7a5c00", display: "flex", alignItems: "center", gap: 8 },
  timeConfirmBtn: { width: "100%", marginTop: 10, padding: 13, fontSize: 15, fontWeight: 500, border: "none", borderRadius: 10, background: "#111", color: "#fff", cursor: "pointer" },
  // Timeline styles
  timelineTable: { width: "100%", fontSize: 13, borderCollapse: "collapse" },
  timelineRow: (c) => ({ borderBottom: "1px solid #f0f0f0", background: "transparent" }),
};

// ── TimeKeypad ───────────────────────────────────────────────────────────────
function parseClockDigits(digits) {
  if (!digits) return { valid: false };
  if (!/^\d{1,4}$/.test(digits)) return { valid: false, error: "Enter up to 4 digits" };
  let minutes, seconds;
  if (digits.length <= 2) {
    minutes = 0;
    seconds = Number(digits);
  } else {
    seconds = Number(digits.slice(-2));
    minutes = Number(digits.slice(0, -2));
  }
  if (seconds > 59) return { valid: false, error: "Seconds must be 00–59" };
  const totalSeconds = minutes * 60 + seconds;
  return { valid: true, minutes, seconds, totalSeconds, label: `${minutes}:${String(seconds).padStart(2, "0")}` };
}

function timeStringToDigits(str) {
  const [m, s] = str.split(":").map(Number);
  return m === 0 ? String(s) : String(m) + String(s).padStart(2, "0");
}

function TimeKeypad({ maxSeconds, ceilingSecs, allowEqualToCeiling = false, onConfirm, showSameAsLatest = false, latestLabel = null }) {
  const [digits, setDigits] = useState("");
  const parsed = parseClockDigits(digits);
  const exceedsMax = parsed.valid && parsed.totalSeconds > maxSeconds;
  const violatesCeiling = parsed.valid && ceilingSecs != null && (
    allowEqualToCeiling ? parsed.totalSeconds > ceilingSecs : parsed.totalSeconds >= ceilingSecs
  );
  const canUse = parsed.valid && !exceedsMax && !violatesCeiling;

  const errorMsg = digits.length > 0 && !parsed.valid
    ? (parsed.error || "Invalid time")
    : exceedsMax
    ? `Max is ${Math.floor(maxSeconds / 60)}:${String(maxSeconds % 60).padStart(2, "0")}`
    : violatesCeiling
    ? `Must be ${allowEqualToCeiling ? "at or before" : "before"} ${Math.floor(ceilingSecs / 60)}:${String(ceilingSecs % 60).padStart(2, "0")}`
    : null;

  function pressDigit(d) {
    if (digits.length >= 4) return;
    setDigits(prev => prev + d);
  }

  const keyStyle = (special) => ({
    padding: "16px 0",
    fontSize: special ? 18 : 22,
    fontWeight: special ? 500 : 400,
    background: special ? "#f0f0f0" : "#f7f7f7",
    border: "1px solid #e8e8e8",
    borderRadius: 10,
    cursor: "pointer",
    color: "#111",
    fontFamily: "system-ui, sans-serif",
    userSelect: "none",
    WebkitUserSelect: "none",
  });

  return (
    <div style={{ marginTop: 12 }}>
      {/* Clock display */}
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 48, fontWeight: 300, letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums", color: canUse ? "#111" : digits.length > 0 ? "#111" : "#ccc" }}>
          {parsed.valid ? parsed.label : digits.length > 0 ? "—:——" : "--:--"}
        </span>
      </div>
      {/* Typed digits helper + error */}
      <div style={{ textAlign: "center", height: 18, marginBottom: 10 }}>
        {errorMsg
          ? <span style={{ fontSize: 12, color: "#c0392b" }}>{errorMsg}</span>
          : digits.length > 0
          ? <span style={{ fontSize: 12, color: "#aaa" }}>Typed: {digits}</span>
          : <span style={{ fontSize: 12, color: "#ddd" }}>Enter time remaining</span>}
      </div>
      {/* Same as latest shortcut */}
      {showSameAsLatest && latestLabel && (
        <button
          onClick={() => setDigits(timeStringToDigits(latestLabel))}
          style={{ width: "100%", marginBottom: 10, padding: "10px 0", fontSize: 13, fontWeight: 600, background: "#f0f8ff", border: "1px solid #c0d8f0", borderRadius: 10, cursor: "pointer", color: "#1a6bab" }}>
          Same as latest: {latestLabel}
        </button>
      )}
      {/* Keypad */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
        {[1,2,3,4,5,6,7,8,9].map(d => (
          <button key={d} style={keyStyle(false)} onClick={() => pressDigit(String(d))}>{d}</button>
        ))}
        <button style={keyStyle(true)} onClick={() => setDigits(prev => prev.slice(0, -1))}>⌫</button>
        <button style={keyStyle(false)} onClick={() => pressDigit("0")}>0</button>
        <button
          style={{ ...keyStyle(true), background: canUse ? "#111" : "#ccc", color: "#fff", fontWeight: 600, fontSize: 15 }}
          disabled={!canUse}
          onClick={() => canUse && onConfirm(parsed.label)}>
          Use
        </button>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function LaxStats({
  initialState = null,
  createdAt = null,
  onStateChange = null,
  onCancel = null,
  // v2 props — all optional; omit for v1 (schema_ver=1) games
  onEventCommit = null,      // async (stampedEntries) => void — write group to game_events
  onEventSoftDelete = null,  // async (groupId) => void — soft-delete group in game_events
  onMetaEvent = null,        // async (type, payload) => void — quarter/game state changes
  remoteEntries = null,      // [{...entry}] from other scorers; merged into local log
  scorekeeperRole = "primary", // "primary" | "secondary"
}) {
  const [screen, setScreen] = useState("setup"); // setup | track | stats | log
  const [trackingStarted, setTrackingStarted] = useState(false);
  const [teams, setTeams] = useState([{ name: "Home", roster: "", color: "#1a6bab" }, { name: "Away", roster: "", color: "#b84e1a" }]);
  const [parsedRosters, setParsedRosters] = useState([[], []]);
  const [log, setLog] = useState([]);
  const [currentQuarter, setCurrentQuarter] = useState(1);
  const [completedQuarters, setCompletedQuarters] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameDate, setGameDate] = useState(() => (createdAt ?? new Date().toISOString()).split("T")[0]);

  // Step machine:
  // team | event | player
  // ask_shot_outcome | save_player | blocked_player
  // ask_assist | assist_player | ask_goal_time
  // ask_forced_to_player
  // ask_penalty_type | ask_penalty_min | ask_penalty_nr | ask_penalty_time
  // endqtr | confirm_delete
  const [step, setStep] = useState("team");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [pendingEntries, setPendingEntries] = useState([]);
  const [penaltyType, setPenaltyType] = useState(null);
  const [penaltyFoulName, setPenaltyFoulName] = useState(null);
  const [penaltyNR, setPenaltyNR] = useState(false);

  const [lastGoalie, setLastGoalie] = useState([null, null]);
  const [lastFaceoffWinner, setLastFaceoffWinner] = useState([null, null]);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [deletingGroupId, setDeletingGroupId] = useState(null);
  const [lastEntry, setLastEntry] = useState(null);

  const [statsTab, setStatsTab] = useState("summary");
  const [statsQtr, setStatsQtr] = useState("all");
  const [sortKey, setSortKey] = useState("goal");

  // ── Supabase integration hooks ───────────────────────────────────
  const hydratedRef = useRef(false);
  // Ensure we only hydrate from initialState once per mount, even if the prop
  // value later changes (e.g. because Scorekeeper updates its local game copy).
  const didHydrateRef = useRef(false);

  // Hydrate from initialState when provided (e.g. loaded from Supabase).
  // initialState===undefined  → Scorekeeper is still loading, wait.
  // initialState===null       → new game with no saved state, mark ready immediately.
  // initialState==={...}      → existing game, hydrate then mark ready.
  useEffect(() => {
    if (didHydrateRef.current) return; // only ever hydrate once per mount
    if (initialState === undefined) return; // still loading
    didHydrateRef.current = true;

    if (initialState === null || !initialState.teams || !Array.isArray(initialState.log)) {
      // New game: nothing to restore, immediately allow onStateChange to fire
      hydratedRef.current = true;
      return;
    }
    hydratedRef.current = false; // pause change notifications during hydration
    setTeams(initialState.teams);
    setParsedRosters([
      parseRoster(initialState.teams[0].roster),
      parseRoster(initialState.teams[1].roster),
    ]);
    setLog(initialState.log);
    setCurrentQuarter(initialState.currentQuarter ?? 1);
    setCompletedQuarters(initialState.completedQuarters ?? []);
    setGameOver(initialState.gameOver ?? false);
    setTrackingStarted(initialState.trackingStarted ?? false);
    if (initialState.gameDate) setGameDate(initialState.gameDate);
    if (initialState._nextId) _nextId = initialState._nextId;
    setScreen(initialState.gameOver ? "stats" : initialState.trackingStarted ? "track" : "setup");
    resetEntry();
    // Mark as hydrated after this render cycle so the onStateChange effect
    // doesn't fire for the state-sets above
    setTimeout(() => { hydratedRef.current = true; }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialState]);

  // Notify parent of state changes (for Supabase save)
  useEffect(() => {
    if (!onStateChange || !hydratedRef.current) return;
    onStateChange({ version: 1, teams, log, currentQuarter, completedQuarters, gameOver, trackingStarted, gameDate, _nextId });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, teams, currentQuarter, completedQuarters, gameOver, trackingStarted, gameDate]);

  // v2: merge remote entries from other scorers into local log
  useEffect(() => {
    if (!remoteEntries?.length) return;
    setLog(prev => {
      const existingGroupIds = new Set(prev.map(e => e.groupId));
      const newGroupIds = new Set();
      const toAdd = [];
      for (const entry of remoteEntries) {
        if (!existingGroupIds.has(entry.groupId) && !newGroupIds.has(entry.groupId)) {
          newGroupIds.add(entry.groupId);
        }
        if (newGroupIds.has(entry.groupId)) toAdd.push(entry);
      }
      if (!toAdd.length) return prev;
      return [...prev, ...toAdd].sort((a, b) => (a.seq ?? a.id) - (b.seq ?? b.id));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteEntries]);

  const teamColors = [teams[0].color, teams[1].color];

  // ── Derived ─────────────────────────────────────────────────────
  const totalScores = useMemo(() => [
    log.filter(e => e.event === "goal" && e.teamIdx === 0).length,
    log.filter(e => e.event === "goal" && e.teamIdx === 1).length,
  ], [log]);

  const scoresByQuarter = useMemo(() => {
    const qs = {};
    log.filter(e => e.event === "goal").forEach(e => {
      if (!qs[e.quarter]) qs[e.quarter] = [0, 0];
      qs[e.quarter][e.teamIdx]++;
    });
    return qs;
  }, [log]);

  const allQuarters = useMemo(() => {
    const qs = new Set([...completedQuarters, currentQuarter]);
    return [...qs].sort((a, b) => a - b);
  }, [completedQuarters, currentQuarter]);

  const filteredLog = useMemo(() =>
    statsQtr === "all" ? log : log.filter(e => e.quarter === parseInt(statsQtr)),
    [log, statsQtr]
  );

  const playerStats = useMemo(() => buildPlayerStats(filteredLog), [filteredLog]);
  const teamTotals = useMemo(() => buildTeamTotals(filteredLog), [filteredLog]);
  const sortedPlayers = useMemo(() => [...playerStats].sort((a, b) => b[sortKey] - a[sortKey]), [playerStats, sortKey]);

  const shotPct  = (ti) => { const s = teamTotals[ti].shot,  g = teamTotals[ti].goal;        return s     ? `${Math.round((g/s)*100)}%` : "—"; };
  const sogPct   = (ti) => { const sog = teamTotals[ti].sog, g = teamTotals[ti].goal;         return sog   ? `${Math.round((g/sog)*100)}%` : "—"; };
  const clearPct = (ti) => { const c = teamTotals[ti].clear, f = teamTotals[ti].failed_clear; return (c+f) ? `${Math.round((c/(c+f))*100)}%` : "—"; };
  const emoPct   = (ti) => { const s = teamTotals[ti].emo_goal,    f = teamTotals[ti].emo_fail;  return (s+f) ? `${Math.round((s/(s+f))*100)}%` : "—"; };
  const mddPct   = (ti) => { const s = teamTotals[ti].mdd_success, f = teamTotals[ti].mdd_fail; return (s+f) ? `${Math.round((s/(s+f))*100)}%` : "—"; };
  const savePct = (ti) => {
    // Save % = saves / SOG faced (SOG by the opposing team)
    const sogFaced = teamTotals[1 - ti].sog;
    const saves = teamTotals[ti].shot_saved;
    return sogFaced ? `${Math.round((saves/sogFaced)*100)}%` : "—";
  };

  // Log groups for the event log view — preserve original log order, group by groupId
  const logGroups = useMemo(() => {
    const groups = {};
    const order = [];
    // Use the FULL log (not filteredLog) for the log tab — filter by quarter if needed
    const source = statsQtr === "all" ? log : log.filter(e => e.quarter === parseInt(statsQtr));
    source.forEach(e => {
      if (!groups[e.groupId]) { groups[e.groupId] = []; order.push(e.groupId); }
      groups[e.groupId].push(e);
    });
    return order.map(gid => groups[gid]);
  }, [log, statsQtr]);

  // All goals, timeouts, and penalties in chronological order for timeline
  const scoringTimeline = useMemo(() => {
    const source = statsQtr === "all" ? log : log.filter(e => e.quarter === parseInt(statsQtr));
    const groups = {};
    const order = [];
    source.forEach(e => {
      if (!groups[e.groupId]) { groups[e.groupId] = []; order.push(e.groupId); }
      groups[e.groupId].push(e);
    });
    return order
      .map(gid => groups[gid])
      .filter(g => g.some(e => e.event === "goal" || e.event === "timeout" || e.event === "penalty_tech" || e.event === "penalty_min"))
      .map(g => {
        const goal    = g.find(e => e.event === "goal");
        const timeout = g.find(e => e.event === "timeout");
        const penalty = g.find(e => e.event === "penalty_tech" || e.event === "penalty_min");
        if (goal)    return { type: "goal",    goal,    assist: g.find(e => e.event === "assist") };
        if (timeout) return { type: "timeout", timeout };
        return { type: "penalty", penalty };
      });
  }, [log, statsQtr]);

  const timeoutsLeft = useMemo(() => getTimeoutsLeft(log, currentQuarter), [log, currentQuarter]);

  function groupPrimary(group) {
    return group.find(e => e.event === "goal") || group.find(e => e.event === "shot") || group[0];
  }
  function getGroupById(gid) { return log.filter(e => e.groupId === gid); }

  // Build a human-readable summary of the original entry being edited
  function editContextSummary() {
    if (!editingGroupId) return null;
    const group = getGroupById(editingGroupId);
    if (!group.length) return null;
    const goal = group.find(e => e.event === "goal");
    const shot = group.find(e => e.event === "shot");
    const assist = group.find(e => e.event === "assist");
    const save = group.find(e => e.event === "shot_saved");
    const fto = group.find(e => e.event === "forced_to");
    const to = group.find(e => e.event === "turnover");
    const tech = group.find(e => e.event === "penalty_tech");
    const pfoul = group.find(e => e.event === "penalty_min");
    const primary = groupPrimary(group);
    const teamName = teams[primary.teamIdx]?.name;
    const playerStr = primary.player ? `#${primary.player.num} ${primary.player.name}` : teamName;

    if (goal) {
      let s = `🥍 Goal — ${playerStr} · ${teamName}`;
      if (assist) s += ` · assist: #${assist.player?.num} ${assist.player?.name}`;
      if (goal.emo) s += " · EMO";
      if (goal.goalTime) s += ` · ${goal.goalTime}`;
      return s;
    }
    if (shot) {
      let s = `🎯 Shot — ${playerStr} · ${teamName}`;
      if (save) s += ` · saved by #${save.player?.num}`;
      return s;
    }
    if (fto) return `🥊 Forced TO — ${playerStr} · ${teamName} → #${to?.player?.num} ${to?.player?.name}`;
    if (tech) return `🟨 ${tech.foulName ? `${tech.foulName} (Technical)` : "Technical foul"} — ${playerStr} · ${teamName}`;
    if (pfoul) return `🟥 ${pfoul.foulName ? `${pfoul.foulName} (${pfoul.penaltyMin}min)` : `Personal foul (${pfoul.penaltyMin}min)`} — ${playerStr} · ${teamName}`;
    const { icon, label } = entryDisplayInfo(primary);
    return `${icon} ${label} — ${playerStr} · ${teamName}`;
  }

  // ── Helpers ─────────────────────────────────────────────────────
  function mkEntry(teamIdx, event, player, extra = {}) {
    return { id: nextId(), teamIdx, event, player: player || null, quarter: currentQuarter, groupId: null, ...extra };
  }

  function resetEntry() {
    setStep("team");
    setSelectedTeam(null);
    setSelectedEvent(null);
    setSelectedPlayer(null);
    setPendingEntries([]);
    setPenaltyType(null);
    setPenaltyNR(false);
    setEditingGroupId(null);
    setDeletingGroupId(null);
  }

  function commitEntries(entries, flashText) {
    // v2: use UUID so it can serve as the DB group_id
    const gid = onEventCommit ? crypto.randomUUID() : nextId();
    const isEdit = editingGroupId !== null;

    let stamped;
    if (isEdit) {
      // Preserve the original quarter for each entry — look up from existing group
      const origGroup = getGroupById(editingGroupId);
      const origQuarter = origGroup[0]?.quarter ?? currentQuarter;
      stamped = entries.map(e => ({ ...e, groupId: gid, quarter: origQuarter }));
    } else {
      stamped = entries.map(e => ({ ...e, groupId: gid }));
    }

    let newLog;
    if (isEdit) {
      const insertIdx = log.findIndex(e => e.groupId === editingGroupId);
      const without = log.filter(e => e.groupId !== editingGroupId);
      if (insertIdx >= 0) {
        const adj = log.slice(0, insertIdx).filter(e => e.groupId !== editingGroupId).length;
        newLog = [...without.slice(0, adj), ...stamped, ...without.slice(adj)];
      } else {
        newLog = [...without, ...stamped];
      }
    } else {
      newLog = [...log, ...stamped];
    }
    setLog(newLog);

    // v2: write to game_events (fire-and-forget; optimistic state already applied)
    if (onEventCommit) {
      onEventCommit(stamped).catch(err => console.error("[LaxStats] onEventCommit:", err));
    }

    // Only update the "last entry" banner for NEW entries, not edits
    if (!isEdit) {
      setLastEntry({ text: flashText, count: stamped.length, groupId: gid });
    }

    // Only trigger OT game-ending for new goal entries
    if (!isEdit && isOT(currentQuarter) && entries.some(e => e.event === "goal")) {
      setCompletedQuarters(prev => [...prev, currentQuarter]);
      setGameOver(true);
      setScreen("stats");
      setStatsTab("summary");
      setStatsQtr("all");
      if (onMetaEvent) onMetaEvent("gameOver", { quarter: currentQuarter }).catch(console.error);
      resetEntry();
      return;
    }
    resetEntry();
  }

  function startEdit(gid) {
    const group = getGroupById(gid);
    const goalEntry = group.find(e => e.event === "goal");
    const shotEntry = group.find(e => e.event === "shot");
    const primary = goalEntry || shotEntry || group[0];
    const ev = EVENTS.find(e => e.id === primary.event) || { id: primary.event, label: primary.event, icon: "•" };

    setEditingGroupId(gid);
    setSelectedTeam(primary.teamIdx);

    if (goalEntry) setSelectedEvent(EVENTS.find(e => e.id === "goal"));
    else if (shotEntry) setSelectedEvent(EVENTS.find(e => e.id === "shot"));
    else setSelectedEvent(ev);

    setSelectedPlayer(primary.player);
    // (goalTime is stored on the entry; TimeKeypad reads it via latestLabel if needed)
    setScreen("track");
    // Team stats (clear, failed_clear) have no player — go to event picker so
    // user can change team or event type, and it will commit immediately on tap
    if (ev.teamStat) {
      setStep("event");
    } else {
      setStep("player");
    }
  }

  // ── Saved teams (for setup screen loader) ───────────────────────
  const [savedTeams, setSavedTeams] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setCurrentUserId(session?.user?.id ?? null));
    supabase.from("saved_teams").select("id, name, roster, color, user_id").order("name")
      .then(({ data }) => { if (data) setSavedTeams(data); });
  }, []);

  // ── Export / Import ─────────────────────────────────────────────
  const [exportCopied, setExportCopied] = useState(false);
  const [exportJson, setExportJson] = useState(null);
  const [importJson, setImportJson] = useState("");
  const [importError, setImportError] = useState("");
  const [showImport, setShowImport] = useState(false);

  function handleExport() {
    const state = {
      version: 1,
      exportedAt: new Date().toISOString(),
      teams,
      currentQuarter,
      completedQuarters,
      gameOver,
      log,
      _nextId,
    };
    const json = JSON.stringify(state, null, 2);
    setExportJson(json);
    setShowImport(false);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).then(() => {
        setExportCopied(true);
        setTimeout(() => setExportCopied(false), 3000);
      }).catch(() => {});
    }
  }

  function handleImportJson() {
    setImportError("");
    try {
      const state = JSON.parse(importJson);
      if (!state.teams || !Array.isArray(state.log)) {
        setImportError("Invalid — missing required fields (teams, log).");
        return;
      }
      setTeams(state.teams);
      setParsedRosters([
        parseRoster(state.teams[0].roster),
        parseRoster(state.teams[1].roster),
      ]);
      setLog(state.log);
      setCurrentQuarter(state.currentQuarter ?? 1);
      setCompletedQuarters(state.completedQuarters ?? []);
      setGameOver(state.gameOver ?? false);
      if (state._nextId) _nextId = state._nextId;
      setImportJson("");
      setShowImport(false);
      resetEntry();
      setScreen("stats");
    } catch {
      setImportError("Could not parse JSON. Make sure you pasted the full export.");
    }
  }

  function handleCsvRoster(file, ti) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      // Parse CSV: supports "number,name" or "name,number" or just one column with name/number
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      // Parse every row — no header detection, just skip rows that yield nothing useful
      const parsed = lines.map(line => {
        const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        // Try to find number (numeric or #N) and name among columns
        let num = "", name = "";
        cols.forEach(col => {
          const cleaned = col.replace(/^#/, "");
          if (/^\d+$/.test(cleaned) && !num) num = cleaned;
          else if (col && !name) name = col;
        });
        // If only one column, treat it as "num name" or "name"
        if (cols.length === 1) {
          const m = cols[0].match(/^#?(\d+)\s+(.+)$/) || cols[0].match(/^(.+)\s+#?(\d+)$/);
          if (m) { num = /^\d+$/.test(m[1]) ? m[1] : m[2]; name = /^\d+$/.test(m[1]) ? m[2] : m[1]; }
          else name = cols[0];
        }
        return num || name ? `#${num} ${name}`.trim() : null;
      }).filter(Boolean);

      if (!parsed.length) { alert("No players found in CSV. Expected columns: number, name."); return; }
      const rosterText = parsed.join("\n");
      setTeams(t => t.map((x, i) => i === ti ? { ...x, roster: rosterText } : x));
    };
    reader.readAsText(file);
  }

  // ── Event flow ──────────────────────────────────────────────────
  function handleStart() {
    if (gameOver) return;
    const r0 = parseRoster(teams[0].roster), r1 = parseRoster(teams[1].roster);
    if (r0.length < 10 || r1.length < 10) return;
    setParsedRosters([r0, r1]);
    setTrackingStarted(true);
    setScreen("track");
    resetEntry();
  }

  function handlePlayerSelected(player) {
    setSelectedPlayer(player);
    const ev = selectedEvent;
    if (ev.id === "shot") {
      setPendingEntries([mkEntry(selectedTeam, "shot", player)]);
      setStep("ask_shot_outcome");
    } else if (ev.id === "goal") {
      setPendingEntries([mkEntry(selectedTeam, "shot", player), mkEntry(selectedTeam, "goal", player)]);
      setStep("ask_assist");
    } else if (ev.id === "forced_to") {
      setPendingEntries([mkEntry(selectedTeam, "forced_to", player)]);
      setStep("ask_forced_to_player");
    } else if (ev.id === "penalty") {
      setStep("ask_penalty_type");
    } else {
      if (ev.id === "faceoff_win") {
        setLastFaceoffWinner(prev => prev.map((v, i) => i === selectedTeam ? player : v));
      }
      commitEntries([mkEntry(selectedTeam, ev.id, player)], `${ev.label} — #${player.num} ${player.name}`);
    }
  }

  // Goal flow: assist → time (EMO auto-detected from penalty box at goal time)
  function handleAssistNo() { setStep("ask_goal_time"); }
  function handleAssistYes() { setStep("assist_player"); }
  function handleAssistPlayerSelected(assister) {
    setPendingEntries(prev => [...prev, mkEntry(selectedTeam, "assist", assister)]);
    setStep("ask_goal_time");
  }
  function handleGoalTime(t) {
    // Auto-detect EMO: is the defending team net shorthanded at goal time?
    const absGoal = absElapsedSecs(currentQuarter, toSecs(t));

    // Goals already in the log that may have released releasable windows before this goal
    const priorGoals = log
      .filter(g => g.event === "goal" && g.goalTime)
      .map(g => ({ teamIdx: g.teamIdx, absTime: absElapsedSecs(g.quarter, toSecs(g.goalTime)) }));

    function isReleasedByPriorGoal(penTeamIdx, absStart, absEnd) {
      return priorGoals.some(g => g.teamIdx !== penTeamIdx && g.absTime >= absStart && g.absTime < absEnd);
    }

    const windows = computePenaltyWindows(log);
    let scoringInBox = 0, defendingInBox = 0;
    for (const w of windows) {
      if (absGoal < w.absStart || absGoal >= w.absEnd) continue;
      if (absGoal < w.nrEnd) {
        // NR phase: in box, cannot be released
        if (w.entry.teamIdx === selectedTeam) scoringInBox++;
        else defendingInBox++;
      } else {
        // Releasable phase: in box unless already goal-released by a prior goal in [nrEnd, absGoal)
        const released = isReleasedByPriorGoal(w.entry.teamIdx, w.nrEnd, absGoal);
        if (!released) {
          if (w.entry.teamIdx === selectedTeam) scoringInBox++;
          else defendingInBox++;
        }
      }
    }

    const isEmo = defendingInBox > scoringInBox;
    const entries = pendingEntries.map(e => e.event === "goal" ? { ...e, goalTime: t, emo: isEmo || undefined } : e);
    const assister = entries.find(e => e.event === "assist");
    commitEntries(entries, `Goal${isEmo ? " (EMO)" : ""} — #${selectedPlayer.num} ${selectedPlayer.name}${assister ? ` (assist #${assister.player?.num})` : ""}`);
  }

  // Shot flow: outcome picker → optional player picker
  function handleShotOutcome(outcome) {
    if (outcome === "missed") {
      commitEntries(pendingEntries, `Shot — #${selectedPlayer.num} ${selectedPlayer.name}`);
    } else if (outcome === "post") {
      commitEntries([...pendingEntries, mkEntry(selectedTeam, "shot_post", selectedPlayer)], `Shot off post — #${selectedPlayer.num} ${selectedPlayer.name}`);
    } else if (outcome === "saved") {
      setStep("save_player");
    } else if (outcome === "blocked") {
      setStep("blocked_player");
    }
  }
  function handleSavePlayerSelected(goalie) {
    setLastGoalie(prev => prev.map((g, i) => i === (1 - selectedTeam) ? goalie : g));
    commitEntries([...pendingEntries, mkEntry(1 - selectedTeam, "shot_saved", goalie)], `Shot (saved) — #${selectedPlayer.num} ${selectedPlayer.name} · saved by #${goalie.num} ${goalie.name}`);
  }
  function handleBlockerSelected(blockingPlayer) {
    commitEntries([...pendingEntries, mkEntry(1 - selectedTeam, "shot_blocked", blockingPlayer)], `Shot blocked — #${selectedPlayer.num} ${selectedPlayer.name} · blocked by #${blockingPlayer.num} ${blockingPlayer.name}`);
  }

  // Forced TO flow: pick the opposing player who turned it over
  function handleForcedToPlayerSelected(victim) {
    const entries = [...pendingEntries, mkEntry(1 - selectedTeam, "turnover", victim)];
    commitEntries(entries, `Forced TO — #${selectedPlayer.num} ${selectedPlayer.name} → TO by #${victim.num} ${victim.name}`);
  }

  // Penalty flow — consecutive and simultaneous relationships are auto-derived from the log
  function handlePenaltyFoul(option) {
    setPenaltyFoulName(option.name);
    if (option.type === "tech") {
      setPenaltyType("tech");
      setPendingEntries([mkEntry(selectedTeam, "penalty_tech", selectedPlayer, { foulName: option.name })]);
      setStep("ask_penalty_time");
    } else {
      setPenaltyType("personal");
      setPenaltyNR(false);
      setStep("ask_penalty_min");
    }
  }
  function handlePenaltyMin(mins) {
    setPendingEntries([mkEntry(selectedTeam, "penalty_min", selectedPlayer, { penaltyMin: mins, foulName: penaltyFoulName })]);
    setStep("ask_penalty_nr");
  }
  function handlePenaltyNR(isNR) {
    setPenaltyNR(isNR);
    setStep("ask_penalty_time");
  }
  function handlePenaltyTime(t) {
    const entries = pendingEntries.map(e =>
      (e.event === "penalty_tech" || e.event === "penalty_min") ? {
        ...e,
        penaltyTime: t,
        ...(penaltyNR ? { nonReleasable: true } : {}),
      } : e
    );
    const e0 = entries[0];
    const nrTag = penaltyNR ? " NR" : "";
    const label = e0.event === "penalty_tech"
      ? `${e0.foulName || "Technical foul"} (Technical) — #${selectedPlayer.num} ${selectedPlayer.name}`
      : `${e0.foulName || "Personal foul"} (${e0.penaltyMin}min${nrTag}) — #${selectedPlayer.num} ${selectedPlayer.name}`;
    commitEntries(entries, label);
  }

  function handleEndQuarter() {
    const tied = totalScores[0] === totalScores[1];
    setCompletedQuarters(prev => [...prev, currentQuarter]);
    if (currentQuarter === 4 && !tied) {
      setGameOver(true); setScreen("stats"); setStatsTab("summary"); setStatsQtr("all");
      if (onMetaEvent) onMetaEvent("gameOver", { quarter: currentQuarter }).catch(console.error);
    } else {
      const ended = currentQuarter;
      setCurrentQuarter(prev => prev + 1);
      setScreen("stats"); setStatsTab("summary"); setStatsQtr(String(ended));
      if (onMetaEvent) onMetaEvent("endQuarter", { quarter: ended }).catch(console.error);
    }
    resetEntry();
  }

  function handleDeleteGroup(gid) {
    setLog(prev => prev.filter(e => e.groupId !== gid));
    setDeletingGroupId(null);
    if (lastEntry?.groupId === gid) setLastEntry(null);
    if (onEventSoftDelete) onEventSoftDelete(gid).catch(err => console.error("[LaxStats] onEventSoftDelete:", err));
  }

  const curQLabel = qLabel(currentQuarter);
  const qSummaryStats = (ti, q) => buildTeamTotals(log.filter(e => e.quarter === q && e.teamIdx === ti))[ti];

  function prevPlayerInGroup(gid, ti) {
    return getGroupById(gid).find(e => e.teamIdx === ti && !e.teamStat)?.player || null;
  }

  // Global time ceiling: the lowest "time remaining" recorded in the current quarter
  // across ALL timed events (goals, timeouts, penalties). Any new timed entry must be strictly less.
  const timeCeilingSecs = useMemo(() => {
    const timedEntries = log.filter(e =>
      e.quarter === currentQuarter &&
      (e.goalTime || e.timeoutTime || e.penaltyTime) &&
      (editingGroupId === null || e.groupId !== editingGroupId)
    );
    if (!timedEntries.length) return null;
    return Math.min(...timedEntries.map(e => toSecs(e.goalTime || e.timeoutTime || e.penaltyTime)));
  }, [log, currentQuarter, editingGroupId]);

  // Penalty box: active penalties only, with time-based and goal-based expiry
  const penaltyBoxEntries = useMemo(() => {
    const fmt = secs => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

    const absCurrentTime = timeCeilingSecs !== null
      ? absElapsedSecs(currentQuarter, timeCeilingSecs)
      : absElapsedSecs(currentQuarter, qLenSecs(currentQuarter));

    const loggedGoals = log
      .filter(g => g.event === "goal" && g.goalTime)
      .map(g => ({ teamIdx: g.teamIdx, absTime: absElapsedSecs(g.quarter, toSecs(g.goalTime)) }));

    function wasGoalReleased(penTeamIdx, absStart, absEnd) {
      return loggedGoals.some(g => g.teamIdx !== penTeamIdx && g.absTime >= absStart && g.absTime < absEnd);
    }

    const windows = computePenaltyWindows(log);

    // Chain release: if a releasable window is goal-released, every subsequent window
    // in the same player's consecutive chain is also released immediately.
    const chainReleasedSet = new Set();
    const byPlayerKey = new Map();
    for (const w of windows) {
      const key = `${w.entry.teamIdx}:${w.entry.player?.num ?? w.entry.id}`;
      if (!byPlayerKey.has(key)) byPlayerKey.set(key, []);
      byPlayerKey.get(key).push(w);
    }
    for (const chain of byPlayerKey.values()) {
      // Sort by absStart so we process windows in serving order
      chain.sort((a, b) => a.absStart - b.absStart);
      // Only propagate chain release to windows that directly follow (absStart === prevAbsEnd),
      // which is the hallmark of consecutive fouls from the same dead-ball cycle.
      // Independent penalties from separate cycles start at their own absPen, not at a prior window's end.
      let chainActive = false;
      let prevAbsEnd = null;
      for (const w of chain) {
        const directlyFollows = prevAbsEnd !== null && w.absStart === prevAbsEnd;
        if (chainActive && directlyFollows) {
          chainReleasedSet.add(w);
        } else {
          chainActive = false;
          if (!w.isNRBase && wasGoalReleased(w.entry.teamIdx, w.nrEnd, w.absEnd)) {
            chainActive = true;
          }
        }
        prevAbsEnd = w.absEnd;
      }
    }

    const rows = [];

    for (const w of windows) {
      if (chainReleasedSet.has(w)) continue;
      const { entry: e, absStart, absEnd, nrEnd } = w;
      const hasNRPhase  = nrEnd > absStart;
      const hasRelPhase = nrEnd < absEnd;

      // Is there a window for the same player that starts before this one and is still active?
      const prevWindowActive = windows.some(other => {
        if (other === w) return false;
        if (other.entry.player?.num !== e.player?.num) return false;
        if (other.entry.teamIdx !== e.teamIdx) return false;
        if (other.absStart >= absStart) return false;
        if (chainReleasedSet.has(other)) return false;                 // chain-released = not active
        if (absCurrentTime >= other.absEnd) return false;              // time-expired
        if (other.nrEnd <= other.absStart) return !wasGoalReleased(e.teamIdx, other.absStart, other.absEnd);
        if (absCurrentTime < other.nrEnd) return true;
        if (other.nrEnd < other.absEnd) return !wasGoalReleased(e.teamIdx, other.nrEnd, other.absEnd);
        return true;
      });

      if (hasNRPhase) {
        const nrExpired = absCurrentTime >= nrEnd;
        if (!nrExpired) {
          const { q, remainSecs } = absSecsToQtrTime(nrEnd);
          rows.push({
            color: teams[e.teamIdx]?.color, num: e.player?.num, teamIdx: e.teamIdx,
            nonReleasable: true,
            releaseQ: q, crossQuarter: q !== e.quarter, releaseTime: fmt(remainSecs),
            isNested: prevWindowActive,
          });
        }
        if (hasRelPhase) {
          const relExpired = absCurrentTime >= absEnd;
          const relReleased = wasGoalReleased(e.teamIdx, nrEnd, absEnd);
          const nrPhaseStillActive = absCurrentTime < nrEnd;
          if (!relExpired && !relReleased) {
            const { q, remainSecs } = absSecsToQtrTime(absEnd);
            rows.push({
              color: teams[e.teamIdx]?.color, num: e.player?.num, teamIdx: e.teamIdx,
              nonReleasable: false,
              releaseQ: q, crossQuarter: q !== e.quarter, releaseTime: fmt(remainSecs),
              isNested: prevWindowActive || nrPhaseStillActive,
            });
          }
        }
      } else {
        // Fully releasable window (no NR phase)
        const expired = absCurrentTime >= absEnd;
        const released = wasGoalReleased(e.teamIdx, absStart, absEnd);
        if (!expired && !released) {
          const { q, remainSecs } = absSecsToQtrTime(absEnd);
          rows.push({
            color: teams[e.teamIdx]?.color, num: e.player?.num, teamIdx: e.teamIdx,
            nonReleasable: false,
            releaseQ: q, crossQuarter: q !== e.quarter, releaseTime: fmt(remainSecs),
            isNested: prevWindowActive,
          });
        }
      }
    }

    return rows;
  }, [log, currentQuarter, teams, timeCeilingSecs]);

  // Pending bubble helper — build context summary line
  function pendingContext() {
    const g = pendingEntries.find(e => e.event === "goal");
    const assist = pendingEntries.find(e => e.event === "assist");
    let s = `🥍 Goal — #${selectedPlayer?.num} ${selectedPlayer?.name} · ${teams[selectedTeam]?.name}`;
    if (assist) s += ` · assist: #${assist.player?.num}`;
    if (g?.emo) s += " · EMO";
    return s;
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div style={S.app}>
      {/* Nav: Setup | Track | Stats | Log */}
      <div style={S.nav}>
        {[
          { id: "setup", label: "Setup" },
          { id: "track", label: "Track", disabled: !parsedRosters[0].length || gameOver },
          { id: "stats", label: "Stats" },
          { id: "log",   label: "Event Log" },
        ].map(({ id, label, disabled }) => (
          <button key={id} style={S.navBtn(screen === id, disabled)}
            onClick={() => { if (!disabled) setScreen(id); }}>
            {label}
          </button>
        ))}
      </div>

      {/* ══ SETUP ══ */}
      {screen === "setup" && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Game Date</div>
            {trackingStarted ? (
              <div style={{ fontSize: 14, color: "#111", padding: "8px 0" }}>
                {new Date(gameDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </div>
            ) : (
              <input
                type="date"
                value={gameDate}
                onChange={e => setGameDate(e.target.value)}
                style={{ padding: "8px 10px", fontSize: 14, border: "1px solid #e0e0e0", borderRadius: 8, fontFamily: "system-ui, sans-serif", color: "#111", background: "#fff" }}
              />
            )}
          </div>
          <div style={S.setupGrid}>
            {[0, 1].map(ti => (
              <div key={ti} style={S.setupCard(teams[ti].color)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={S.teamLabel(teams[ti].color)}>{ti === 0 ? "Home" : "Away"}</div>
                  {savedTeams.length > 0 && (
                    <select
                      style={{ fontSize: 11, color: teams[ti].color, border: "1px solid #e5e5e5", borderRadius: 6, padding: "3px 6px", background: "#fafafa", cursor: "pointer", maxWidth: 120 }}
                      defaultValue=""
                      onChange={e => {
                        const saved = savedTeams.find(t => t.id === e.target.value);
                        if (!saved) return;
                        setTeams(t => t.map((x, i) => i === ti ? { ...x, name: saved.name, roster: saved.roster, color: saved.color } : x));
                        e.target.value = "";
                      }}>
                      <option value="" disabled>Load saved…</option>
                      {savedTeams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}{currentUserId && t.user_id !== currentUserId ? " (shared)" : ""}</option>
                      ))}
                    </select>
                  )}
                </div>
                <input style={S.textInput} placeholder={ti === 0 ? "Home team name" : "Away team name"}
                  value={teams[ti].name} onChange={e => setTeams(t => t.map((x, i) => i === ti ? { ...x, name: e.target.value } : x))} />
                <div style={{ marginBottom: 4, fontSize: 11, color: "#888" }}>Team color</div>
                <div style={S.colorRow}>
                  {PRESET_COLORS.map(c => <div key={c} style={S.colorSwatch(c, teams[ti].color === c)} onClick={() => setTeams(t => t.map((x, i) => i === ti ? { ...x, color: c } : x))} />)}
                  <input type="color" style={S.colorPickerInput} value={teams[ti].color} onChange={e => setTeams(t => t.map((x, i) => i === ti ? { ...x, color: e.target.value } : x))} />
                </div>
                <textarea style={S.textarea} placeholder={"#2 First Last\n#7 First Last\n#11 First Last"}
                  value={teams[ti].roster} onChange={e => setTeams(t => t.map((x, i) => i === ti ? { ...x, roster: e.target.value } : x))} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <div style={S.hint}>One player per line — #number Name</div>
                  <label style={{ fontSize: 11, color: teamColors[ti], fontWeight: 600, cursor: "pointer", flexShrink: 0, marginLeft: 8 }}>
                    Upload CSV
                    <input type="file" accept=".csv,text/csv" style={{ display: "none" }}
                      onChange={e => { handleCsvRoster(e.target.files[0], ti); e.target.value = ""; }} />
                  </label>
                </div>
                {teams[ti].roster && (() => {
                  const players = parseRoster(teams[ti].roster);
                  const dupes = findDuplicateNums(teams[ti].roster);
                  return (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{players.length} player{players.length !== 1 ? "s" : ""}</div>
                      {players.slice(0, 5).map((p, i) => <span key={i} style={S.chip}><span style={S.chipNum}>#{p.num}</span>{p.name}</span>)}
                      {players.length > 5 && <span style={S.chip}>+{players.length - 5} more</span>}
                      {dupes.length > 0 && (
                        <div style={{ fontSize: 11, color: "#c0392b", marginTop: 6, fontWeight: 500 }}>
                          Duplicate number{dupes.length > 1 ? "s" : ""}: {dupes.join(", ")}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
          {(() => {
            const r0len = parseRoster(teams[0].roster).length;
            const r1len = parseRoster(teams[1].roster).length;
            const dupes0 = findDuplicateNums(teams[0].roster);
            const dupes1 = findDuplicateNums(teams[1].roster);
            const hasDupes = dupes0.length > 0 || dupes1.length > 0;
            const ready = r0len >= 10 && r1len >= 10 && !hasDupes && !gameOver;
            const hasAny = r0len > 0 || r1len > 0;
            return (
              <>
                <button style={S.startBtn(!ready)} disabled={!ready} onClick={handleStart}>
                  {gameOver ? "Game Finalized" : "Start Tracking →"}
                </button>
                {!gameOver && hasAny && !ready && (
                  <div style={{ fontSize: 12, color: hasDupes ? "#c0392b" : "#aaa", textAlign: "center", marginTop: 8 }}>
                    {hasDupes
                      ? "Fix duplicate numbers before starting"
                      : <>Both teams need at least 10 players{r0len > 0 && r1len > 0 ? ` (${teams[0].name}: ${r0len}, ${teams[1].name}: ${r1len})` : ""}</>
                    }
                  </div>
                )}
              </>
            );
          })()}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button style={{ flex: 1, padding: "11px", fontSize: 14, fontWeight: 500, border: "1px solid #ddd", borderRadius: 10, color: showImport ? "#111" : "#555", cursor: "pointer", background: showImport ? "#f0f0f0" : "#f7f7f7" }}
              onClick={() => { setShowImport(v => !v); setExportJson(null); setImportError(""); }}>
              {showImport ? "Cancel Import" : "Import game (JSON)"}
            </button>
            {log.length > 0 && (
              <button style={{ flex: 1, padding: "11px", fontSize: 14, fontWeight: 500, border: "1px solid #ddd", borderRadius: 10, color: exportCopied ? "#2a7a3b" : "#555", cursor: "pointer", background: exportCopied ? "#eaf3de" : "#f7f7f7" }}
                onClick={handleExport}>
                {exportCopied ? "✓ Copied!" : "Export game (JSON)"}
              </button>
            )}
          </div>
          {onCancel && !trackingStarted && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button style={{ fontSize: 13, color: "#c0392b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                onClick={onCancel}>
                Discard game
              </button>
            </div>
          )}

          {/* Import panel */}
          {showImport && (
            <div style={{ marginTop: 10, background: "#f7f7f7", border: "1px solid #e5e5e5", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Paste exported JSON below, then tap Load:</div>
              <textarea
                value={importJson}
                onChange={e => { setImportJson(e.target.value); setImportError(""); }}
                placeholder='{ "version": 1, "teams": [...], ... }'
                style={{ width: "100%", height: 120, fontSize: 11, fontFamily: "monospace", border: "1px solid #ddd", borderRadius: 8, padding: 10, background: "#fff", color: "#444", resize: "none", boxSizing: "border-box" }}
              />
              {importError && <div style={{ fontSize: 12, color: "#c0392b", marginTop: 6 }}>{importError}</div>}
              <button style={{ width: "100%", marginTop: 8, padding: "10px", fontSize: 14, fontWeight: 500, background: importJson.trim() ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 8, cursor: importJson.trim() ? "pointer" : "not-allowed" }}
                disabled={!importJson.trim()} onClick={handleImportJson}>
                Load game →
              </button>
            </div>
          )}

          {/* Export panel */}
          {exportJson && !showImport && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: exportCopied ? "#2a7a3b" : "#888" }}>
                  {exportCopied ? "✓ Copied to clipboard — also available below" : "Tap the textarea to select all, then copy"}
                </div>
                <button style={{ fontSize: 12, color: "#555", background: "none", border: "1px solid #ddd", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}
                  onClick={() => setExportJson(null)}>Dismiss</button>
              </div>
              <textarea
                readOnly
                value={exportJson}
                onFocus={e => e.target.select()}
                onClick={e => e.target.select()}
                style={{ width: "100%", height: 140, fontSize: 11, fontFamily: "monospace", border: "1px solid #ddd", borderRadius: 8, padding: 10, background: "#f7f7f7", color: "#444", resize: "none", boxSizing: "border-box" }}
              />
            </div>
          )}
        </div>
      )}

      {/* ══ TRACK ══ */}
      {screen === "track" && (
        <div>
          {/* Persistent last-entry banner */}
          {lastEntry && step === "team" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f0f0f0", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13 }}>
              <span style={{ flex: 1, color: "#444" }}><span style={{ fontWeight: 500, color: "#888", marginRight: 6 }}>Last entry:</span>{lastEntry.text}</span>
              <button style={S.undoBtn} onClick={() => {
                const gid = lastEntry.groupId;
                setLog(prev => prev.filter(e => e.groupId !== gid));
                setLastEntry(null);
                if (onEventSoftDelete) onEventSoftDelete(gid).catch(err => console.error("[LaxStats] undo softDelete:", err));
              }}>undo</button>
            </div>
          )}

          {editingGroupId && (
            <div style={{ background: "#fffbf0", border: "1px solid #e0d0a0", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#7a5c00", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>✏️ Editing entry</div>
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>{editContextSummary()}</div>
              <button style={{ fontSize: 11, color: "#7a5c00", background: "none", border: "none", cursor: "pointer", padding: "4px 0 0", textDecoration: "underline" }} onClick={resetEntry}>cancel edit</button>
            </div>
          )}

          {/* Team select */}
          {step === "team" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={S.qtrPill}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: isOT(currentQuarter) ? "#e67e22" : "#4caf50", display: "inline-block" }}></span>
                  {curQLabel} — Live
                </div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>
                  <span style={{ color: teamColors[0] }}>{totalScores[0]}</span>
                  <span style={{ margin: "0 8px", color: "#ccc" }}>—</span>
                  <span style={{ color: teamColors[1] }}>{totalScores[1]}</span>
                </div>
              </div>
              {isOT(currentQuarter) && <div style={{ fontSize: 12, color: "#e67e22", background: "#fff8f0", border: "1px solid #f0d9b5", borderRadius: 8, padding: "6px 12px", marginBottom: 12, textAlign: "center" }}>Sudden death — next goal wins</div>}
              <div style={S.stepLabel}>Who scored / acted?</div>
              <div style={S.teamBtns}>
                {[0, 1].map(ti => (
                  <button key={ti} style={S.teamBigBtn(teamColors[ti], ti === 0)} onClick={() => { setSelectedTeam(ti); setStep("event"); }}>
                    <span style={{ fontSize: 36, fontWeight: 600, display: "block", marginBottom: 4, color: ti === 0 ? teamColors[0] : "#fff" }}>{totalScores[ti]}</span>
                    <span style={{ fontSize: 13, color: ti === 0 ? teamColors[0] : "rgba(255,255,255,0.8)" }}>{teams[ti].name}</span>
                    <span style={{ fontSize: 13, marginTop: 6, display: "block", opacity: 0.8, color: ti === 0 ? teamColors[0] : "#fff", fontWeight: 500 }}>
                      ⏸ {timeoutsLeft[ti]} timeout{timeoutsLeft[ti] !== 1 ? "s" : ""} left
                    </span>
                  </button>
                ))}
              </div>
              {/* Penalty box */}
              {penaltyBoxEntries.length > 0 && (
                <div style={{ marginTop: 16, border: "1px solid #e8e8e8", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 14px", background: "#f9f9f9", borderBottom: "1px solid #e8e8e8" }}>
                    Penalty Box
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#fafafa" }}>
                        <th style={{ padding: "6px 14px", textAlign: "left", fontWeight: 600, color: "#888", fontSize: 11, borderBottom: "1px solid #f0f0f0" }}>Team</th>
                        <th style={{ padding: "6px 14px", textAlign: "left", fontWeight: 600, color: "#888", fontSize: 11, borderBottom: "1px solid #f0f0f0" }}>Player</th>
                        <th style={{ padding: "6px 14px", textAlign: "right", fontWeight: 600, color: "#888", fontSize: 11, borderBottom: "1px solid #f0f0f0" }}>Releases at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {penaltyBoxEntries.map((entry, i) => (
                        <tr key={i} style={{ borderBottom: i < penaltyBoxEntries.length - 1 ? "1px solid #f5f5f5" : "none", background: entry.isNested ? "#fafafa" : "#fff" }}>
                          <td style={{ padding: entry.isNested ? "5px 14px 5px 26px" : "8px 14px" }}>
                            {entry.isNested
                              ? <span style={{ fontSize: 11, color: "#bbb", marginRight: 4 }}>└</span>
                              : <div style={{ width: 14, height: 14, borderRadius: "50%", background: entry.teamIdx === 0 ? "#fff" : entry.color, border: `2px solid ${entry.color}`, boxSizing: "border-box" }} />
                            }
                          </td>
                          <td style={{ padding: entry.isNested ? "5px 14px" : "8px 14px", fontWeight: entry.isNested ? 400 : 600, color: entry.isNested ? "#888" : "#111", fontSize: entry.isNested ? 12 : 13 }}>
                            #{entry.num}
                          </td>
                          <td style={{ padding: entry.isNested ? "5px 14px" : "8px 14px", textAlign: "right", fontWeight: entry.isNested ? 500 : 700, fontVariantNumeric: "tabular-nums", color: entry.isNested ? "#aaa" : "#c0392b", fontSize: entry.isNested ? 12 : 13 }}>
                            {entry.nonReleasable && (
                              <span style={{ marginRight: 5, fontSize: 9, fontWeight: 700, color: "#c0392b", background: "#fff0ee", border: "1px solid #f0a0a0", borderRadius: 4, padding: "1px 4px", letterSpacing: "0.05em", verticalAlign: "middle" }}>NR</span>
                            )}
                            {entry.crossQuarter && <span style={{ fontSize: 10, fontWeight: 600, color: "#aaa", marginRight: 4 }}>{qLabel(entry.releaseQ)}</span>}
                            {entry.releaseTime}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button style={S.endQtrBtn(gameOver || scorekeeperRole === "secondary")}
                title={scorekeeperRole === "secondary" ? "Only the primary scorer can end a quarter" : undefined}
                onClick={() => { if (!gameOver && scorekeeperRole !== "secondary") setStep("endqtr"); }}>
                {scorekeeperRole === "secondary" ? `${curQLabel} — Primary controls quarter` : `End ${curQLabel} →`}
              </button>
              <div style={{ textAlign: "center", marginTop: 10 }}>
                <button style={S.tabBtn(false)} onClick={() => setScreen("stats")}>View stats →</button>
              </div>
            </div>
          )}

          {/* Event select */}
          {step === "event" && (
            <div>
              <button style={S.backBtn} onClick={resetEntry}>← Back</button>
              <div style={{
                background: teamColors[selectedTeam],
                borderRadius: 10,
                padding: "14px 16px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: "rgba(255,255,255,0.5)", flexShrink: 0,
                }}></div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Recording event for</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: 0 }}>{teams[selectedTeam].name}</div>
                </div>
              </div>
              <div style={S.eventGrid}>
                {EVENTS.map(ev => {
                  const prevEv = editingGroupId ? (() => { const g = getGroupById(editingGroupId); return g.find(e => e.event === "goal") ? "goal" : g.find(e => e.event === "shot") ? "shot" : g[0]?.event; })() : null;
                  return (
                    <button key={ev.id} style={S.eventBtn(editingGroupId && prevEv === ev.id)}
                      onClick={() => {
                        setSelectedEvent(ev);
                        if (ev.id === "timeout") {
                          setStep("ask_timeout_time");
                        } else if (ev.teamStat) {
                          commitEntries([mkEntry(selectedTeam, ev.id, null, { teamStat: true })], `${ev.label} — ${teams[selectedTeam].name}`);
                        } else {
                          setStep("player");
                        }
                      }}>
                      <span style={S.evIcon}>{ev.icon}</span>{ev.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Player select */}
          {step === "player" && (
            <div>
              <button style={S.backBtn} onClick={() => setStep("event")}>← Back</button>
              <div style={{ ...S.stepLabel }}>{selectedEvent?.label} — Which player?</div>
              {selectedEvent?.id === "faceoff_win" && (() => {
                const lfw = lastFaceoffWinner[selectedTeam];
                const prevPlayer = editingGroupId ? prevPlayerInGroup(editingGroupId, selectedTeam) : null;
                const featured = prevPlayer || lfw;
                const isHome = selectedTeam === 0;
                return featured ? (
                  <button
                    style={{ ...S.playerBtn(true, teamColors[selectedTeam], isHome), width: "100%", display: "flex", justifyContent: "center", gap: 8, padding: "12px 16px", marginBottom: 10, boxSizing: "border-box" }}
                    onClick={() => handlePlayerSelected(featured)}
                  >
                    <span style={S.playerNum(true, isHome, teamColors[selectedTeam])}>#{featured.num}</span>
                    <span style={S.playerName(true, isHome, teamColors[selectedTeam])}>{featured.name}</span>
                  </button>
                ) : null;
              })()}
              <div style={S.playerGrid}>
                {parsedRosters[selectedTeam]?.map((p, i) => {
                  const prev = editingGroupId ? prevPlayerInGroup(editingGroupId, selectedTeam) : null;
                  const lfw = lastFaceoffWinner[selectedTeam];
                  const featured = prev || lfw;
                  const sel = featured ? (featured.num === p.num && featured.name === p.name) : false;
                  const isHome = selectedTeam === 0;
                  return <button key={i} style={S.playerBtn(sel, teamColors[selectedTeam], isHome)} onClick={() => handlePlayerSelected(p)}><span style={S.playerNum(sel, isHome, teamColors[selectedTeam])}>#{p.num}</span><span style={S.playerName(sel, isHome, teamColors[selectedTeam])}>{p.name}</span></button>;
                })}
              </div>
            </div>
          )}

          {/* Forced TO: pick the opposing player who turned it over */}
          {step === "ask_forced_to_player" && (
            <div>
              <button style={S.backBtn} onClick={() => setStep("player")}>← Back</button>
              <div style={S.pendingBubble(teamColors[selectedTeam])}>
                🥊 Forced TO — #{selectedPlayer?.num} {selectedPlayer?.name} · {teams[selectedTeam]?.name}
              </div>
              <div style={{ ...S.stepLabel, color: teamColors[1 - selectedTeam] }}>
                {teams[1 - selectedTeam]?.name} — Which player turned it over?
              </div>
              <div style={S.playerGrid}>
                {parsedRosters[1 - selectedTeam]?.map((p, i) => {
                  const prev = editingGroupId ? getGroupById(editingGroupId).find(e => e.event === "turnover")?.player : null;
                  const sel = prev ? (prev.num === p.num && prev.name === p.name) : false;
                  const isHome = (1 - selectedTeam) === 0;
                  return <button key={i} style={S.playerBtn(sel, teamColors[1 - selectedTeam], isHome)} onClick={() => handleForcedToPlayerSelected(p)}><span style={S.playerNum(sel, isHome, teamColors[1 - selectedTeam])}>#{p.num}</span><span style={S.playerName(sel, isHome, teamColors[1 - selectedTeam])}>{p.name}</span></button>;
                })}
              </div>
            </div>
          )}

          {/* Goal: ask assist */}
          {step === "ask_assist" && (
            <div>
              <button style={S.backBtn} onClick={() => setStep("player")}>← Back</button>
              <div style={S.pendingBubble(teamColors[selectedTeam])}>
                🥍 Goal — #{selectedPlayer?.num} {selectedPlayer?.name} · {teams[selectedTeam]?.name}
              </div>
              {editingGroupId && (() => {
                const prev = getGroupById(editingGroupId).find(e => e.event === "assist");
                return <div style={{ fontSize: 12, color: "#7a5c00", background: "#fffbf0", border: "1px solid #e0d0a0", borderRadius: 8, padding: "6px 12px", marginBottom: 10 }}>
                  Currently: {prev ? `Assisted by #${prev.player?.num} ${prev.player?.name}` : "Unassisted"}
                </div>;
              })()}
              <div style={S.questionCard}><div style={S.questionText}>Was it assisted?</div></div>
              <div style={S.yesNoRow}>
                {(() => { const prev = editingGroupId ? getGroupById(editingGroupId).find(e => e.event === "assist") : null; return [
                  <button key="n" style={{ ...S.btnNo, border: (!prev && editingGroupId) ? "2px solid #111" : "1px solid #ddd", fontWeight: (!prev && editingGroupId) ? 600 : 400 }} onClick={handleAssistNo}>No — unassisted{!prev && editingGroupId ? " ✓" : ""}</button>,
                  <button key="y" style={{ ...S.btnYes, background: prev ? "#333" : "#111" }} onClick={handleAssistYes}>{prev ? `Yes ✓ (#${prev.player?.num})` : "Yes"}</button>,
                ]; })()}
              </div>
            </div>
          )}

          {/* Goal: assist player */}
          {step === "assist_player" && (
            <div>
              <button style={S.backBtn} onClick={() => setStep("ask_assist")}>← Back</button>
              <div style={S.pendingBubble(teamColors[selectedTeam])}>
                🥍 Goal — #{selectedPlayer?.num} {selectedPlayer?.name} · {teams[selectedTeam]?.name}
              </div>
              <div style={{ ...S.stepLabel, color: teamColors[selectedTeam] }}>{teams[selectedTeam]?.name} — Who assisted?</div>
              <div style={S.playerGrid}>
                {parsedRosters[selectedTeam]?.filter(p => !(p.num === selectedPlayer?.num && p.name === selectedPlayer?.name)).map((p, i) => {
                  const prev = editingGroupId ? getGroupById(editingGroupId).find(e => e.event === "assist")?.player : null;
                  const sel = prev ? (prev.num === p.num && prev.name === p.name) : false;
                  const isHome = selectedTeam === 0;
                  return <button key={i} style={S.playerBtn(sel, teamColors[selectedTeam], isHome)} onClick={() => handleAssistPlayerSelected(p)}><span style={S.playerNum(sel, isHome, teamColors[selectedTeam])}>#{p.num}</span><span style={S.playerName(sel, isHome, teamColors[selectedTeam])}>{p.name}</span></button>;
                })}
              </div>
            </div>
          )}

          {/* Goal: time remaining */}
          {step === "ask_goal_time" && (
            <div>
              <button style={S.backBtn} onClick={() => { const hasAssist = pendingEntries.some(e => e.event === "assist"); setStep(hasAssist ? "assist_player" : "ask_assist"); }}>← Back</button>
              <div style={S.pendingBubble(teamColors[selectedTeam])}>
                {pendingContext()}
              </div>
              <div style={S.questionCard}>
                <div style={S.questionText}>Time remaining in {curQLabel}?</div>
              </div>
              <TimeKeypad
                maxSeconds={isOT(currentQuarter) ? 240 : 720}
                ceilingSecs={timeCeilingSecs}
                allowEqualToCeiling={false}
                onConfirm={handleGoalTime}
              />
            </div>
          )}

          {/* Timeout: time remaining */}
          {step === "ask_timeout_time" && (
            <div>
              <button style={S.backBtn} onClick={() => setStep("event")}>← Back</button>
              <div style={S.questionCard}>
                <div style={S.questionText}>Timeout — {teams[selectedTeam]?.name}</div>
                <div style={S.questionSub}>Time remaining in {curQLabel}?</div>
              </div>
              <TimeKeypad
                maxSeconds={isOT(currentQuarter) ? 240 : 720}
                ceilingSecs={timeCeilingSecs}
                allowEqualToCeiling={false}
                onConfirm={(t) => commitEntries([mkEntry(selectedTeam, "timeout", null, { teamStat: true, timeoutTime: t })], `Timeout — ${teams[selectedTeam]?.name} at ${t}`)}
              />
              <button style={{ ...S.btnSecondary, marginTop: 8 }} onClick={() => {
                commitEntries([mkEntry(selectedTeam, "timeout", null, { teamStat: true })], `Timeout — ${teams[selectedTeam]?.name}`);
              }}>
                Log without time
              </button>
            </div>
          )}

          {/* Shot: outcome picker */}
          {step === "ask_shot_outcome" && (
            <div>
              <button style={S.backBtn} onClick={() => setStep("player")}>← Back</button>
              <div style={S.pendingBubble(teamColors[selectedTeam])}>
                🎯 Shot — #{selectedPlayer?.num} {selectedPlayer?.name} · {teams[selectedTeam]?.name}
              </div>
              {editingGroupId && (() => {
                const g = getGroupById(editingGroupId);
                const prevSaved = g.some(e => e.event === "shot_saved");
                const prevBlocked = g.some(e => e.event === "shot_blocked");
                const prevPost = g.some(e => e.event === "shot_post");
                const cur = prevSaved ? "Saved" : prevBlocked ? "Blocked" : prevPost ? "Off the post" : "Missed";
                return <div style={{ fontSize: 12, color: "#7a5c00", background: "#fffbf0", border: "1px solid #e0d0a0", borderRadius: 8, padding: "6px 12px", marginBottom: 10 }}>Currently: {cur}</div>;
              })()}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                {[
                  { outcome: "missed",  label: "Missed / wide" },
                  { outcome: "saved",   label: `Saved — by ${teams[1 - selectedTeam]?.name}` },
                  { outcome: "blocked", label: `Blocked — by ${teams[1 - selectedTeam]?.name}` },
                  { outcome: "post",    label: "Off the post / crossbar (SOG)" },
                ].map(({ outcome, label }) => (
                  <button key={outcome} style={{ ...S.btnNo, textAlign: "center", padding: "14px 16px" }} onClick={() => handleShotOutcome(outcome)}>{label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Shot: pick goalie */}
          {step === "save_player" && (
            <div>
              <button style={S.backBtn} onClick={() => setStep("ask_shot_outcome")}>← Back</button>
              <div style={S.pendingBubble(teamColors[selectedTeam])}>
                🎯 Shot — #{selectedPlayer?.num} {selectedPlayer?.name} · {teams[selectedTeam]?.name}
              </div>
              <div style={{ ...S.stepLabel, color: teamColors[1 - selectedTeam] }}>{teams[1 - selectedTeam]?.name} — Who made the save?</div>
              {(() => {
                const lg = lastGoalie[1 - selectedTeam];
                const prevGoalie = editingGroupId ? getGroupById(editingGroupId).find(e => e.event === "shot_saved")?.player : null;
                const featuredGoalie = prevGoalie || lg;
                const isHome = (1 - selectedTeam) === 0;
                return featuredGoalie ? (
                  <button
                    style={{ ...S.playerBtn(true, teamColors[1 - selectedTeam], isHome), width: "100%", display: "flex", justifyContent: "center", gap: 8, padding: "12px 16px", marginBottom: 10, boxSizing: "border-box" }}
                    onClick={() => handleSavePlayerSelected(featuredGoalie)}
                  >
                    <span style={S.playerNum(true, isHome, teamColors[1 - selectedTeam])}>#{featuredGoalie.num}</span>
                    <span style={S.playerName(true, isHome, teamColors[1 - selectedTeam])}>{featuredGoalie.name}</span>
                  </button>
                ) : null;
              })()}
              <div style={S.playerGrid}>
                {parsedRosters[1 - selectedTeam]?.map((p, i) => {
                  const prev = editingGroupId ? getGroupById(editingGroupId).find(e => e.event === "shot_saved")?.player : lastGoalie[1 - selectedTeam];
                  const sel = prev ? (prev.num === p.num && prev.name === p.name) : false;
                  const isHome = (1 - selectedTeam) === 0;
                  return <button key={i} style={S.playerBtn(sel, teamColors[1 - selectedTeam], isHome)} onClick={() => handleSavePlayerSelected(p)}><span style={S.playerNum(sel, isHome, teamColors[1 - selectedTeam])}>#{p.num}</span><span style={S.playerName(sel, isHome, teamColors[1 - selectedTeam])}>{p.name}</span></button>;
                })}
              </div>
            </div>
          )}

          {/* Shot: pick blocker */}
          {step === "blocked_player" && (
            <div>
              <button style={S.backBtn} onClick={() => setStep("ask_shot_outcome")}>← Back</button>
              <div style={S.pendingBubble(teamColors[selectedTeam])}>
                🎯 Shot blocked — #{selectedPlayer?.num} {selectedPlayer?.name} · {teams[selectedTeam]?.name}
              </div>
              <div style={{ ...S.stepLabel, color: teamColors[1 - selectedTeam] }}>{teams[1 - selectedTeam]?.name} — Who made the block?</div>
              <div style={S.playerGrid}>
                {parsedRosters[1 - selectedTeam]?.map((p, i) => {
                  const isHome = (1 - selectedTeam) === 0;
                  const sel = false;
                  return <button key={i} style={S.playerBtn(sel, teamColors[1 - selectedTeam], isHome)} onClick={() => handleBlockerSelected(p)}><span style={S.playerNum(sel, isHome, teamColors[1 - selectedTeam])}>#{p.num}</span><span style={S.playerName(sel, isHome, teamColors[1 - selectedTeam])}>{p.name}</span></button>;
                })}
              </div>
            </div>
          )}

          {/* Penalty: type */}
          {step === "ask_penalty_type" && (
            <div>
              <button style={S.backBtn} onClick={() => setStep("player")}>← Back</button>
              <div style={S.pendingBubble(teamColors[selectedTeam])}>🟨 Penalty — #{selectedPlayer?.num} {selectedPlayer?.name} · {teams[selectedTeam]?.name}</div>
              {editingGroupId && (() => {
                const existing = getGroupById(editingGroupId).find(e => e.event === "penalty_tech" || e.event === "penalty_min");
                return existing?.foulName ? <div style={{ fontSize: 12, color: "#7a5c00", background: "#fffbf0", border: "1px solid #e0d0a0", borderRadius: 8, padding: "6px 12px", marginBottom: 10 }}>
                  Currently: {existing.foulName}
                </div> : null;
              })()}
              <div style={S.questionCard}><div style={S.questionText}>What was the foul?</div></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {PENALTY_OPTIONS.map(opt => {
                  const prevFoul = editingGroupId ? getGroupById(editingGroupId).find(e => e.event === "penalty_tech" || e.event === "penalty_min")?.foulName : null;
                  const isSelected = prevFoul === opt.name;
                  return (
                    <button key={opt.name}
                      style={{ ...S.btnNo, textAlign: "center", padding: "10px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, border: isSelected ? "2px solid #111" : "1px solid #ddd", fontWeight: isSelected ? 600 : 400 }}
                      onClick={() => handlePenaltyFoul(opt)}>
                      <span>{opt.name}</span>
                      <span style={{ fontSize: 10, color: opt.type === "tech" ? "#b8860b" : "#c0392b", fontWeight: 400, letterSpacing: "0.03em" }}>{opt.type === "tech" ? "🟨 Technical" : "🟥 Personal"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Penalty: minutes */}
          {step === "ask_penalty_min" && (
            <div>
              <button style={S.backBtn} onClick={() => setStep("ask_penalty_type")}>← Back</button>
              <div style={S.pendingBubble(teamColors[selectedTeam])}>🟥 {penaltyFoulName} — #{selectedPlayer?.num} {selectedPlayer?.name} · {teams[selectedTeam]?.name}</div>
              {editingGroupId && (() => {
                const prev = getGroupById(editingGroupId).find(e => e.event === "penalty_min")?.penaltyMin;
                return prev ? <div style={{ fontSize: 12, color: "#7a5c00", background: "#fffbf0", border: "1px solid #e0d0a0", borderRadius: 8, padding: "6px 12px", marginBottom: 10 }}>
                  Currently: {prev} minute{prev !== 1 ? "s" : ""}
                </div> : null;
              })()}
              <div style={S.questionCard}><div style={S.questionText}>How many minutes?</div></div>
              <div style={S.threeColRow}>
                {[1,2,3].map(m => { const prev = editingGroupId ? getGroupById(editingGroupId).find(e => e.event === "penalty_min")?.penaltyMin : null;
                  return <button key={m} style={{ ...S.btnYes, background: prev === m ? "#333" : "#111", border: prev === m ? "2px solid #555" : "none" }} onClick={() => handlePenaltyMin(m)}>{m} min{prev === m ? " ✓" : ""}</button>; })}
              </div>
            </div>
          )}

          {/* Penalty: non-releasable? */}
          {step === "ask_penalty_nr" && (
            <div>
              <button style={S.backBtn} onClick={() => setStep("ask_penalty_min")}>← Back</button>
              <div style={S.pendingBubble(teamColors[selectedTeam])}>🟥 {penaltyFoulName} ({pendingEntries[0]?.penaltyMin}min) — #{selectedPlayer?.num} {selectedPlayer?.name} · {teams[selectedTeam]?.name}</div>
              <div style={S.questionCard}>
                <div style={S.questionText}>Releasable or non-releasable?</div>
                <div style={S.questionSub}>NR penalties are served in full — no early release on a goal</div>
              </div>
              <div style={S.yesNoRow}>
                <button style={S.btnYes} onClick={() => handlePenaltyNR(false)}>Releasable</button>
                <button style={S.btnNo} onClick={() => handlePenaltyNR(true)}>Non-Releasable</button>
              </div>
            </div>
          )}

          {/* Penalty: time remaining — allows same time as latest event (for same dead-ball cycle) */}
          {step === "ask_penalty_time" && (
            <div>
              <button style={S.backBtn} onClick={() => penaltyType === "tech" ? setStep("ask_penalty_type") : setStep("ask_penalty_nr")}>← Back</button>
              <div style={S.pendingBubble(teamColors[selectedTeam])}>
                {penaltyType === "tech" ? `🟨 ${penaltyFoulName} (Technical)` : `🟥 ${penaltyFoulName} (${pendingEntries[0]?.penaltyMin}min${penaltyNR ? " NR" : ""})`} — #{selectedPlayer?.num} {selectedPlayer?.name} · {teams[selectedTeam]?.name}
              </div>
              <div style={S.questionCard}>
                <div style={S.questionText}>Time remaining?</div>
                <div style={S.questionSub}>Penalties from the same dead-ball cycle can share a time</div>
              </div>
              <TimeKeypad
                maxSeconds={isOT(currentQuarter) ? 240 : 720}
                ceilingSecs={timeCeilingSecs}
                allowEqualToCeiling={true}
                onConfirm={handlePenaltyTime}
                showSameAsLatest={true}
                latestLabel={timeCeilingSecs !== null ? `${Math.floor(timeCeilingSecs/60)}:${String(timeCeilingSecs%60).padStart(2,"0")}` : null}
              />
            </div>
          )}

          {/* End quarter */}
          {step === "endqtr" && (
            <div>
              <div style={{ ...S.confirmCard, background: "#fffbf0", border: "1px solid #e0d0a0" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#7a5c00", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  End of {curQLabel}
                  {currentQuarter === 4 && totalScores[0] !== totalScores[1] && <span style={{ marginLeft: 8, fontSize: 11, color: "#4caf50" }}>— Final</span>}
                  {currentQuarter === 4 && totalScores[0] === totalScores[1] && <span style={{ marginLeft: 8, fontSize: 11, color: "#e67e22" }}>— Tied → OT</span>}
                </div>
                <div style={{ fontSize: 32, fontWeight: 500, marginBottom: 12 }}>
                  <span style={{ color: teamColors[0] }}>{totalScores[0]}</span>
                  <span style={{ margin: "0 12px", color: "#ccc" }}>—</span>
                  <span style={{ color: teamColors[1] }}>{totalScores[1]}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, textAlign: "left" }}>
                  {[0, 1].map(ti => { const qs = qSummaryStats(ti, currentQuarter); return (
                    <div key={ti} style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", border: "1px solid #e5e5e5" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: teamColors[ti], marginBottom: 6 }}>{teams[ti].name}</div>
                      {[["goal","Goals"],["shot","Shots"],["ground_ball","GBs"],["faceoff_win","FO W"],["turnover","TOs"],["clear","Clears"],["failed_clear","Failed Cl"]].map(([k,l]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                          <span style={{ color: "#888" }}>{l}</span>
                          <span style={{ fontWeight: qs[k] > 0 ? 600 : 400, color: qs[k] > 0 ? "#111" : "#ccc" }}>{qs[k]}</span>
                        </div>
                      ))}
                    </div>
                  ); })}
                </div>
                {currentQuarter === 4 && totalScores[0] === totalScores[1] && <div style={{ fontSize: 12, color: "#e67e22", marginTop: 12 }}>Score is tied — overtime will begin</div>}
                {currentQuarter === 4 && totalScores[0] !== totalScores[1] && <div style={{ fontSize: 12, color: "#555", marginTop: 12 }}>This will finalize the game.</div>}
                {currentQuarter < 4 && <div style={{ fontSize: 11, color: "#aaa", marginTop: 12 }}>Stats for this quarter will be locked.</div>}
              </div>
              <div style={S.confirmBtns}>
                <button style={S.btnSecondary} onClick={resetEntry}>Cancel</button>
                <button style={S.btnWarning} onClick={handleEndQuarter}>
                  {currentQuarter === 4 && totalScores[0] !== totalScores[1] ? "Finalize Game ✓" : currentQuarter === 4 ? "Start OT ✓" : `Confirm End ${curQLabel} ✓`}
                </button>
              </div>
            </div>
          )}

          {/* Delete confirm */}
          {step === "confirm_delete" && deletingGroupId && (
            <div>
              <div style={{ ...S.confirmCard, background: "#fff5f5", border: "1px solid #f0a0a0" }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>🗑️</div>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Delete this entry?</div>
                {(() => { const group = getGroupById(deletingGroupId); const primary = groupPrimary(group); const { icon, label, player } = entryDisplayInfo(primary); return (
                  <div style={{ fontSize: 14, color: "#888" }}>
                    {icon} {label}{player ? ` — #${player.num} ${player.name}` : ""} · {teams[primary.teamIdx]?.name}
                    {group.length > 1 && <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>({group.length} linked entries will be removed)</div>}
                  </div>
                ); })()}
              </div>
              <div style={S.confirmBtns}>
                <button style={S.btnSecondary} onClick={() => { setDeletingGroupId(null); setStep("team"); }}>Cancel</button>
                <button style={S.btnDanger} onClick={() => { handleDeleteGroup(deletingGroupId); setStep("team"); }}>Delete ✓</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ STATS ══ */}
      {screen === "stats" && (
        <div>
          {gameOver ? (
            <div style={S.finalBanner}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa", marginBottom: 8 }}>Final</div>
              <div style={{ fontSize: 42, fontWeight: 500, letterSpacing: 4, marginBottom: 6 }}>
                <span style={{ color: teamColors[0] }}>{totalScores[0]}</span>
                <span style={{ color: "#555", margin: "0 10px" }}>—</span>
                <span style={{ color: teamColors[1] }}>{totalScores[1]}</span>
              </div>
              <div style={{ fontSize: 13, color: "#aaa", marginBottom: 10 }}>{totalScores[0] > totalScores[1] ? teams[0].name : teams[1].name} wins{allQuarters.some(q => isOT(q)) ? " in overtime" : ""}</div>
              <button style={{ fontSize: 13, padding: "8px 18px", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, background: "transparent", color: exportCopied ? "#9fe1cb" : "rgba(255,255,255,0.7)", cursor: "pointer" }}
                onClick={handleExport}>{exportCopied ? "✓ Copied!" : "Export game JSON"}</button>
            </div>
          ) : (
            <div style={S.scoreHeader}>
              <div style={{ fontSize: 13, fontWeight: 600, color: teamColors[0] }}>{teams[0].name}</div>
              <div style={S.scoreBig}>
                <span style={{ color: teamColors[0] }}>{totalScores[0]}</span>
                <span style={{ color: "#ddd", margin: "0 8px" }}>—</span>
                <span style={{ color: teamColors[1] }}>{totalScores[1]}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: teamColors[1], textAlign: "right" }}>{teams[1].name}</div>
            </div>
          )}

          {/* Timeouts remaining (live games only) */}
          {!gameOver && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              {[0, 1].map(ti => (
                <div key={ti} style={{ fontSize: 12, color: teamColors[ti], fontWeight: 500 }}>
                  ⏸ {timeoutsLeft[ti]} timeout{timeoutsLeft[ti] !== 1 ? "s" : ""} left
                </div>
              ))}
            </div>
          )}

          {/* Quarter score grid */}
          {allQuarters.length > 1 && (
            <div style={{ ...S.tableWrap, marginBottom: 20 }}>
              <table style={{ ...S.table, fontSize: 13 }}>
                <thead><tr>
                  <th style={S.thLeft}>Team</th>
                  {allQuarters.map(q => <th key={q} style={{ ...S.th(false), color: completedQuarters.includes(q) ? "#888" : teamColors[0] }}>
                    {qLabel(q)}{!completedQuarters.includes(q) && !gameOver && <span style={{ display: "block", fontSize: 9, color: "#4caf50", fontWeight: 400 }}>live</span>}
                  </th>)}
                  <th style={{ ...S.th(false), color: "#111", borderLeft: "1px solid #e5e5e5" }}>Total</th>
                </tr></thead>
                <tbody>{[0,1].map(ti => <tr key={ti}>
                  <td style={{ ...S.tdLeft, fontWeight: 600, color: teamColors[ti] }}>{teams[ti].name}</td>
                  {allQuarters.map(q => <td key={q} style={S.td}>{(scoresByQuarter[q] || [0,0])[ti]}</td>)}
                  <td style={{ ...S.td, fontWeight: 600, borderLeft: "1px solid #e5e5e5" }}>{totalScores[ti]}</td>
                </tr>)}</tbody>
              </table>
            </div>
          )}

          {/* Quarter filter */}
          <div style={S.tabsRow}>
            <button style={S.tabBtn(statsQtr === "all")} onClick={() => setStatsQtr("all")}>All</button>
            {completedQuarters.map(q => <button key={q} style={S.tabBtn(statsQtr === String(q))} onClick={() => setStatsQtr(String(q))}>{qLabel(q)}</button>)}
            {!gameOver && <button style={S.tabBtn(statsQtr === String(currentQuarter))} onClick={() => setStatsQtr(String(currentQuarter))}>{curQLabel} <span style={{ fontSize: 10, color: statsQtr === String(currentQuarter) ? "#aaa" : "#4caf50" }}>●</span></button>}
          </div>

          {/* Stats sub-tabs: Summary | Players | Timeline */}
          <div style={S.tabsRow}>
            {["summary","players","timeline"].map(t => (
              <button key={t} style={{ ...S.tabBtn(statsTab === t), border: "1px solid #ddd" }} onClick={() => setStatsTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Summary */}
          {statsTab === "summary" && (
            <div style={S.summaryGrid}>
              {[
                { heading: "Scoring" },
                { label: "Goals", key: "goal" }, { label: "Assists", key: "assist" },
                { label: "Successful EMO", key: "emo_goal" }, { label: "Failed EMO", key: "emo_fail" },
                { label: "EMO %", custom: emoPct },
                { heading: "Defense" },
                { label: "Successful MDD", key: "mdd_success" }, { label: "Failed MDD", key: "mdd_fail" },
                { label: "MDD %", custom: mddPct },
                { label: "Saves", key: "shot_saved" }, { label: "Save %", custom: savePct },
                { label: "Forced TOs", key: "forced_to" },
                { heading: "Shooting" },
                { label: "Total Shots", key: "shot" }, { label: "Shot %", custom: shotPct },
                { label: "Shots on Goal", key: "sog" }, { label: "SOG %", custom: sogPct },
                { label: "Blocked Shots", key: "shot_blocked" },
                { heading: "Possession" },
                { label: "Ground Balls", key: "ground_ball" }, { label: "Faceoffs Won", key: "faceoff_win" },
                { label: "Turnovers", key: "turnover" },
                { heading: "Clearing" },
                { label: "Successful Clears", key: "clear" }, { label: "Failed Clears", key: "failed_clear" },
                { label: "Clearing %", custom: clearPct },
                { label: "Successful Rides", key: "successful_ride" }, { label: "Failed Rides", key: "failed_ride" },
                { heading: "Penalties" },
                { label: "Technicals", key: "penalty_tech" }, { label: "PF Minutes", key: "penalty_min" },
              ].map((item) => item.heading ? (
                <div key={item.heading} style={{ gridColumn: "1 / -1", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#bbb", padding: "8px 2px 2px" }}>{item.heading}</div>
              ) : (
                <div key={item.label} style={S.summaryCard}>
                  <div style={S.summaryLabel}>{item.label}</div>
                  {[0,1].map(ti => (
                    <div key={ti} style={S.summaryRow}>
                      <div style={{ fontSize: 12, color: teamColors[ti] }}>{teams[ti].name}</div>
                      <div style={{ fontSize: 20, fontWeight: 500, color: teamColors[ti] }}>{item.custom ? item.custom(ti) : (teamTotals[ti][item.key] || 0)}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Players */}
          {statsTab === "players" && (
            filteredLog.filter(e => !e.teamStat).length === 0
              ? <div style={S.emptyState}>No player stats for this period</div>
              : <div style={S.tableWrap}>
                  <div style={S.tableTitle}><span>Player stats</span><span style={{ fontWeight: 400, fontSize: 11 }}>tap column to sort</span></div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={S.table}>
                      <thead><tr>
                        <th style={S.thLeft}>Player</th>
                        {STAT_KEYS.filter(k => k !== "clear" && k !== "failed_clear" && k !== "successful_ride" && k !== "failed_ride" && k !== "mdd_success" && k !== "mdd_fail" && k !== "emo_fail" && k !== "shot_post").map(k => <th key={k} style={S.th(sortKey === k)} onClick={() => setSortKey(k)}>{STAT_LABELS[k]}{sortKey === k ? " ▾" : ""}</th>)}
                      </tr></thead>
                      <tbody>
                        {[0,1].map(ti => {
                          const rows = sortedPlayers.filter(p => p.teamIdx === ti);
                          if (!rows.length) return null;
                          return [
                            <tr key={`h-${ti}`}><td colSpan={STAT_KEYS.length} style={{ padding: "8px 14px 4px", fontSize: 11, fontWeight: 600, color: teamColors[ti], background: "#fafafa" }}>{teams[ti].name.toUpperCase()}</td></tr>,
                            ...rows.map((row, i) => (
                              <tr key={`${ti}-${i}`}>
                                <td style={S.tdLeft}><span style={S.numBadge}>#{row.player.num}</span>{row.player.name}</td>
                                {STAT_KEYS.filter(k => k !== "clear" && k !== "failed_clear" && k !== "successful_ride" && k !== "failed_ride" && k !== "mdd_success" && k !== "mdd_fail" && k !== "emo_fail" && k !== "shot_post").map(k => <td key={k} style={{ ...S.td, fontWeight: k === sortKey ? 600 : 400, opacity: row[k] === 0 ? 0.3 : 1 }}>{k === "penalty_min" && row[k] > 0 ? `${row[k]}m` : row[k]}</td>)}
                              </tr>
                            ))
                          ];
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
          )}

          {/* Timeline — goals, timeouts, and penalties with timestamps */}
          {statsTab === "timeline" && (
            scoringTimeline.length === 0
              ? <div style={S.emptyState}>No events recorded yet</div>
              : <div style={S.tableWrap}>
                  <div style={S.tableTitle}><span>Timeline</span></div>
                  <table style={S.table}>
                    <thead><tr>
                      <th style={{ ...S.th(false), textAlign: "left", paddingLeft: 14 }}>Time</th>
                      <th style={{ ...S.th(false), textAlign: "left" }}>Team</th>
                      <th style={{ ...S.th(false), textAlign: "left" }}>Event</th>
                      <th style={{ ...S.th(false), textAlign: "left" }}>Assist</th>
                      <th style={S.th(false)}>Score</th>
                    </tr></thead>
                    <tbody>
                      {(() => {
                        const withScores = [];
                        const scores = [0, 0];
                        scoringTimeline.forEach(entry => {
                          if (entry.type === "goal") scores[entry.goal.teamIdx]++;
                          withScores.push({ ...entry, scoreSnap: [...scores] });
                        });
                        return [...withScores].reverse().map((entry, gi) => {
                          if (entry.type === "timeout") {
                            const to = entry.timeout;
                            return (
                              <tr key={`to-${gi}`} style={{ background: "#fafafa" }}>
                                <td style={{ ...S.tdLeft, fontVariantNumeric: "tabular-nums", width: 72, verticalAlign: "top", paddingTop: 12 }}>
                                  {to.timeoutTime ? <span style={{ fontWeight: 600, color: "#111", fontSize: 15 }}>{to.timeoutTime}</span> : <span style={{ color: "#ccc" }}>—</span>}
                                  <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#111", marginTop: 1 }}>{qLabel(to.quarter)}</span>
                                </td>
                                <td style={S.tdLeft}><span style={{ color: teamColors[to.teamIdx], fontWeight: 500 }}>{teams[to.teamIdx]?.name}</span></td>
                                <td style={{ ...S.tdLeft, color: "#888", fontStyle: "italic" }} colSpan={2}>⏸ Timeout</td>
                                <td style={{ ...S.td, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                  <span style={{ color: teamColors[0] }}>{entry.scoreSnap[0]}</span>
                                  <span style={{ color: "#ccc", margin: "0 3px" }}>–</span>
                                  <span style={{ color: teamColors[1] }}>{entry.scoreSnap[1]}</span>
                                </td>
                              </tr>
                            );
                          }
                          if (entry.type === "penalty") {
                            const p = entry.penalty;
                            const isTech = p.event === "penalty_tech";
                            const desc = isTech
                              ? `🟨 ${p.foulName ? `${p.foulName} (Technical)` : "Technical foul"}`
                              : `🟥 ${p.foulName ? `${p.foulName} (${p.penaltyMin}min${p.nonReleasable ? " NR" : ""})` : `Personal foul (${p.penaltyMin}min${p.nonReleasable ? " NR" : ""})`}`;
                            return (
                              <tr key={`p-${gi}`} style={{ background: "#fdf8f8" }}>
                                <td style={{ ...S.tdLeft, fontVariantNumeric: "tabular-nums", width: 72, verticalAlign: "top", paddingTop: 12 }}>
                                  {p.penaltyTime ? <span style={{ fontWeight: 600, color: "#111", fontSize: 15 }}>{p.penaltyTime}</span> : <span style={{ color: "#ccc" }}>—</span>}
                                  <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#111", marginTop: 1 }}>{qLabel(p.quarter)}</span>
                                </td>
                                <td style={S.tdLeft}><span style={{ color: teamColors[p.teamIdx], fontWeight: 500 }}>{teams[p.teamIdx]?.name}</span></td>
                                <td style={S.tdLeft} colSpan={2}>
                                  <span style={{ color: "#555" }}>{desc}</span>
                                  <span style={{ color: "#888", marginLeft: 6 }}>— #{p.player?.num} {p.player?.name}</span>
                                </td>
                                <td style={{ ...S.td, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                  <span style={{ color: teamColors[0] }}>{entry.scoreSnap[0]}</span>
                                  <span style={{ color: "#ccc", margin: "0 3px" }}>–</span>
                                  <span style={{ color: teamColors[1] }}>{entry.scoreSnap[1]}</span>
                                </td>
                              </tr>
                            );
                          }
                          const { goal, assist, scoreSnap } = entry;
                          return (
                            <tr key={`g-${gi}`}>
                              <td style={{ ...S.tdLeft, fontVariantNumeric: "tabular-nums", width: 72, verticalAlign: "top", paddingTop: 12 }}>
                                {goal.goalTime ? <span style={{ fontWeight: 600, color: "#111", fontSize: 15 }}>{goal.goalTime}</span> : <span style={{ color: "#ccc" }}>—</span>}
                                <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#111", marginTop: 1 }}>{qLabel(goal.quarter)}</span>
                              </td>
                              <td style={S.tdLeft}><span style={{ color: teamColors[goal.teamIdx], fontWeight: 500 }}>{teams[goal.teamIdx]?.name}</span></td>
                              <td style={S.tdLeft}>
                                <span style={{ fontWeight: 500 }}>#{goal.player?.num} {goal.player?.name}</span>
                                {goal.emo && <span style={{ marginLeft: 6, fontSize: 11, background: "#e8f5e9", color: "#2a7a3b", borderRadius: 4, padding: "1px 5px" }}>EMO</span>}
                              </td>
                              <td style={S.tdLeft}>
                                {assist ? <span style={{ color: "#888" }}>#{assist.player?.num} {assist.player?.name}</span> : <span style={{ color: "#ddd" }}>—</span>}
                              </td>
                              <td style={{ ...S.td, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                <span style={{ color: teamColors[0] }}>{scoreSnap[0]}</span>
                                <span style={{ color: "#ccc", margin: "0 3px" }}>–</span>
                                <span style={{ color: teamColors[1] }}>{scoreSnap[1]}</span>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
          )}
        </div>
      )}

      {/* ══ EVENT LOG (own top-level tab) ══ */}
      {screen === "log" && (
        <div>
          {/* Quarter filter */}
          <div style={S.tabsRow}>
            <button style={S.tabBtn(statsQtr === "all")} onClick={() => setStatsQtr("all")}>All</button>
            {completedQuarters.map(q => <button key={q} style={S.tabBtn(statsQtr === String(q))} onClick={() => setStatsQtr(String(q))}>{qLabel(q)}</button>)}
            {!gameOver && <button style={S.tabBtn(statsQtr === String(currentQuarter))} onClick={() => setStatsQtr(String(currentQuarter))}>{curQLabel} <span style={{ fontSize: 10, color: statsQtr === String(currentQuarter) ? "#aaa" : "#4caf50" }}>●</span></button>}
          </div>

          <div style={S.tableWrap}>
            <div style={S.tableTitle}>
              <span>Event log</span>
              <span style={{ fontWeight: 400 }}>{logGroups.length} entries</span>
            </div>
            {logGroups.length === 0
              ? <div style={S.emptyState}>No events for this period</div>
              : <div style={S.logList}>
                  {(() => {
                    const items = [];
                    let lastQ = null;
                    // Show newest first; quarter dividers only in "all" view
                    const reversed = [...logGroups].reverse();
                    reversed.forEach((group, gi) => {
                      const primary = groupPrimary(group);
                      const q = primary.quarter;
                      if (statsQtr === "all" && q !== lastQ) {
                        items.push(<div key={`qd-${q}-${gi}`} style={S.qtrDivider}>{qLabel(q)}</div>);
                        lastQ = q;
                      }
                      const { icon, label, player } = entryDisplayInfo(primary);
                      const playerStr = primary.teamStat ? `${teams[primary.teamIdx]?.name} (team)` : (player ? `#${player.num} ${player.name}` : "");
                      const subItems = [];
                      group.forEach(e => {
                        if (e.event === "shot_saved") subItems.push(`🧤 Saved by #${e.player?.num} ${e.player?.name}`);
                        if (e.event === "assist") subItems.push(`🤝 Assist: #${e.player?.num} ${e.player?.name}`);
                        if (e.event === "turnover" && group.some(x => x.event === "forced_to")) subItems.push(`↩️ TO by #${e.player?.num} ${e.player?.name}`);
                      });
                      if (primary.event === "goal" && primary.goalTime) subItems.push(`⏱ ${primary.goalTime} remaining`);
                      if (primary.event === "goal" && primary.emo) subItems.push("⚡ EMO");
                      const gid = primary.groupId;
                      items.push(
                        <div key={gid} style={S.logGroup}>
                          <div style={S.logGroupMain}>
                            <div style={S.logDot(teamColors[primary.teamIdx])}></div>
                            <span style={{ fontWeight: 500, flex: 1 }}>{icon} {label}</span>
                            <span style={{ color: "#888", fontSize: 12 }}>{playerStr}</span>
                            <span style={{ color: teamColors[primary.teamIdx], fontSize: 11, marginLeft: 6 }}>{teams[primary.teamIdx]?.name}</span>
                            {!gameOver && <>
                              <button style={S.logActionBtn()} title="Edit" onClick={() => startEdit(gid)}>✏️</button>
                              <button style={S.logActionBtn("#c0392b")} title="Delete" onClick={() => { setDeletingGroupId(gid); setScreen("track"); setStep("confirm_delete"); }}>✕</button>
                            </>}
                          </div>
                          {subItems.length > 0 && <div style={S.logGroupSub}>{subItems.map((s, i) => <span key={i} style={S.logSubChip}>{s}</span>)}</div>}
                        </div>
                      );
                    });
                    return items;
                  })()}
                </div>
            }
          </div>
        </div>
      )}
    </div>
  );
}
