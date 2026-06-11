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
  "#1a6bab","#b84e1a","#2a7a3b","#8b1a8b","#c0392b",
  "#d4820a","#1a7a7a","#555","#1a2e8b","#8b3a1a",
];

export const PLANS            = ["pro", "max", "giga"];
export const PERSONAL_PLANS   = ["free", "basic", "plus"];
export const PLAN_STATUS      = ["active", "trialing", "past_due", "canceled"];
export const ORG_ROLES        = ["org_admin", "coach", "scorekeeper", "viewer"];

export const BOOLEAN_FEATURES = new Set(["pressbox", "season_stats", "multi_scorekeeper"]);

export const PLAN_COLOR = {
  pro:   { bg: "#eef4fb", color: "#1a6bab" },
  max:   { bg: "#eaf6ec", color: "#2a7a3b" },
  giga:  { bg: "#fff8ec", color: "#d4820a" },
};

export const STATUS_COLOR = {
  active: "#2a7a3b", trialing: "#1a6bab", past_due: "#d4820a", canceled: "#c0392b",
};
