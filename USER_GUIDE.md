# LaxStats — User Guide

LaxStats is an electronic scorebook and league management platform for men's lacrosse. It replaces the clipboard at the scorer's table — one or more people enter stats on a phone or tablet during the game, and everyone else follows along live from their own device.

---

## Table of Contents

1. [Accounts & Login](#1-accounts--login)
2. [Navigation](#2-navigation)
3. [Organizations](#3-organizations)
4. [Season & Team Management](#4-season--team-management)
5. [Roster Management](#5-roster-management)
6. [Creating and Managing Games](#6-creating-and-managing-games)
7. [Scorekeeper — Setup](#7-scorekeeper--setup)
8. [Scorekeeper — Tracking Events](#8-scorekeeper--tracking-events)
9. [Event Reference](#9-event-reference)
10. [Timeouts](#10-timeouts)
11. [Quarter & Game Management](#11-quarter--game-management)
12. [Multi-User Scoring](#12-multi-user-scoring)
13. [Editing and Deleting Entries](#13-editing-and-deleting-entries)
14. [Stats Views](#14-stats-views)
15. [Live View](#15-live-view)
16. [Press Box](#16-press-box)
17. [Admin Panel](#17-admin-panel)
18. [Stat Definitions](#18-stat-definitions)

---

## 1. Accounts & Login

### Signing in
Enter your **username** and **password** on the login screen and tap **Sign in**. If you have a real email address registered, you can enter that instead — the app detects the `@` and uses it as-is.

### Creating an account
Tap **Sign up** on the login screen, choose a username and password (minimum 6 characters), and tap **Create account**. An admin can also create an account for you from the Admin panel.

### Signing in as a guest scorer
If someone sends you a scorer invite link, open it in any browser. The app will sign you in automatically as a guest — no account or password required. You'll be taken directly to the scorekeeper. Guest sessions are tied to that link and that game only.

### Signing out
Tap **Sign out** in the top-right of the main screen.

---

## 2. Navigation

The top nav bar is visible on all pages except the Scorekeeper and Press Box (which use full-screen layouts).

- **LaxStats** (logo) — returns to the home screen
- **Home** — your game list
- **Orgs** — your organization memberships (visible if you belong to at least one org)
- **Admin** — platform admin panel (visible to admin accounts only)

---

## 3. Organizations

Organizations are the top-level structure for teams, seasons, and games. A single org can represent a program, a club, or a league.

### Creating an org
Navigate to **Orgs** in the top nav and tap **+ New Organization**. Enter a name and a URL-friendly slug (e.g. `notre-dame-prep`). You are automatically made an org admin.

### Org dashboard
Each org has a dashboard at `/orgs/:slug` with three tabs:

- **Games** — all games in this org, grouped by live / pending / final. Includes direct links to score, view, and the press box.
- **Seasons** — list of seasons with date ranges. Tap a season to see per-season stats.
- **Teams** — teams registered to this org. Tap a team to manage its roster.

### Org roles

| Role | Can do |
|---|---|
| **Org admin** | Everything — manage members, teams, seasons, games |
| **Coach** | Create games, manage rosters, score games |
| **Scorekeeper** | Score games they are invited to |
| **Viewer** | View games and stats only |

Members are managed from the org dashboard by an org admin or platform admin.

---

## 4. Season & Team Management

### Creating a season
From the org dashboard **Seasons** tab, tap **+ New Season**. Enter a name (e.g. *Spring 2026*) and optional start and end dates.

### Creating a team
From the org dashboard **Teams** tab or the Team Manager (`/orgs/:slug/teams`), tap **+ New Team**. Enter a name and pick a color.

### Adding players to a team
Open the Team Manager and tap a team to expand it. Add players with a jersey number and name. This is the **base roster** — it carries into every season.

### Adding a team to a season
From a season's detail view, tap **+ Add Team**. This creates a season-specific roster snapshot from the team's base roster. Jersey numbers can be overridden per season without changing the base.

### Season stats
Per-season stats roll up automatically across all games in the season for any registered player. View them from the season detail page.

---

## 5. Roster Management

Saved rosters let you enter a team once and load it into any future personal game in a single tap. For org games, use registered teams instead.

### Creating a saved team
1. Go to the **Rosters** tab on the home screen and tap **+ New Team**.
2. Enter a team name, pick a color, and type the roster (one player per line).
3. Tap **Save team**.

### Roster format
```
#2 John Smith
#7 Mike Johnson
#11 Alex Williams
```
The `#` is optional. Players must have unique numbers.

### Sharing a roster
You can share a roster with another user so they can load it into their games.

1. Expand the team row you want to share.
2. In the **Sharing** section, type the other user's username and tap **Find**.
3. Confirm the username shown and tap **Share**.

Shared users can load the roster but cannot edit or delete it.

---

## 6. Creating and Managing Games

### Creating a game
Tap **＋ New Game** on the home screen. You will be asked to choose:

- **Personal game** — standalone game linked to your account only; not part of any org or season
- **Org game** — linked to an organization; optionally tied to a season and registered teams

For org games, select the org, optionally a season, and optionally home and away teams from the org's registered teams.

### Moving a personal game to an org
Pending personal games can be transferred to an org. On the game card, tap the **Move to org** option (visible on personal pending games when you belong to at least one org).

### Deleting a game
On the home screen, tap **🗑** on any game card and confirm twice. Deletion is permanent.

---

## 7. Scorekeeper — Setup

### Home and Away
The left team card is always **Home**, the right is **Away**. Home team buttons are white with a colored border; away team buttons are solid color — matches jersey colors on the field.

### Loading a saved team or org team
- **Personal games** — a **Load saved…** dropdown appears if you have saved rosters. Selecting one fills the name, color, and roster.
- **Org games** — if home and away teams were set when the game was created, their registered rosters load automatically. You can still edit the roster before starting.

### Roster entry
Type players into the text area, one per line (`#number Name`). Validation rules:
- No duplicate numbers
- Minimum 10 players per team

You can also **Upload CSV** with one player per row.

### Starting tracking
Once both rosters pass validation, tap **Start Tracking →**.

### Import / Export
- **Export game (JSON)** — copies the full game state to your clipboard
- **Import game (JSON)** — paste exported JSON to restore a game's state

---

## 8. Scorekeeper — Tracking Events

The **Track** tab follows a guided step flow:

```
Step 1 → Select team
Step 2 → Select event type
Step 3 → Select player (if applicable)
Step 4 → Answer follow-up questions (if applicable)
```

Tap **← Back** at any step to go back without committing anything.

### Selecting a team
Two large buttons show the current score. Home is the white-bordered button; Away is the solid-color button. Each shows timeouts remaining for the current period.

### Time entry
Events that need a clock time use a numeric keypad. Type 1–4 digits (seconds only, or M:SS format) and confirm. The keypad validates against the quarter ceiling and shows an error if the entered time is after the most recent recorded event. A **Same as latest** shortcut appears for penalty entries during a dead-ball cycle.

### Last entry banner
After each committed entry, a banner shows what was recorded and an **undo** button. Tapping undo removes the entire entry group instantly.

### Save indicator
The header shows **Saving…** while writing to the database and **Saved ✓** on success.

---

## 9. Event Reference

### Goal 🥍
**Follow-ups:** Assist? → EMO? → Time remaining

### Shot 🎯
**Follow-up:** Outcome — Missed / Saved (pick goalie) / Blocked (pick blocker) / Off the post

### Ground Ball 🪣
Commits immediately after player selection.

### Faceoff Win 🔄
Commits immediately.

### Turnover ↩️
Unforced turnover. Commits immediately.

### Forced TO 🥊
**Follow-up:** Pick the opposing player who turned it over. Both the forced TO and the turnover are recorded in one group.

### Penalty 🟨
**Follow-ups:**
1. **Foul** — select from the list; tech vs. personal is inferred automatically
   - *Technicals (30s):* Conduct, Holding, Illegal Procedure, Interference, Offsides, Pushing
   - *Personals (1–3 min):* Cross Check, Illegal Body Check, Illegal Equipment, Slashing, Tripping, Unnecessary Roughness, Unsportsmanlike Conduct
2. **Minutes** (personal only) — 1, 2, or 3
3. **Releasable or non-releasable?** (personal only)
4. **Time remaining**

The app automatically handles **consecutive fouls** (same player, same dead-ball cycle — served back-to-back) and **simultaneous fouls** (one per team, same dead-ball cycle — overlapping window forced NR for both).

### Penalty Box
While any penalties are active, a **Penalty Box** table appears on the Track screen above the **End Q#** button. Each row shows the player's number, release time, NR badge, and a quarter label if the penalty carries across a quarter break.

### MDD Stop 🛡️
Team stat. Log when the defense kills a penalty without conceding. Automatically credits the opposing team with a Failed EMO.

### Timeout ⏸️
Team stat. **Follow-up:** Time remaining (or tap **Log without time**).

See [Timeouts](#10-timeouts) for allowances per period.

### Successful Clear ⬆️
Team stat. Automatically credits the opposing team with a Failed Ride.

### Failed Clear ⬇️
Team stat. Automatically credits the opposing team with a Successful Ride.

---

## 10. Timeouts

**Allowance per team:**
- **First half** (Q1 + Q2 combined): 2 timeouts
- **Second half** (Q3 + Q4 combined): 2 timeouts
- **Each OT period**: 1 timeout

Remaining counts are shown on the team select buttons. Unused first-half timeouts do not carry into the second half.

---

## 11. Quarter & Game Management

### Ending a quarter
Tap **End Q# →** at the bottom of the Track screen. A confirmation screen shows a stat summary. Tap the confirm button to lock the quarter.

### Quarter 4 — Final or Overtime
- **Not tied** → game is finalized
- **Tied** → overtime begins (OT1, OT2, etc.)

### Overtime
Sudden death. The game auto-finalizes on the first OT goal.

---

## 12. Multi-User Scoring

Multiple people can score the same game simultaneously from separate devices.

### Roles
- **Primary scorer** — the first person to open the scorekeeper. Controls quarter endings and game finalization.
- **Secondary scorer** — joined via an invite link. Can log any event type; cannot end quarters.

### Inviting a scorer
1. Open the scorekeeper as the primary scorer.
2. Tap **Invite scorer** in the header (visible when multi-scorer is enabled for the game).
3. Copy the generated link and send it to the other scorer.
4. The link expires in 24 hours. Tap **New link** to generate a fresh one.

The invite link works in any browser — the recipient does not need an account. They will be signed in automatically as a guest when they open the link.

### Real-time sync
Events entered on any device appear on all connected scorers' screens within seconds. When the primary ends a quarter, secondary scorers' views advance automatically.

### Scorer count
A badge in the scorekeeper header shows how many scorers are currently live on the game (e.g., **Primary · 2 scorers**).

### Duplicate protection
If two scorers log the same clock-anchored event (a goal or timeout at the same time), a **Possible duplicate** warning appears before the second entry is committed. Choose **Discard** to drop the duplicate, or **Log anyway** if it is genuinely a separate event.

---

## 13. Editing and Deleting Entries

### Editing an entry
1. Go to the **Event Log** tab.
2. Tap **✏️** on any entry group.
3. The tracking flow restarts with the original values. Make your changes and complete the flow.
4. The edited entry replaces the original in its original chronological position and quarter.

Tap **cancel edit** in the yellow banner to abort.

### Deleting an entry
1. In the **Event Log** tab, tap **✕** on an entry group.
2. Confirm deletion.
3. All linked entries in the group are removed (e.g., deleting a goal also removes the assist, EMO flag, and time).

### Undo last entry
Immediately after any new entry, tap **undo** in the confirmation banner to remove the entire entry group instantly.

---

## 14. Stats Views

Stats are available in the Scorekeeper (**Stats** and **Event Log** tabs), the Live View, and the Press Box. A **quarter filter** at the top lets you view all quarters combined or any individual quarter.

### Summary tab
Team totals for every tracked stat, side by side, organized into sections: Scoring, Defense, Shooting, Possession, Clearing, and Penalties.

### Players tab
Sortable table of individual player stats. Tap any column header to sort. Players are grouped by team.

### Timeline tab
Reverse-chronological list of goals, timeouts, and penalties, with time remaining, quarter, player, assist, and running score.

### Event Log tab *(Scorekeeper only)*
Full reverse-chronological feed of every event with edit and delete controls. Quarter dividers appear in the All view.

### Season stats
For org games linked to a season, per-season stats roll up automatically for registered players. View them from the season detail page in the org dashboard.

---

## 15. Live View

Open via **View** on any game card, or navigate to `/games/:id/view`.

- **Read-only** — no editing controls
- **Realtime** — updates automatically as the scorekeeper enters stats
- **Shareable** — send the URL to anyone
- **No account required**

The header shows **● Live** or **Final**. For live games, the latest recorded time remaining is shown. A **Press Box ↗** button links to the press box for the same game. Game owners and admins see an **Invite scorer** button on live v2 games.

---

## 16. Press Box

Open via **Press Box** on any game card, the Live View header, or navigate to `/games/:id/pressbox`.

- **Read-only**, **realtime**, **no account required**
- **Designed for tablets and laptops** — fills the full screen in a two-column layout

The press box shows everything at once without tabs:

**Left column:** Score banner · Score by Quarter · Team Stats

**Right column:** Player Stats (Home/Away toggle) · Event Log · Timeline

A quarter filter above the columns affects all sections simultaneously.

Press Box access is controlled per-game. Personal games require a platform admin to enable it via the game's ⚙ panel in `/admin`.

---

## 17. Admin Panel

Admin accounts have access to `/admin`. An **Admin** link appears in the top nav for admin accounts.

### All Games tab
Every game across all users. Live games shown first; Pending and Final in collapsible sections.

Each game row's **⚙** panel offers:
- **Reassign owner** — transfer the game to a different user
- **Press Box** toggle — enable the press box link for this game
- **Multi-Scorekeeper** toggle — enable scorer invite links for this game (v2 games only)
- **Delete game** — two-stage confirmation; permanently removes the game and all its events

**+ New Game for User** creates a v2 game under any user's account.

### Users tab
- **Create User** — username and password; the user can sign in immediately
- Each user row expands to show their games
- **Make admin / Revoke admin** — toggle admin privileges
- **🗑** — delete a user account (two-stage confirmation)

### Rosters tab
All saved rosters across all users. Tap a roster to edit it inline, reassign the owner, or manage sharing. **+ New Roster for User** creates a roster under any user's account.

### Orgs tab
All organizations. View members and manage org-level settings.

### Migration tab
Tools for converting v1 JSONB-log games into the v2 normalized format.

- **Dry run** — shows what would migrate without making any changes
- **Run migration** — converts all eligible v1 games; idempotent (safe to re-run); games that fail the goal-count verification gate stay as v1 and are logged to the error table

---

## 18. Stat Definitions

### Scoring

| Abbrev | Name | Description |
|---|---|---|
| **G** | Goals | Goals scored |
| **A** | Assists | Pass directly leading to a goal |
| **EMO** | Successful EMO | Goals scored while on a man-up power play |
| **FEMO** | Failed EMO | Man-up opportunities that ended without a goal; equals opponent's MDD stops |
| **EMO %** | EMO percentage | Successful EMO ÷ (Successful + Failed EMO) |

### Defense

| Abbrev | Name | Description |
|---|---|---|
| **MDD** | Successful MDD | Man-down defensive stops |
| **FMDD** | Failed MDD | Man-down situations that resulted in a goal; equals opponent's EMO goals |
| **MDD %** | MDD percentage | Successful MDD ÷ (Successful + Failed MDD) |
| **Sv** | Saves | Shots stopped by the goalie |
| **Save %** | Save percentage | Saves ÷ Opponent's SOG |
| **FTO** | Forced turnovers | Turnovers caused by applied pressure |

### Shooting

| Abbrev | Name | Description |
|---|---|---|
| **Sh** | Total shots | All shot attempts (does not include goals) |
| **Shot %** | Shot percentage | Goals ÷ Total shots |
| **SOG** | Shots on goal | Goals + saves + post/crossbar hits |
| **SOG %** | SOG percentage | Goals ÷ SOG |
| **Blk** | Blocked shots | Shots blocked by a field player |

### Possession

| Abbrev | Name | Description |
|---|---|---|
| **GB** | Ground balls | Loose ball pickups |
| **FW** | Faceoff wins | Faceoffs won |
| **TO** | Turnovers | Turnovers committed |

### Clearing & Riding

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
| **PF Min** | Personal foul minutes | Total penalty minutes from personal fouls |

---

## Tips

- **Fastest workflow:** keep the Track screen open the whole game. Flip to Stats to check a quarter, then come right back.
- **Jersey colors guide your eye:** home team is the white-bordered button, away is solid color — same as what you see on the field.
- **Time keypad:** type the time remaining as digits (e.g. `854` for 8:54) and confirm. Penalty time shows a **Same as latest** shortcut for fouls from the same dead-ball stop.
- **Missed a stat?** Edit from the Event Log at any time, even from a completed quarter.
- **MDD Stop:** log this every time the defense kills a penalty without conceding — it directly drives MDD % and EMO Fail for the opponent.
- **Blocked shots:** pick the field player who made the block, not the goalie. Goalie stops go through Shot → Saved.
- **Multi-scorer:** run the Scorekeeper on a phone at the table; send an invite link to a second device for backup coverage. Both feeds sync in real time.
- **Guest link expires in 24h:** generate a new one from the scorekeeper header if you need to re-invite.
- **Shared rosters:** appear in your **Load saved…** dropdown and under **Shared with me** in the Rosters tab.
