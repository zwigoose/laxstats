import { STAT_KEYS } from '../constants/lacrosse';

export function buildPlayerStats(entries) {
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
      map[k].sog++;
    }
    else if (e.event === "shot") {
      map[k].shot++;
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
  totals[0].successful_ride = totals[1].failed_clear;
  totals[0].failed_ride     = totals[1].clear;
  totals[1].successful_ride = totals[0].failed_clear;
  totals[1].failed_ride     = totals[0].clear;
  totals[0].mdd_fail = entries.filter(e => e.event === "goal" && e.emo && e.teamIdx === 1).length;
  totals[1].mdd_fail = entries.filter(e => e.event === "goal" && e.emo && e.teamIdx === 0).length;
  totals[0].emo_fail = totals[1].mdd_success;
  totals[1].emo_fail = totals[0].mdd_success;
  totals[0].sog = totals[0].goal + totals[0].shot_post + totals[1].shot_saved;
  totals[1].sog = totals[1].goal + totals[1].shot_post + totals[0].shot_saved;
  return totals;
}

export function toSecs(t) { 
  if (!t) return 0;
  const [m, s] = t.split(":").map(Number); 
  return m * 60 + s; 
}

export const qLenSecs = q => q <= 4 ? 720 : 240;

export function absElapsedSecs(quarter, remainSecs) {
  let base = 0;
  for (let i = 1; i < quarter; i++) base += qLenSecs(i);
  return base + (qLenSecs(quarter) - remainSecs);
}

function penaltyDurSecs(e) { return e.event === "penalty_tech" ? 30 : (e.penaltyMin || 1) * 60; }

export function computePenaltyWindows(log) {
  const penalties = log.filter(e => e.penaltyTime && (e.event === "penalty_tech" || e.event === "penalty_min"));
  const cycles = new Map();
  for (const p of penalties) {
    const key = `${p.quarter}:${p.penaltyTime}`;
    if (!cycles.has(key)) cycles.set(key, []);
    cycles.get(key).push(p);
  }
  const allWindows = [];
  for (const cyclePens of cycles.values()) {
    const absPen = absElapsedSecs(cyclePens[0].quarter, toSecs(cyclePens[0].penaltyTime));
    const teamWindows = [0, 1].map(ti => {
      const wins = [];
      const byPlayer = new Map();
      for (const p of cyclePens.filter(p => p.teamIdx === ti)) {
        const pid = p.player?.num ?? p.id;
        if (!byPlayer.has(pid)) byPlayer.set(pid, []);
        byPlayer.get(pid).push(p);
      }
      for (const [, playerPens] of byPlayer) {
        const sorted = [...playerPens].sort((a, b) => {
          if (!!a.nonReleasable !== !!b.nonReleasable) return a.nonReleasable ? -1 : 1;
          return penaltyDurSecs(b) - penaltyDurSecs(a);
        });
        let cur = absPen;
        for (const p of sorted) {
          const dur = penaltyDurSecs(p);
          wins.push({ entry: p, absStart: cur, absEnd: cur + dur, isNRBase: !!p.nonReleasable, forcedNREnd: cur });
          cur += dur;
        }
      }
      return wins;
    });
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
    for (const w of [...teamWindows[0], ...teamWindows[1]]) {
      w.nrEnd = w.isNRBase ? w.absEnd : w.forcedNREnd;
      allWindows.push(w);
    }
  }
  return allWindows;
}