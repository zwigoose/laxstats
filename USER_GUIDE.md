# LaxStats — User Guide

LaxStats is an electronic scorebook and league management platform for men's lacrosse. It replaces the clipboard at the scorer's table — one or more people enter stats on a phone or tablet during the game, and everyone else follows along live from their own device.

---

## Table of Contents

1. [Accounts & Login](#1-accounts--login)
2. [Navigation](#2-navigation)
3. [Your Profile](#3-your-profile)
4. [Plans & Billing](#4-plans--billing)
5. [Organizations](#5-organizations)
6. [Season & Team Management](#6-season--team-management)
7. [Roster Management](#7-roster-management)
8. [Creating and Managing Games](#8-creating-and-managing-games)
9. [Scorekeeper — Setup](#9-scorekeeper--setup)
10. [Scorekeeper — Tracking Events](#10-scorekeeper--tracking-events)
11. [Event Reference](#11-event-reference)
12. [Timeouts](#12-timeouts)
13. [Quarter & Game Management](#13-quarter--game-management)
14. [Multi-User Scoring](#14-multi-user-scoring)
15. [Editing and Deleting Entries](#15-editing-and-deleting-entries)
16. [Stats Views](#16-stats-views)
17. [Live View](#17-live-view)
18. [Press Box](#18-press-box)
19. [Stat Definitions](#19-stat-definitions)

---

## 1. Accounts & Login

### Signing in
Enter your **email** and **password** on the login screen and tap **Sign in**.

### Creating an account
Tap **Sign up** on the login screen, enter your email address and a password (minimum 6 characters), and tap **Create account**. A confirmation email will be sent — click the link to activate your account. A platform admin can also create an account for you from the Admin panel.

### Signing in as a guest scorer
If someone sends you a scorer invite link, open it in any browser. The app will sign you in automatically as a guest — no account or password required. You'll be taken directly to the scorekeeper. Guest sessions are tied to that link and that game only.

### Signing out
Tap **Sign out** on your profile page (see [Your Profile](#3-your-profile)).

---

## 2. Navigation

The top nav bar is visible on all pages except the Scorekeeper and Press Box (which use full-screen layouts).

- **LaxStats** (logo) — returns to the home screen
- **Home** — your game list
- **Orgs** — your organization memberships (visible if you belong to at least one org)
- **Admin** — platform admin panel (visible to admin accounts only)
- **Initials avatar** (top-right) — opens your profile page

---

## 3. Your Profile

Tap the initials avatar button in the top-right corner of the nav bar to open `/profile`.

### Display name
Enter a name in the **Display name** field and tap **Save**. This name appears throughout the app in place of your email address. Leave it blank to fall back to your email.

### Changing your email
Enter a new email address and tap **Update**. A confirmation email is sent to the new address — the change does not take effect until you click the link in that email.

### Changing your password
Enter your new password twice and tap **Change password**. Minimum 6 characters. No current password is required since you are already signed in.

### Personal plan
Your current personal plan (Free, Basic, or Plus) and its status are shown on the profile page. Tap **Manage billing** to upgrade, downgrade, or cancel via the Stripe billing portal. Tap **Upgrade plan** to go to the pricing page.

### Signing out
Tap **Sign out** at the bottom of the profile page.

---

## 4. Plans & Billing

### Personal plans

| Plan | Monthly | Personal game limit |
|---|---|---|
| **Free** | $0 | 3 games |
| **Basic** | $5 | 10 games |
| **Plus** | $10 | 20 games |

Org members receive a bonus on top of their personal plan limit (Pro org: +10, Max org: +20).

### Org plans

| Plan | Monthly | Key features |
|---|---|---|
| **Pro** | $10 | Registered teams, seasons, season stats, Press Box |
| **Max** | $20 | Everything in Pro + multi-scorer, higher limits |

### Purchasing a plan
Go to `/pricing`, choose a plan, and complete checkout via Stripe. For org plans, enter a name for your organization. You will be redirected back to LaxStats when payment is complete.

### Canceling
Open your Profile and tap **Manage billing**. From the Stripe billing portal you can cancel at any time. Access continues until the end of the current billing period; after that the org or personal plan is locked to its free-tier limits.

### What happens when an org plan expires
- New game creation, new seasons, and adding members are blocked
- All existing games, stats, and data remain readable
- Org admins see a banner on the org dashboard with a **Renew →** link
- To start a new org instead of renewing the old one, go to `/pricing` and create a new org

---

## 5. Organizations

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

## 6. Season & Team Management

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

## 7. Roster Management

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

### Adding a logo to a saved team
Expand the team row and tap **Upload logo** in the Logo section. Choose a PNG or JPG; the logo is stored and will automatically appear on game cards and the scorekeeper when this roster is loaded. Tap **Remove** to clear it.

### Sharing a roster
You can share a roster with another user so they can load it into their games.

1. Expand the team row you want to share.
2. In the **Sharing** section, enter the other user's email address and tap **Find**.
3. Confirm the user shown and tap **Share**.

Shared users can load the roster but cannot edit or delete it.

---

## 8. Creating and Managing Games

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

## 9. Scorekeeper — Setup

### Home and Away
The left team card is always **Home**, the right is **Away**. Home team buttons are white with a colored border; away team buttons are solid color — matches jersey colors on the field.

### Loading a saved team or org team
- **Personal games** — a **Load saved…** dropdown appears if you have saved rosters. Selecting one fills the name, color, roster, and logo (if one is attached).
- **Org games** — if home and away teams were set when the game was created, their registered rosters and logos load automatically. You can still edit the roster before starting.

### Team logos
Each team card in setup shows a logo area. If a logo was inherited from an org team or saved roster it is shown automatically. You can upload a different image for this game only — tap **Upload logo** and choose a file. The per-game logo takes precedence over any inherited logo throughout the app (game cards, Live View, Press Box, Hero Card).

### Roster entry
Type players into the text area, one per line (`#number Name`). Validation rules:
- No duplicate numbers
- Minimum 10 players per team

You can also **Upload CSV** with one player per row.

### Starting tracking
Once both rosters pass validation, tap **Start Tracking →**.

### Export
- **Export game (JSON)** — copies the full game state to your clipboard for external use or record-keeping

---

## 10. Scorekeeper — Tracking Events

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

## 11. Event Reference

### Goal 🥍
**Follow-ups:** Assist? → (if yes) Pick assister → Time remaining

EMO is detected automatically: if the defending team is net shorthanded at the time of the goal, the goal is flagged as EMO with no extra input required.

If the defending team's active goalie is set, a **Goal Allowed (GA)** entry is recorded against them in the same group — deleting the goal removes it too. GA is charged to whoever was the active goalie when the goal was entered; later goalie changes are never retroactive. No active goalie set → no GA entry.

### Active goalies 🧤
Two GK chips sit at the top of the Track screen, one per team. Tap a chip to set or substitute that team's active goalie from the roster grid (the ＋ # tile works here too for an unrostered backup). Setting the goalie is a state change, not a log entry — it can be done mid-flow without losing an in-progress entry. Substituting mid-game adds a "Goalie Change" marker to the Event Log; all subsequent saves and goals-allowed credit the new goalie. After the first event is committed, a one-time dismissible reminder appears if either goalie is unset. The current goalies are also shown on the Live View and Press Box near the team names.

### Shot 🎯
**Follow-up:** Outcome — Missed / Saved. If the defending team's active goalie is set, a save attributes to them automatically with no extra tap; otherwise pick the goalie from the grid. Editing the entry from the Event Log always shows the full grid, so auto-attribution can be corrected.

### Ground Ball 🪣
Commits immediately after player selection.

### Faceoff 🔄
Faceoffs involve both teams, so they start from their own **🔄 Faceoff** button on the team select screen (not from a single team's event grid).

**Flow:** Pick the home team's faceoff player → pick the away team's faceoff player → tap who won → Ground ball? (the winner got it / someone else on the winning team / nobody). The faceoff win, the paired faceoff loss, and any ground ball are recorded as one group, so per-player faceoff W-L records build automatically. Each team's last-used faceoff player is featured as a quick pick.

Older games recorded only faceoff wins; their losses are unknown, so FO% is not shown for them.

### Turnover ↩️
**Flow:** Pick the player who turned it over → **Who caused it?** shows the opposing roster with a **Skip — unforced** button across the top of the grid → **Ground ball?** offers the opposing roster with a **Skip GB** button (asked whether or not a causing player was picked — the other team usually comes up with the loose ball either way). All entries (turnover, caused TO, ground ball) share one group, so deleting the entry removes the whole chain.

Caused turnovers are no longer entered standalone — they're always recorded as part of a turnover.

### Penalty 🟨
**Follow-ups:**
1. **Time remaining** — entered first, before player selection
2. **Player** — select the penalized player from the number grid
3. **Foul** — select from the list; tech vs. personal is inferred automatically
   - *Technicals (30s):* Conduct, Delay of Game, Holding, Illegal Procedure, Interference, Offsides, Pushing
   - *Personals (1–3 min):* Cross Check, Illegal Body Check, Illegal Equipment, Slashing, Tripping, Unnecessary Roughness, Unsportsmanlike Conduct
4. **Minutes** (personal only) — 1, 2, or 3
5. **Releasable or non-releasable?** (personal only)

Technical fouls commit immediately after foul selection — no minutes or NR step.

The app automatically handles **consecutive fouls** (same player, same dead-ball cycle — served back-to-back) and **simultaneous fouls** (one per team, same dead-ball cycle — overlapping window forced NR for both).

### Penalty Box
While any penalties are active, a **Penalty Box** table appears on the Track screen above the **End Q#** button. Each row shows the player's number, release time, NR badge, and a quarter label if the penalty carries across a quarter break.

### Timeout ⏸️
Team stat. **Follow-up:** Time remaining (or tap **Log without time**).

See [Timeouts](#12-timeouts) for allowances per period.

### Clear ⬆️
Team stat with a result prompt: **Successful** or **Failed**.

- **Successful** → recorded immediately; automatically credits the opposing team with a Failed Ride.
- **Failed** → asks *Did the failed clear result in a turnover?* **No** records the failed clear (crediting the opponent with a Successful Ride). **Yes** chains straight into the turnover flow — pick the clearing team's player who turned it over, optionally who caused it and the ground ball — and everything is saved as one group.

### Adding a missing jersey number ＋#
Every player grid has a **＋ #** tile. If a number appears in the game that isn't on the roster, tap it, dial the number, and the player is added to the roster and immediately selected for the in-flight entry. Duplicate numbers are rejected (the existing tile is highlighted instead). Players added this way are flagged for name cleanup in the finalization review.

---

## 12. Timeouts

**Allowance per team:**
- **First half** (Q1 + Q2 combined): 2 timeouts
- **Second half** (Q3 + Q4 combined): 2 timeouts
- **Each OT period**: 1 timeout

Remaining counts are shown on the team select buttons. Unused first-half timeouts do not carry into the second half.

---

## 13. Quarter & Game Management

### Ending a quarter
Tap **End Q# →** at the bottom of the Track screen. A confirmation screen shows a stat summary. Tap the confirm button to lock the quarter.

### Quarter 4 — Final or Overtime
- **Not tied** → the finalization review opens (see below)
- **Tied** → overtime begins (OT1, OT2, etc.)

### Overtime
Sudden death. The first OT goal opens the finalization review.

### Finalizing a game
When a game ends (Q4 with a winner, or an OT goal), a short wizard runs before anything is committed:

1. **Roster corrections** — every player added or edited during the game is listed per team. Enter or fix names and numbers, or delete a player who has no recorded events. For org-roster teams, a per-player **Update org roster** toggle (on by default) propagates accepted changes to the stored org roster.
2. **Goalie decisions** — pick the winning team's goalie credited with the **W**, then the losing team's goalie charged with the **L**. The winning side pre-selects the goalie with the most saves and the losing side the goalie with the highest GA (ties fall back to the active goalie); the pre-selection is just the featured tile — tap any other player to override. The decisions appear next to each goalie in the player stats.
3. **Final summary** — score by quarter, team stat lines, the roster changes about to be applied, and the goalie decisions. Only tapping **Finalize Game ✓** commits anything; **Not yet — keep scoring** is available at every step in case of a mis-tap.

---

## 14. Multi-User Scoring

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

## 15. Editing and Deleting Entries

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

## 16. Stats Views

Stats are available in the Scorekeeper (**Stats** and **Event Log** tabs), the Live View, and the Press Box. A **quarter filter** at the top lets you view all quarters combined or any individual quarter.

### Summary tab
Team totals for every tracked stat, side by side, organized into sections: Scoring, Defense, Shooting, Possession, Clearing, and Penalties.

### Players tab
Sortable table of individual player stats. Tap any column header to sort. Players are grouped by team.

### Map tab *(Scorekeeper only, when shot location is enabled)*
Shot locations aggregated into six field zones (left/center/right × close/far). Each zone shows shots-goals and shooting % (e.g. `7-2 · 29%`), with shading scaled by shot volume. When entering a shot the scorekeeper taps one of the six zones — the area behind the goal line is not a valid shot origin and can't be selected. Visible only when a platform admin has enabled shot location tracking for the game. Supports a team filter (Both / Home / Away).

### Timeline tab
Reverse-chronological list of goals, timeouts, and penalties, with time remaining, quarter, player, assist, and running score.

### Event Log tab *(Scorekeeper only)*
Full reverse-chronological feed of every event with edit and delete controls. Quarter dividers appear in the All view.

### Season stats
For org games linked to a season, per-season stats roll up automatically for registered players — including goalie records (saves, goals allowed, save %) and faceoff records (wins, losses, faceoff %). Percentage leaderboards require at least 10 attempts so tiny samples don't top the list. View them from the season detail page in the org dashboard; all-time leaders appear on the org Stats tab.

---

## 17. Live View

Open via **View** on any game card, or navigate to `/games/:id/view`.

- **Read-only** — no editing controls
- **Realtime** — updates automatically as the scorekeeper enters stats
- **Shareable** — send the URL to anyone
- **No account required**

The header shows **● Live** or **Final**. For live games, the latest recorded time remaining is shown. The header toolbar includes:

- **Press Box ↗** — opens the press box for the same game in a new tab
- **Follow** (live games) — subscribes to browser push notifications for goals; tap again to unfollow
- **QR** — opens a modal with a scannable QR code for the game URL; tap **Save image** to download as PNG
- **Hero Card** (final games) — generates a shareable PNG graphic with the final score, team colors, logos, and player of the game

---

## 18. Press Box

Open via **Press Box** on any game card, the Live View header, or navigate to `/games/:id/pressbox`.

- **Read-only**, **realtime**, **no account required**
- **Designed for tablets and laptops** — fills the full screen in a two-column layout

The press box shows everything at once without tabs:

**Left column:** Score banner · Score by Quarter · Team Stats

**Right column:** Player Stats (Home/Away toggle) · Event Log · Timeline

A quarter filter above the columns affects all sections simultaneously.

Press Box access is controlled per-game. Personal games require a platform admin to enable it via the game's ⚙ panel in `/admin`.

---

## 19. Stat Definitions

### Scoring

| Abbrev | Name | Description |
|---|---|---|
| **G** | Goals | Goals scored |
| **A** | Assists | Pass directly leading to a goal |
| **EMO** | Successful EMO | Goals scored while the opposing team was net shorthanded; auto-computed from penalty box state at the time of each goal |
| **FEMO** | Failed EMO | Man-up opportunities that ended without a goal; auto-computed as opponent's successful MDD |
| **EMO %** | EMO percentage | Successful EMO ÷ (Successful + Failed EMO) |

### Defense

| Abbrev | Name | Description |
|---|---|---|
| **MDD** | Successful MDD | Penalty windows where the defense held without conceding; auto-computed from penalty and goal data |
| **FMDD** | Failed MDD | Man-down situations that resulted in a goal; auto-computed as opponent's EMO goals |
| **MDD %** | MDD percentage | Successful MDD ÷ (Successful + Failed MDD) |
| **Sv** | Saves | Shots stopped by the goalie |
| **GA** | Goals allowed | Goals charged to the active goalie at entry time (blank for older games) |
| **Sv%** | Goalie save percentage | Saves ÷ (Saves + GA) per goalie; — when no data |
| **Save %** | Save percentage | Saves ÷ Opponent's SOG |
| **FTO** | Forced turnovers | Turnovers caused by applied pressure |

### Shooting

| Abbrev | Name | Description |
|---|---|---|
| **Sh** | Total shots | All shot attempts (does not include goals) |
| **Shot %** | Shot percentage | Goals ÷ Total shots |
| **SOG** | Shots on goal | Goals + saves + post/crossbar hits |
| **SOG %** | SOG percentage | Goals ÷ SOG |

### Possession

| Abbrev | Name | Description |
|---|---|---|
| **GB** | Ground balls | Loose ball pickups |
| **FW** | Faceoff wins | Faceoffs won |
| **FL** | Faceoff losses | Faceoffs lost — the paired other side of every faceoff win |
| **FO %** | Faceoff percentage | Wins ÷ (wins + losses); hidden for older games that only recorded wins |
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
- **Multi-scorer:** run the Scorekeeper on a phone at the table; send an invite link to a second device for backup coverage. Both feeds sync in real time.
- **Guest link expires in 24h:** generate a new one from the scorekeeper header if you need to re-invite.
- **Shared rosters:** appear in your **Load saved…** dropdown and under **Shared with me** in the Rosters tab.
- **Hero Card:** once a game is final, tap **Hero Card** in the game header to generate a shareable PNG with the score, team colors, logos, and player of the game. Download it or close — the game data is unaffected.
- **Logos:** attach a logo to a saved roster once and it will appear automatically on every game card and in the scorekeeper whenever that roster is loaded.
