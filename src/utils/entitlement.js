const FEATURE_LABELS = {
  org_active_seasons:      "active seasons",
  org_active_teams:        "active teams",
  org_members:             "members",
  org_games_per_season:    "games this season",
  org_member_personal_games: "personal games",
};

export function entitlementMsg(msg) {
  if (!msg) return msg;
  if (msg.startsWith("plan_limit_exceeded:")) {
    const [, feature, current, limit] = msg.split(":");
    const label = FEATURE_LABELS[feature] ?? feature;
    return `Plan limit reached: ${current} of ${limit} ${label} used. Upgrade your plan to add more.`;
  }
  if (msg.startsWith("user_already_in_org:")) {
    return `This user is already a member of "${msg.split(":")[1]}". Users can only belong to one org.`;
  }
  return msg;
}
