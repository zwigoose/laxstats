# LaxStats 🥍

An electronic scorebook for men's lacrosse — the kind of thing that used to live on a clipboard at the scorers table, now on your phone. One person runs it on the sideline while the game is happening; coaches, parents, and players can follow the score and stats live from anywhere.

---

## Accounts

LaxStats requires an account. Sign in with your username and password at the login screen. If you don't have an account, ask an admin to create one for you, or tap **Sign up** on the login screen.

The app uses short usernames — no email address needed.

---

## How to use this app

### Before the season — save your rosters

Go to the **Rosters** tab and create a saved team for each team you track. Enter the team name, pick a color, and add players one per line (`#2 John Smith`). Saved rosters load into any game in one tap and don't need to be re-entered each time.

You can share a saved roster with another user by entering their username in the roster's **Sharing** panel. Shared users can load the roster into their games but cannot edit it — only the creator can modify a roster.

### Game day — create a game

Tap **＋ New Game** from the main screen. You'll land on the setup screen. Use the **Load saved…** dropdown on each team card to pull in a saved roster (including any rosters shared with you), or type one in manually. Both teams need at least 10 players and no duplicate numbers before you can start.

The left card is always **Home** (white jerseys) and the right card is **Away** (colored jerseys). The button colors in the tracking UI mirror this — white with a colored border for home, solid color for away — so your eye can match what you see on the field.

Tap **Start Tracking →** when you're ready.

### During the game — tracking events

The **Track** tab walks you through every stat entry step by step. Tap the team, tap the event, tap the player, answer any follow-up questions. The app handles all the derived stats automatically — rides, MDD, EMO fail, SOG — so you only enter what actually happened.

The most common flows:

- **Goal:** team → player → assist? → time remaining?
- **Shot:** team → player → outcome (Missed / Saved / Blocked / Off the post) → pick goalie or blocker if applicable
- **Timeout:** team → time remaining?

Use the **undo** button after any entry to remove it immediately. For older corrections, go to the **Event Log** tab to edit or delete any entry at any time.

### Timeouts

Each team gets **2 timeouts per half** (Q1+Q2, then Q3+Q4 separately). In overtime, each team gets **1 per OT period**. Unused timeouts don't carry over between periods. The remaining count is shown on each team's button in the Track screen.

### Ending quarters and overtime

Tap **End Q# →** at the bottom of the Track screen. After Q4, the app either finalizes the game (score not tied) or starts overtime. Overtime is sudden death — first goal ends the game automatically.

### Viewing stats

The **Stats** tab has three views — **Summary** (team totals), **Players** (sortable individual stats), and **Timeline** (goals and timeouts in order). Use the quarter buttons to filter to any single quarter.

### Sharing

Anyone can follow the game live at `/games/:id/view` or by tapping **View** on a game card. The Live View updates in real time as you enter stats. The latest recorded time remaining is shown above the score so viewers have the most current clock reference available. No account is required to view.

For a richer view, the **Press Box** (`/games/:id/pressbox`) is a full-width dashboard showing the score, score by quarter, team stats, player stats, event log, and timeline all on one page — designed for an announcer or press box on a tablet or laptop. Also public, no account required.

---

## Stats tracked

| Category | Stats |
|---|---|
| Scoring | Goals, Assists, Successful EMO, Failed EMO, EMO % |
| Defense | Successful MDD, Failed MDD, MDD %, Saves, Save %, Forced TOs |
| Shooting | Total Shots, Shot %, Shots on Goal (SOG), SOG %, Blocked Shots |
| Possession | Ground Balls, Faceoff Wins, Turnovers |
| Clearing | Successful Clears, Failed Clears, Clearing %, Successful Rides, Failed Rides |
| Penalties | Technical Fouls, Personal Foul Minutes |

Rides, MDD Fail, EMO Fail, and SOG are all calculated automatically — you never enter them directly.

---

## Admin

Admin accounts have access to `/admin`, a separate management panel with:

- **All Games** — view, score, create, and delete games on behalf of any user; reassign game ownership; live score and clock updates in real time
- **Users** — create and delete accounts, promote or revoke admin status, and see each user's game history with direct links to score or view each game
- **Rosters** — view, edit, and create rosters on behalf of any user; reassign roster ownership; manage sharing for any roster

---

## Full documentation

See [USER_GUIDE.md](./USER_GUIDE.md) for a complete reference.
See [CHANGELOG.md](./CHANGELOG.md) for version history.
