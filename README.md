# LaxStats

LaxStats is a digital scorebook for men's lacrosse. It replaces the clipboard at the scorer's table — one person tracks the game on a phone or tablet as it happens, and anyone else can follow the score and stats live from their own device, anywhere, with no account required.

---

## What it does

A paper scorebook records goals, assists, shots, ground balls, faceoffs, turnovers, penalties, clears, and timeouts — and then someone tallies the columns afterward. LaxStats does the same thing in real time. You enter what happens as it happens; the app computes all the derived stats (EMO %, save %, clearing %, rides, MDD, and so on) automatically and makes them available instantly to anyone with the link.

When the game is over, the full box score, player stats, and event timeline are preserved and viewable at any time.

---

## Who needs an account

**Scoring a game requires an account.** Accounts are created by an admin — contact whoever manages your LaxStats setup to get access.

**Viewing a game does not.** The Live View and Press Box for any game are public links — share them with coaches, parents, players, or anyone following along. No login, no app download.

---

## Tracking a game

### Before the game

Set up your two teams on the setup screen. You can type rosters in manually or load a saved roster from a previous game. Each team needs a name, a color, and at least 10 players with unique numbers. Set the game date, then tap **Start Tracking →**.

### During the game

The **Track** tab is a guided step flow:

1. **Select the team** — two large buttons show the current score. Home (white jersey) is the white-bordered button; Away (colored jersey) is the solid-color button. Each button shows how many timeouts the team has remaining.
2. **Select the event** — Goal, Shot, Ground Ball, Faceoff Win, Turnover, Forced TO, Penalty, MDD Stop, Timeout, Clear, or Failed Clear.
3. **Select the player** — a number grid for the selected team. Same home/away styling so your eye matches the field.
4. **Answer follow-ups** — the app walks you through anything else it needs: assist, shot outcome, goalie, foul type, minutes, releasable or NR, time remaining.

Every entry is saved automatically. If you make a mistake, the **undo** button in the confirmation banner removes the last entry instantly. For older corrections, the **Event Log** tab lets you edit or delete any entry at any time.

### Penalties

When you log a penalty, you select the specific foul from a list (Pushing, Slashing, Cross Check, etc.) and the app infers whether it's a technical (30s) or personal. The **Penalty Box** panel appears on the Track screen whenever players are serving time, showing each player's release time and NR status. Consecutive and simultaneous fouls from the same dead-ball cycle are handled automatically.

### Ending quarters

Tap **End Q# →** at the bottom of the Track screen. After Q4 the app either finalizes the game or starts overtime. Overtime is sudden death — the game ends automatically on the first goal.

---

## Sharing

- **Live View** — `/games/:id/view` — score, stats, and timeline updating in real time. Public.
- **Press Box** — `/games/:id/pressbox` — full-width dashboard with score by quarter, team stats, player stats, event log, and timeline all on one screen. Designed for a tablet or laptop at the press table. Public.

Both links update live as you score. Share them before the game starts so viewers are ready.

---

## Further reading

- **[USER_GUIDE.md](./USER_GUIDE.md)** — complete reference for every feature, flow, and stat definition
- **[CHANGELOG.md](./CHANGELOG.md)** — full version history
