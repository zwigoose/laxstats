import { LiveCard } from "laxstats";
import { GAME_LIVE } from "./_fixtures";

// Live-games rail card as the scorekeeper/owner sees it (pressbox available).
export const OwnerView = () => <LiveCard game={GAME_LIVE} isOwner hasPressbox />;

// Same card for a fan following the game.
export const FanView = () => <LiveCard game={GAME_LIVE} isOwner={false} hasPressbox={false} />;
