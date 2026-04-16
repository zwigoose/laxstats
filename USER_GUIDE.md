# LaxStats — User Guide

LaxStats is a live men's lacrosse stat-tracking app. One person runs the **Scorekeeper** view on their device during a game; anyone else can follow along in real time on the **Live View** from their own device.

---

## Table of Contents

1. [Main Screen](#1-main-screen)
2. [Roster Management](#2-roster-management)
3. [Creating a Game](#3-creating-a-game)
4. [Scorekeeper — Setup](#4-scorekeeper--setup)
5. [Scorekeeper — Tracking Events](#5-scorekeeper--tracking-events)
6. [Event Reference](#6-event-reference)
7. [Quarter & Game Management](#7-quarter--game-management)
8. [Editing and Deleting Entries](#8-editing-and-deleting-entries)
9. [Stats Views](#9-stats-views)
10. [Live View](#10-live-view)
11. [Stat Definitions](#11-stat-definitions)

---

## 1. Main Screen

The main screen (`/`) has two tabs:

### Games tab
Lists all games ordered newest first. Each card shows:
- **Team names and score** (once tracking has begun)
- **Status pill** — green **● Live** while in progress, gray **Final** when complete, or *Not started* for a brand-new game
- **View** — opens the read-only Live View for that game
- **Score** — opens the Scorekeeper for that game
- **🗑** — delete the game (requires two confirmations; see [Deleting a Game](#deleting-a-game))

### Rosters tab
Manage saved team rosters that can be quickly loaded into any game setup. See [Roster Management](#2-roster-management).

---

## 2. Roster Management

Saved rosters let you build a team once and reuse it across many games without re-typing players each time.

### Creating a saved team
1. Go to the **Rosters** tab on the main screen.
2. Tap **+ New Team**.
3. Enter a **team name**, pick a **color**, and type the **roster** (one player per line in `#number Name` format).
4. Tap **Save team**.

### Editing a saved team
Tap any team row to expand it, make changes, then tap **Save changes**.

### Deleting a saved team
Expand the team row, tap **Delete**, then **Confirm delete**. This only removes the saved roster — it does not affect any game that already used it.

### Roster format
```
#2 John Smith
#7 Mike Johnson
#11 Alex Williams
```
The `#` before the number is optional. Both `#2 John Smith` and `2 John Smith` work.

---

## 3. Creating a Game

Tap **＋ New Game** on the main screen hero. A new game record is created instantly and you are taken directly to the Scorekeeper setup screen.

### Deleting a game
On the main screen, tap the **🗑** icon on a game card:
1. First confirmation: *"Delete this game?"* — tap **Delete** to continue.
2. Second confirmation: *"Permanently delete? Cannot be undone."* — tap **Yes, delete** to remove the game and all its stats from the database permanently.

Tap **Cancel** at either step to abort.

---

## 4. Scorekeeper — Setup

Before tracking begins, configure both teams on the **Setup** tab.

### Loading a saved team
If you have saved rosters, a **Load saved…** dropdown appears in the top corner of each team card. Select a team to populate the name, color, and roster automatically. You can edit any field after loading.

### Team name
Type the team name in the text field. This name appears on all scoreboards and stat views.

### Team color
Pick from the ten preset color swatches or click the color picker icon for a custom color. The color is used throughout the app to visually distinguish the two teams.

### Roster entry
Type players into the text area, one per line:
```
#2 John Smith
#7 Mike Johnson
```
A live preview below the text area shows how many players have been parsed and lists the first five.

You can also **Upload CSV** — the file should have one player per row with number and name as separate columns (or combined in one column).

### Starting tracking
Once both rosters have at least one player, the **Start Tracking →** button becomes active. Tap it to move to the tracking screen.

> **Note:** You can return to Setup at any time during a game to correct team names, colors, or rosters. Changes take effect immediately.

### Import / Export
- **Export game (JSON)** — copies the full game state to your clipboard as JSON. Useful for backup or transferring a game to another device.
- **Import game (JSON)** — paste exported JSON to restore a game's state.

---

## 5. Scorekeeper — Tracking Events

The **Track** tab is the heart of the app. Every stat entry follows a guided multi-step flow:

```
Step 1 → Select team
Step 2 → Select event type
Step 3 → Select player (if applicable)
Step 4 → Answer follow-up questions (if applicable)
```

Tap **← Back** at any step to go back one level without committing anything.

### Step 1 — Select team
Tap the button for the team that the event belongs to. For most events this is the team that *performed* the action (e.g., the team that scored the goal, won the faceoff, or committed the turnover).

### Step 2 — Select event type
See [Event Reference](#6-event-reference) for a full description of each event.

### Step 3 — Select player
Tap a player button from the roster grid. For **Successful Clear** and **Failed Clear** these are team stats with no individual player — the entry is committed immediately after selecting the event.

### Step 4 — Follow-up questions
Depending on the event, additional questions appear:

| Event | Follow-up questions |
|---|---|
| **Shot** | Was it saved? → Yes: pick the goalie / No: record as unsaved shot |
| **Goal** | Was there an assist? → Yes: pick the assisting player / Was it EMO? → What was the time remaining? |
| **Forced TO** | Pick the opposing player who turned the ball over |
| **Penalty** | Technical foul or Personal foul? → Personal: how many minutes? (1, 2, or 3) |
| All others | Commits immediately after player selection |

### Last entry banner
After each committed entry, a banner at the top of the Track screen shows a summary of what was just recorded and an **undo** button. Tapping undo removes that entire entry group instantly, with no additional confirmation.

### Save indicator
The header shows **Saving…** while writing to the database and **Saved ✓** on success. Stats are debounced and written approximately 800ms after the last entry.

---

## 6. Event Reference

| Event | Who gets it | Notes |
|---|---|---|
| **Goal** 🥍 | The player who scored | Triggers follow-up for assist, EMO, and time remaining |
| **Shot** 🎯 | The player who shot | Triggers follow-up for save; if saved, the goalie also gets a **Save** credited to the opposing team |
| **Ground Ball** 🪣 | The player who picked it up | — |
| **Faceoff W** 🔄 | The player who won the faceoff | — |
| **Turnover** ↩️ | The player who turned it over | Record directly; or use **Forced TO** if an opposing player caused it |
| **Forced TO** 🥊 | The player who forced the turnover | The app also records a **Turnover** for the opposing player you select in the follow-up |
| **Penalty** 🟨 | The player who committed the foul | **Technical** = no time served; **Personal** = 1, 2, or 3 minutes |
| **Successful Clear** ⬆️ | Team stat (no player) | Automatically counts as a **Failed Ride** for the opposing team |
| **Failed Clear** ⬇️ | Team stat (no player) | Automatically counts as a **Successful Ride** for the opposing team |

> **Rides vs. Clears:** You never need to enter a ride directly. Every clear entry automatically updates both teams' ride and clear stats simultaneously.

---

## 7. Quarter & Game Management

### Ending a quarter
At the bottom of the **Track** screen, tap **End Q# →**. A confirmation screen shows a quick stat summary for the current quarter. Tap the confirm button to lock the quarter.

After a quarter is ended:
- The app moves to the **Stats** tab showing the just-completed quarter.
- The current quarter advances automatically.
- Locked quarters are grayed out in the quarter-filter bar; the live quarter shows a green **●** dot.

### Quarter 4 — Final or Overtime
When you end Q4, the app checks the score:
- **Score is not tied** → the game is finalized. A **Final** banner replaces the live scoreboard.
- **Score is tied** → overtime begins (OT1, OT2, … as needed).

### Overtime (sudden death)
In overtime, the **first goal wins**. As soon as a goal is recorded in an overtime period, the game is automatically finalized — no need to manually end the quarter.

---

## 8. Editing and Deleting Entries

### Editing an entry
1. Go to the **Event Log** tab in the Scorekeeper.
2. Tap the **✏️** button on any entry group.
3. The tracking flow restarts pre-filled with the original data. Make your changes and complete the flow as normal.
4. The edited entry replaces the original in its original position in the log (the quarter and chronological order are preserved).

> Tap **cancel edit** in the yellow banner at the top of the Track screen to abort without saving changes.

### Deleting an entry
1. In the **Event Log** tab, tap the **✕** button on an entry group.
2. Confirm deletion in the modal that appears.
3. All entries in that group are removed (e.g., deleting a goal also removes the linked assist and EMO flag).

### Undo last entry
Immediately after any new entry, an **undo** button appears in the banner at the top of the Track screen. This removes the entire entry group with one tap and no confirmation dialog.

---

## 9. Stats Views

Stats are available in both the Scorekeeper (tabs at the top) and the Live View. A **quarter filter** at the top lets you view stats for all quarters combined or drill into a single quarter.

### Summary tab
Two-column grid of team totals for every tracked stat. See [Stat Definitions](#11-stat-definitions) for the full list.

### Players tab
A sortable table of individual player stats. Tap any column header to sort by that stat (descending). Players are grouped by team. Team-only stats (clears, rides) are not included in this table.

### Timeline tab
A reverse-chronological list of every goal scored, showing:
- **Time remaining** in the quarter (if recorded)
- **Quarter**
- **Team**
- **Scorer** and **EMO** flag if applicable
- **Assist** (if recorded)
- **Running score** after each goal

### Event Log tab
A full reverse-chronological feed of every event, grouped by play (e.g., a goal entry also shows the linked assist and EMO in the same group). Available only in the Scorekeeper — use the Live View for a read-only stats summary.

---

## 10. Live View

Navigate to `/games/:id/view` or tap **View** on a game card from the main screen. The Live View is:

- **Read-only** — no editing controls are shown
- **Realtime** — updates automatically as the scorekeeper enters stats; no page refresh needed
- **Shareable** — send the URL to coaches, parents, or anyone who wants to follow along

The header shows a green **● Live** badge during the game and a **Final** badge once the game is complete.

The same **Summary**, **Players**, and **Timeline** tabs are available, with the same quarter filter.

---

## 11. Stat Definitions

| Abbreviation | Full name | How it's recorded |
|---|---|---|
| **G** | Goals | Goals scored |
| **EMO** | Extra-man opportunity goals | Goals scored while on a man-up (flagged during goal entry) |
| **Sh** | Shots | All shots on goal (goals + saves + missed shots) |
| **Shot %** | Shot percentage | Goals ÷ Shots |
| **Sv** | Saves | Shots stopped by the goalie (credited to the *opposing* team's goalie) |
| **Save %** | Save percentage | Saves ÷ Opposing shots faced |
| **GB** | Ground balls | Loose ball pickups |
| **FW** | Faceoff wins | Faceoffs won |
| **TO** | Turnovers | Turnovers committed |
| **FTO** | Forced turnovers | Turnovers caused (the player who applied pressure) |
| **Tech** | Technical fouls | Non-releasable fouls (no time served) |
| **PF Min** | Personal foul minutes | Total penalty minutes from personal fouls |
| **A** | Assists | Pass directly leading to a goal |
| **Clr** | Successful clears | Team cleared the ball from the defensive half |
| **FCl** | Failed clears | Team failed to clear the ball |
| **Clearing %** | Clearing percentage | Successful clears ÷ (Successful + Failed clears) |
| **SRide** | Successful rides | Opponent's failed clears (credited automatically) |
| **FRide** | Failed rides | Opponent's successful clears (credited automatically) |

---

## Tips

- **Fastest workflow:** keep the Track screen open the whole game. Use the quarter-filter on the Stats tab to review just the current quarter without losing your place.
- **Missed a stat?** Use the Event Log to go back and edit or delete any entry at any time, even from prior quarters.
- **Two devices:** open the Scorekeeper on a phone or tablet on the sideline, and open the Live View on a laptop or second screen for a coaching staff overview.
- **Faceoff setup:** select the faceoff player, tap **Faceoff W** — that's it. No need to record the other player's turnover separately; faceoff losers do not receive a turnover.
- **Assisted goals:** the assist is linked to the goal in the same entry group. If you forget to add an assist, use ✏️ edit in the Event Log to add it after the fact.
