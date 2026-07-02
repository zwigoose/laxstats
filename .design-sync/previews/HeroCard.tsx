import { HeroCard } from "laxstats";
import { TEAMS, TEAM_COLORS, TOTAL_SCORES, PLAYER_STATS } from "./_fixtures";

// Shareable final-score card. The component renders as a position:fixed
// overlay; the transformed wrapper below becomes its containing block so the
// overlay fills this sized box instead of escaping the card.
export const FinalScore = () => (
  <div style={{ position: "relative", width: "100%", maxWidth: 480, height: 524, margin: "0 auto", transform: "translateZ(0)", overflow: "hidden", borderRadius: 12 }}>
    <HeroCard
      teams={TEAMS}
      teamColors={TEAM_COLORS}
      totalScores={TOTAL_SCORES}
      playerStats={PLAYER_STATS}
      gameName="NDP vs Malvern Prep"
      logos={[null, null]}
      onClose={() => {}}
    />
  </div>
);
