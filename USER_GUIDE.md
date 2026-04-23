# LaxStats — User Guide

LaxStats is an electronic scorebook for men's lacrosse. It replaces the clipboard at the scorers table — one person enters stats on a phone or tablet during the game, and everyone else follows along live from their own device.

---

## Table of Contents

1. [Accounts & Login](#1-accounts--login)
2. [Main Screen](#2-main-screen)
3. [Roster Management](#3-roster-management)
4. [Creating and Managing Games](#4-creating-and-managing-games)
5. [Scorekeeper — Setup](#5-scorekeeper--setup)
6. [Scorekeeper — Tracking Events](#6-scorekeeper--tracking-events)
7. [Event Reference](#7-event-reference)
8. [Timeouts](#8-timeouts)
9. [Quarter & Game Management](#9-quarter--game-management)
10. [Editing and Deleting Entries](#10-editing-and-deleting-entries)
11. [Stats Views](#11-stats-views)
12. [Live View](#12-live-view)
13. [Press Box](#13-press-box)
14. [Admin Panel](#14-admin-panel)
15. [Stat Definitions](#15-stat-definitions)

---

## 1. Accounts & Login

LaxStats requires an account. All games and rosters you create are private to your account.

### Signing in
Enter your **username** and **password** on the login screen and tap **Sign in**. If you have a real email address registered, you can enter that instead — the app detects the `@` and uses it as-is.

### Creating an account
Tap **Sign up** on the login screen, choose a username and password (minimum 6 characters), and tap **Create account**. Alternatively, an admin can create an account for you from the Admin panel.

### Signing out
Tap **Sign out** in the top-right of the main screen.

---

## 2. Main Screen

The main screen has two tabs: **Games** and **Rosters**.

### Games tab

Lists your games, newest first. Each card shows:

- **Team names and score** once tracking has begun
- **Status pill:**
  - **● Pending** (orange) — game exists but tracking has not started
  - **● Live · 8:54 Q2** (green) — actively being tracked; shows the latest recorded time remaining
  - **Final** (gray) — game is complete
- **Setup** button (pending games) or **Score** button (live/final games) — opens the Scorekeeper
- **View** button — opens the read-only Live View
- **Press Box** button — opens the full press box dashboard
- **🗑** — delete the game (requires two confirmations)

Live and pending games are shown at the top. Completed games are hidden under a collapsible **N completed games** toggle.

### Rosters tab

Manage saved team rosters. See [Roster Management](#3-roster-management).

---

## 3. Roster Management

Saved rosters let you enter a team once and load it into any future game in a single tap.

### Creating a saved team
1. Go to the **Rosters** tab and tap **+ New Team**.
2. Enter a team name, pick a color, and type the roster (one player per line).
3. Tap **Save team**.

### Roster format
```
#2 John Smith
#7 Mike Johnson
#11 Alex Williams
```
The `#` is optional. Players must have unique numbers — the app will show a red error and block saving if any number appears more than once.

### Editing a saved team
Tap any team row to expand it, make changes, and tap **Save changes**. Only the roster's creator can edit it.

### Deleting a saved team
Expand the team row, tap **Delete**, then **Confirm delete**. This only removes the saved roster and does not affect any game that already used it.

### Sharing a roster
You can share a roster with another user so they can load it into their games.

1. Expand the team row you want to share.
2. In the **Sharing** section at the bottom, type the other user's username and tap **Find**.
3. Confirm the username shown and tap **Share**.

Shared users can **load** the roster into their games via the **Load saved…** dropdown but cannot edit or delete it. Only the roster's creator can add or remove shares.

To remove a share, open the same Sharing section and tap **Remove** next to the user's name.

### Rosters shared with you
Rosters shared with you appear under a **Shared with me** heading at the bottom of the Rosters tab. They display a **Shared** badge and are read-only. They are available in the **Load saved…** dropdown in game setup.

---

## 4. Creating and Managing Games

### Creating a game
Tap **＋ New Game** on the main screen. A new game record is created and you land on the Scorekeeper setup screen. The game shows as **● Pending** on the main screen until tracking is started.

### Discarding a game before it starts
On the setup screen, tap **Discard game** (shown below the import/export buttons). This permanently deletes the game and returns you to the main screen. This option disappears once you tap **Start Tracking →**.

### Deleting a game
On the main screen, tap **🗑** on any game card:
1. First confirmation: *"Delete this game?"*
2. Second confirmation: *"Permanently delete? Cannot be undone."*

Deletion removes the game and all its stats from the database. There is no recovery.

---

## 5. Scorekeeper — Setup

### Home and Away
The left team card is always **Home** and the right card is **Away**. This matters for button styling in the tracking UI — home team buttons are white with a colored border (white jerseys), away team buttons are solid color (colored jerseys). This makes it fast to match what you see on the field to what you tap on screen.

### Loading a saved team
If you have saved rosters (including ones shared with you), a **Load saved…** dropdown appears at the top of each team card. Selecting a team fills the name, color, and roster — all fields remain editable after loading.

### Roster entry
Type players into the text area, one per line (`#number Name`). A live preview below shows how many players were parsed and lists the first five. Validation rules:
- **No duplicate numbers** — any duplicates are listed in red and must be fixed before starting
- **Minimum 10 players per team** — required to start tracking (matches the minimum for a legal game)

You can also **Upload CSV** with one player per row (number and name as separate columns, or combined).

### Starting tracking
Once both rosters pass validation, tap **Start Tracking →**. The game status changes to **● Live** and the button on the main screen changes from **Setup** to **Score**.

### Import / Export
- **Export game (JSON)** — copies the full game state to your clipboard for backup or transfer
- **Import game (JSON)** — paste exported JSON to restore a game's state

---

## 6. Scorekeeper — Tracking Events

The **Track** tab is the core of the app. Every stat entry follows a guided step flow:

```
Step 1 → Select team
Step 2 → Select event type
Step 3 → Select player (if applicable)
Step 4 → Answer follow-up questions (if applicable)
```

Tap **← Back** at any step to go back without committing anything.

### Selecting a team

Two large buttons show the current score for each team. Home (white jersey) is the white-bordered button; Away (colored jersey) is the solid-color button. Each button also shows how many **timeouts remaining** the team has in the current period.

### Selecting a player

Players are shown in a grid. Home team players use the white-bordered style; away team players use solid color. The grid fills as much of the screen as possible to minimize scrolling.

### Time entry

Several events ask for the time remaining in the current quarter. A scroll wheel lets you pick minutes and seconds. The wheel automatically scrolls to the most recently recorded time — if a goal was logged at 8:54, the wheel opens positioned at 8:54 so you only need to scroll down from there. Any new timed entry must be at or before the most recent recorded time across all events (goals and timeouts) in the current quarter.

### Last entry banner

After each committed entry, a banner shows a summary of what was recorded and an **undo** button. Tapping undo removes the entire entry group instantly. The banner disappears once you start a new entry.

### Save indicator

The header shows **Saving…** while writing to the database and **Saved ✓** on success. Stats are written approximately 800ms after the last entry to reduce unnecessary writes.

---

## 7. Event Reference

### Goal 🥍
**Who:** The player who scored.

**Follow-ups:**
1. **Assist?** — Yes: pick the assisting player from the same team's roster.
2. **EMO?** — Was this scored on a man-up? Credits the team with a Successful EMO and the opposing team with a Failed MDD.
3. **Time remaining?** — Time left in the quarter when the goal was scored.

### Shot 🎯
**Who:** The player who shot.

**Follow-up:** After selecting the shooter, choose one outcome:
- **Missed / wide** — logs the shot, no SOG.
- **Saved** — pick the goalie from the defending roster. Credits the goalie with a Save and counts as a SOG for the shooter. The last known goalie appears as a full-width button at the top of the grid for quick re-selection; the full roster is below for substitutions.
- **Blocked** — pick the blocking field player from the opposing roster. Credits the blocker with a Block. Not a SOG.
- **Off the post / crossbar** — counts as a SOG for the shooter.

### Ground Ball 🪣
**Who:** The player who picked it up. Commits immediately after player selection.

### Faceoff Win 🔄
**Who:** The player who won the faceoff. Commits immediately.

### Turnover ↩️
**Who:** The player who turned the ball over. Use this for unforced turnovers.

### Forced TO 🥊
**Who:** The player who applied the pressure (caused the turnover).

**Follow-up:** Pick the opposing player who turned the ball over. Both the forced turnover and the turnover are recorded in the same entry group.

### Penalty 🟨
**Who:** The player who committed the foul.

**Follow-ups:**
1. **Foul** — select the specific foul from the list. The app infers whether it is a technical (30 sec) or personal foul automatically.
   - *Technicals:* Conduct, Holding, Illegal Procedure, Interference, Offsides, Pushing
   - *Personals:* Cross Check, Illegal Body Check, Illegal Equipment, Slashing, Tripping, Unnecessary Roughness, Unsportsmanlike Conduct
2. **Minutes** (personal only) — 1, 2, or 3 minutes.
3. **Releasable or non-releasable?** (personal only) — tap **Releasable** for a standard penalty (released when the opposing team scores) or **Non-Releasable** if the referee signals NR (player serves the full duration regardless of goals).
4. **Time remaining** — time left in the quarter when the referee called the foul. Multiple penalties from the same dead-ball stoppage can share the same time.

The app automatically handles the serving order for **consecutive fouls** (two penalties on the same player from the same dead-ball cycle — the player serves them back-to-back) and **simultaneous fouls** (one penalty per team from the same dead-ball cycle — the overlapping window is forced NR for both).

### Penalty Box

While any penalties are active, a **Penalty Box** table appears on the Track screen above the **End Q#** button. Each row shows:

- **Team color indicator** — a solid circle for the away team; a white circle with a colored border for the home team (matching the jersey styling convention). Consecutive second penalties show a └ indent instead.
- **Player number**
- **Release time** — the time remaining at which the player exits. A **NR** badge means the penalty is non-releasable. A quarter label (e.g. *Q3*) appears if the penalty carries into the next quarter.

A player serving two consecutive penalties is shown as two rows — the first (primary) and the second indented beneath it. The second row becomes active as soon as the first expires or is goal-released.

When a goal is scored and releases a releasable penalty, any consecutive penalty waiting behind it is also released simultaneously.

---

### MDD Stop 🛡️
**Team stat.** Log when the defense successfully holds off an EMO without allowing a goal. Commits immediately for the selected team. Automatically credits the opposing team with a Failed EMO.

### Timeout ⏸️
**Team stat.** Log when either team calls a timeout.

**Follow-up:** Time remaining in the quarter. You can also tap **Log without time** if the exact time isn't available.

See [Timeouts](#8-timeouts) for rules on how many each team gets.

### Successful Clear ⬆️
**Team stat.** Commits immediately. Automatically credits the opposing team with a Failed Ride.

### Failed Clear ⬇️
**Team stat.** Commits immediately. Automatically credits the opposing team with a Successful Ride.

---

## 8. Timeouts

**Allowance per team:**
- **First half** (Q1 + Q2 combined): 2 timeouts
- **Second half** (Q3 + Q4 combined): 2 timeouts (fresh — unused first-half timeouts do not carry over)
- **Each OT period**: 1 timeout (does not carry between OT periods or from regulation)

The remaining count for each team is shown on the team select buttons in the Track screen. Once a team has used all their timeouts for the period, logging another will still work technically but will be reflected in the stats.

---

## 9. Quarter & Game Management

### Ending a quarter

Tap **End Q# →** at the bottom of the Track screen. A confirmation screen shows a stat summary for the current quarter. Tap the confirm button to lock it.

After a quarter ends:
- Stats for the completed quarter are locked
- The current quarter advances automatically
- Completed quarters show in gray in the quarter filter; the current quarter shows with a green **●** dot

### Quarter 4 — Final or Overtime

When ending Q4, the app checks the score:
- **Not tied** → the game is finalized. A **Final** banner replaces the live scoreboard.
- **Tied** → overtime begins (OT1, OT2, etc.)

### Overtime (sudden death)

The first team to score in overtime wins. The app automatically finalizes the game as soon as an OT goal is logged — no need to manually end the quarter.

---

## 10. Editing and Deleting Entries

### Editing an entry
1. Go to the **Event Log** tab in the Scorekeeper.
2. Tap **✏️** on any entry group.
3. The tracking flow restarts with the original values. Make your changes and complete the flow.
4. The edited entry replaces the original in its original chronological position. The quarter is preserved.

Tap **cancel edit** in the yellow banner at the top of the Track screen to abort.

### Deleting an entry
1. In the **Event Log** tab, tap **✕** on an entry group.
2. Confirm deletion.
3. All linked entries in the group are removed (e.g., deleting a goal also removes the assist, EMO flag, and time).

### Undo last entry
Immediately after any new entry, an **undo** button appears in the banner. Tapping it removes the entire entry group instantly with no confirmation.

---

## 11. Stats Views

Stats are available in both the Scorekeeper (**Stats** and **Event Log** tabs) and the Live View. A **quarter filter** at the top lets you view all quarters combined or any individual quarter. The live quarter shows a green **●** dot.

### Summary tab
A two-column grid showing team totals for every tracked stat side by side, organized into sections: **Scoring**, **Defense**, **Shooting**, **Possession**, **Clearing**, and **Penalties**. See [Stat Definitions](#15-stat-definitions) for the full list.

### Players tab
A sortable table of individual player stats. Tap any column header to sort by that stat (descending). Players are grouped by team with a colored team header row. Team-only stats (clears, rides, MDD, EMO fail) are not shown in this table.

### Timeline tab
A reverse-chronological list of goals, timeouts, and penalties, showing:
- **Time remaining** (if recorded) and **quarter**
- **Team**
- **Scorer** (goals), "⏸ Timeout", or specific foul name and duration (penalties — e.g. `🟨 Pushing (30s)`, `🟥 Slashing (2min NR)`)
- **Assist** if applicable
- **Running score** at that moment in the game

### Event Log tab *(Scorekeeper only)*
A full reverse-chronological feed of every event, grouped by play. Shows edit (✏️) and delete (✕) controls. Quarter dividers appear in the "All" view.

---

## 12. Live View

Open via **View** on any game card, or navigate directly to `/games/:id/view`.

- **Read-only** — no editing controls
- **Realtime** — updates automatically as the scorekeeper enters stats; no refresh needed
- **Shareable** — send the URL to coaches, parents, or anyone following the game
- **No account required** — anyone with the link can view

The header shows **● Live** or **Final**. For live games, the latest recorded time remaining is shown above the score (e.g., *8:54 remaining · Q2*) — this is the most authoritative clock reference available from the scorebook.

The same **Summary**, **Players**, and **Timeline** tabs are available with the same quarter filter. A **Press Box ↗** button in the header links to the full press box dashboard for the same game.

---

## 13. Press Box

Open via **Press Box** on any game card, the Live View header, or navigate directly to `/games/:id/pressbox`.

- **Read-only** — no editing controls
- **Realtime** — updates live as the scorekeeper enters stats
- **No account required** — anyone with the link can view
- **Designed for tablets and laptops** — fills the full screen width in a two-column layout

The press box shows everything at once without tabs:

**Left column:**
- Score banner with large live score and current clock
- Score by Quarter table (full width, above the columns)
- Team Stats — full breakdown by section (Scoring, Defense, Shooting, Possession, Clearing, Penalties) with both teams side-by-side

**Right column:**
- Player Stats — sortable table; use the **Home / Away** toggle buttons in the header to switch between teams
- Event Log — all events newest first, scrollable; NR penalties are highlighted in red
- Timeline — goals, timeouts, and penalties in reverse chronological order with running score

A **quarter filter** above the two columns affects all sections simultaneously.

---

## 14. Admin Panel

Admin accounts have access to `/admin`. If you are an admin, an **Admin →** button appears in the top-right of the main screen.

### All Games tab
Shows every game across all users. Live games are shown at the top; Pending and Final games are in collapsible sections. Each row shows the owner's username, score, status, and live clock (updated in real time for live games).

- **View** — opens the read-only Live View
- **Score / Setup** — opens the Scorekeeper (Setup for pending games, Score for live/final)
- **⚙** — expand to reassign the game to a different owner, or permanently delete the game (two-stage confirmation)
- **+ New Game for User** — select any user from a dropdown and create a game on their behalf; lands on that game's setup screen immediately

### Users tab
- **Create User** — enter a username and password to create a new account. The new user can sign in immediately.
- Each user row shows their username, admin status, and game count.
- Tap a user row to expand and see their individual games with scores, status, and **View** / **Score/Setup** buttons.
- **Make admin / Revoke admin** — toggle admin privileges for any user except yourself.
- **🗑** — delete a user account (two-stage confirmation, same as game delete). You cannot delete your own account.

### Rosters tab
Shows all saved rosters across all users, grouped by owner. Tap an owner to expand their rosters; tap a roster to edit it inline.

- **Edit** — change the roster's name, color, or player list (same editor as the user-facing Rosters tab)
- **Owner** — reassign the roster to any other user
- **Sharing** — add or remove share access for any user, same as the roster owner would do themselves
- **+ New Roster for User** — select an owner, then fill in the roster details; the new roster is created under that user's account

---

## 15. Stat Definitions

### Scoring

| Abbrev | Name | Description |
|---|---|---|
| **G** | Goals | Goals scored |
| **A** | Assists | Pass directly leading to a goal |
| **EMO** | Successful EMO | Goals scored while on a man-up power play |
| **FEMO** | Failed EMO | Man-up opportunities that ended without a goal; equals opponent's MDD stops (auto-computed) |
| **EMO %** | EMO percentage | Successful EMO ÷ (Successful + Failed EMO) |

### Defense

| Abbrev | Name | Description |
|---|---|---|
| **MDD** | Successful MDD | Man-down defensive stops — logged when the defense successfully kills a penalty without conceding |
| **FMDD** | Failed MDD | Man-down situations that resulted in a goal; equals opponent's EMO goals (auto-computed) |
| **MDD %** | MDD percentage | Successful MDD ÷ (Successful + Failed MDD) |
| **Sv** | Saves | Shots stopped by the goalie (credited to the defending team's goalie) |
| **Save %** | Save percentage | Saves ÷ Opponent's SOG |
| **FTO** | Forced turnovers | Turnovers caused by applied pressure (credited to the forcing player) |

### Shooting

| Abbrev | Name | Description |
|---|---|---|
| **Sh** | Total shots | All shot attempts (saved, blocked, post, missed) — does not include goals |
| **Shot %** | Shot percentage | Goals ÷ Total shots |
| **SOG** | Shots on goal | Shots that challenged the goalie: goals + saves + post/crossbar hits (player stat) |
| **SOG %** | SOG percentage | Goals ÷ SOG |
| **Blk** | Blocked shots | Shots blocked by a field player (credited to the blocker) |

### Possession

| Abbrev | Name | Description |
|---|---|---|
| **GB** | Ground balls | Loose ball pickups |
| **FW** | Faceoff wins | Faceoffs won |
| **TO** | Turnovers | Turnovers committed |

### Clearing & riding

| Abbrev | Name | Description |
|---|---|---|
| **Clr** | Successful clears | Team cleared from the defensive half |
| **FCl** | Failed clears | Team failed to clear |
| **Clearing %** | Clearing percentage | Successful clears ÷ (Successful + Failed clears) |
| **SRide** | Successful rides | Opponent's failed clears (auto-computed) |
| **FRide** | Failed rides | Opponent's successful clears (auto-computed) |

### Penalties

| Abbrev | Name | Description |
|---|---|---|
| **Tech** | Technical fouls | 30-second releasable fouls |
| **PF Min** | Personal foul minutes | Total penalty minutes from personal fouls (1–3 min each; may be non-releasable) |

---

## Tips

- **Fastest workflow:** keep the Track screen open the whole game. Flip to Stats to check a quarter, then come right back.
- **Jersey colors guide your eye:** home team is the white-bordered button, away is solid color — same as what you see on the field.
- **Time wheel:** opens positioned at the last recorded time. Scroll down from there for anything that happened after.
- **Missed a stat?** Edit from the Event Log at any time, even from a completed quarter. Edits preserve the original quarter and chronological position.
- **MDD Stop:** log this every time the defense kills a penalty without conceding — it directly drives MDD % and EMO Fail for the opponent.
- **Blocked shots:** pick the field player who made the block, not the goalie. The goalie's stops are recorded via the Shot → Saved path.
- **Two devices:** run the Scorekeeper on a phone at the table, and open the Live View on a laptop or iPad on the bench for the coaching staff.
- **Faceoff:** select the winning player and tap Faceoff W. The losing player does not receive a turnover.
- **Shared rosters:** if another user has shared a roster with you, it appears in your **Load saved…** dropdown in game setup and under **Shared with me** in the Rosters tab.
