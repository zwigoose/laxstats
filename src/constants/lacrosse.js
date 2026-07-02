import { C } from "../styles/tokens";
export const EVENTS = [
  { id: "goal",         label: "Goal",        icon: "🥍" },
  { id: "shot",         label: "Shot",        icon: "🎯" },
  { id: "ground_ball",  label: "Ground Ball", icon: "🪣" },
  { id: "turnover",     label: "Turnover",    icon: "↩️" },
  { id: "penalty",      label: "Penalty",     icon: "🟨" },
  { id: "timeout",      label: "Timeout",     icon: "⏸️" },
  { id: "clear_attempt",label: "Clear",       icon: "⬆️", teamStat: true },
];

export const STAT_KEYS = [
  "goal","emo_goal","emo_fail","mdd_success","mdd_fail","shot","sog",
  "shot_saved","goal_allowed","ground_ball","faceoff_win","faceoff_loss",
  "turnover","forced_to","penalty_tech","penalty_min","assist",
  "clear","failed_clear","successful_ride","failed_ride",
];

export const STAT_LABELS = {
  goal:"G", emo_goal:"EMO", emo_fail:"FEMO", mdd_success:"MDD", mdd_fail:"FMDD",
  shot:"Sh", sog:"SOG", shot_saved:"Sv", goal_allowed:"GA", sv_pct:"Sv%",
  ground_ball:"GB", faceoff_win:"FW", faceoff_loss:"FL", fo_pct:"FO%",
  turnover:"TO", forced_to:"CTO",
  penalty_tech:"Tech", penalty_min:"PF Min", assist:"A",
  clear:"Clr", failed_clear:"FCl", successful_ride:"SRide", failed_ride:"FRide",
};

export const PENALTY_OPTIONS = [
  { name: "Conduct",                 type: "tech" },
  { name: "Cross Check",             type: "personal" },
  { name: "Delay of Game",           type: "tech" },
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

export const PRESET_COLORS = [
  C.blue600,C.orange700,C.green600,C.purple600,C.red600,
  C.orange600,C.teal600,C.gray650,C.navy700,C.orange800,
];

export const PLANS            = ["pro", "max", "giga"];
export const PERSONAL_PLANS   = ["free", "basic", "plus"];
export const PLAN_STATUS      = ["active", "trialing", "past_due", "canceled"];
export const ORG_ROLES        = ["org_admin", "coach", "scorekeeper", "viewer"];

export const BOOLEAN_FEATURES = new Set(["pressbox", "season_stats", "multi_scorekeeper"]);

export const PLAN_COLOR = {
  pro:   { bg: C.blue50, color: C.blue600 },
  max:   { bg: C.green50, color: C.green600 },
  giga:  { bg: C.orange50, color: C.orange600 },
};

export const STATUS_COLOR = {
  active: C.green600, trialing: C.blue600, past_due: C.orange600, canceled: C.red600,
};
