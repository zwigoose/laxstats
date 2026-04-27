# LaxStats

LaxStats is a digital scorebook and league management platform for men's lacrosse. It replaces the clipboard at the scorer's table — one or more people track the game live on a phone or tablet, and anyone else can follow the score and stats in real time from their own device, anywhere, with no account required.

---

## What it does

A paper scorebook records goals, assists, shots, ground balls, faceoffs, turnovers, penalties, clears, and timeouts — and then someone tallies the columns afterward. LaxStats does the same thing in real time. You enter what happens as it happens; the app computes all the derived stats (EMO %, save %, clearing %, rides, MDD, and so on) automatically and makes them available instantly to anyone with the link.

In v2, LaxStats also manages organizations, seasons, and registered teams. Stats roll up across an entire season for any registered player. Multiple scorers can collaborate on the same game simultaneously from separate devices.

When the game is over, the full box score, player stats, and event timeline are preserved and viewable at any time.

---

## Who needs an account

**Scoring a personal game requires an account.** Accounts are created by an admin — contact whoever manages your LaxStats setup to get access.

**Scoring via an invite link does not.** If the game owner sends you a scorer invite link, you can open the scorekeeper directly in any browser. No login, no account, no app download.

**Viewing a game does not.** The Live View and Press Box for any game are public links — share them with coaches, parents, players, or anyone following along.

---

## Organizations

Organizations are the top-level structure for teams and leagues. Each org has:

- **Members** with roles: org admin, coach, scorekeeper, viewer
- **Teams** with registered player rosters
- **Seasons** with start and end dates
- **Games** linked to teams and seasons for cross-game stat rollups

Personal games (not linked to an org) work exactly as they always have.

---

## Multi-user scoring

The scorekeeper for any v2 game supports simultaneous scorers:

- The **primary scorer** (first to open the game) controls quarter endings and game finalization
- **Secondary scorers** join via a 24-hour invite link and can log any event
- All connected devices sync in real time via WebSocket — events appear on everyone's screen immediately
- When the primary ends a quarter, all secondary views advance automatically
- The scorekeeper header shows how many scorers are live on the game

---

## Tracking a game

### Before the game

Set up your two teams on the setup screen. Load registered org teams or enter rosters manually. Set the game date, then tap **Start Tracking →**.

### During the game

The **Track** tab is a guided step flow:

1. **Select the team** — two large buttons show the current score
2. **Select the event** — Goal, Shot, Ground Ball, Faceoff Win, Turnover, Forced TO, Penalty, MDD Stop, Timeout, Clear, or Failed Clear
3. **Select the player** — a number grid for the selected team
4. **Answer follow-ups** — assist, shot outcome, foul type, minutes, NR, time remaining

Every entry is saved automatically. The **undo** button in the confirmation banner removes the last entry instantly. The **Event Log** tab lets you edit or delete any entry at any time.

### Penalties

Select the specific foul from a list (Pushing, Slashing, Cross Check, etc.) — the app infers tech vs. personal automatically. The **Penalty Box** panel shows all active penalties with release times and NR status. Consecutive and simultaneous fouls are handled automatically.

### Ending quarters

Tap **End Q# →** at the bottom of the Track screen. After Q4 the app finalizes the game or starts overtime. Overtime is sudden death.

---

## Sharing

- **Live View** — `/games/:id/view` — score, stats, and timeline updating in real time. Public.
- **Press Box** — `/games/:id/pressbox` — full-width dashboard with score by quarter, team stats, player stats, event log, and timeline. Designed for a tablet or laptop at the press table. Public.
- **Invite scorer** — generate a 24-hour link from the scorekeeper header to bring in a second scorer. No account required for the recipient.

---

## Further reading

- **[USER_GUIDE.md](./USER_GUIDE.md)** — complete reference for every feature, flow, and stat definition
- **[CHANGELOG.md](./CHANGELOG.md)** — full version history
