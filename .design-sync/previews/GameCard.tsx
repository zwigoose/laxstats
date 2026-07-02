import { GameCard } from "laxstats";
import { GAME_LIVE, GAME_FINAL, GAME_PENDING } from "./_fixtures";

const noop = () => {};

// In-progress game — live badge with clock, scoreboard from the display cache.
export const LiveGame = () => (
  <GameCard game={GAME_LIVE} onDelete={noop} deleteStage={null} onDeleteStage={noop} />
);

// Completed game — Final badge, loser's score dimmed.
export const FinalGame = () => (
  <GameCard game={GAME_FINAL} onDelete={noop} deleteStage={null} onDeleteStage={noop} />
);

// Scheduled game with no tracking yet — name-only card.
export const Upcoming = () => (
  <GameCard game={GAME_PENDING} onDelete={noop} deleteStage={null} onDeleteStage={noop} />
);
