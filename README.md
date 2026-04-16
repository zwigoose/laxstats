# LaxStats 🥍

Live men's lacrosse stat tracking. One person keeps score on the sideline — everyone else follows along in real time.

---

## How to use this app

### Before the game — set up your rosters
Go to the **Rosters** tab on the main screen and create a saved team for each team you track regularly. Enter the team name, pick a color, and add players one per line in `#number Name` format. Saved rosters can be loaded into any future game in one tap.

### Starting a game
Tap **＋ New Game** from the main screen. On the setup screen, use the **Load saved…** dropdown on each team card to pull in a saved roster, or type everything in manually. Once both teams have at least one player, tap **Start Tracking →**.

### Tracking stats during the game
The **Track** tab walks you through every entry step by step:
1. Tap the team the event belongs to
2. Tap the event type (Goal, Shot, Ground Ball, etc.)
3. Tap the player involved
4. Answer any follow-up questions (save? assist? EMO? time remaining? foul type?)

After each entry a banner shows what was just recorded with an **undo** button if you need to correct a mistake immediately. To fix something older, go to the **Event Log** tab and tap ✏️ to edit or ✕ to delete any entry.

### Ending quarters
Tap **End Q# →** at the bottom of the Track screen. After Q4, the app either finalizes the game (if the score isn't tied) or starts overtime. Overtime is sudden death — the app ends the game automatically on the first OT goal.

### Viewing stats
The **Stats** tab shows a full breakdown: team totals in **Summary**, a sortable player table in **Players**, and a goal-by-goal **Timeline**. Use the quarter buttons at the top to filter to any individual quarter.

### Sharing the live view
Anyone can follow the game in real time by opening the **Live View** link (`/games/:id/view`), or by tapping **View** on any game card from the main screen. It updates automatically as stats are entered — no refresh needed.

---

## Stat types tracked

Goals, EMO goals, shots, shot %, saves, save %, ground balls, faceoff wins, turnovers, forced turnovers, successful clears, failed clears, clearing %, successful rides, failed rides, assists, technical fouls, and personal foul minutes.

> Rides are calculated automatically — a successful clear for one team counts as a failed ride for the other, and vice versa.

---

## Full documentation

See [USER_GUIDE.md](./USER_GUIDE.md) for a detailed reference covering every feature.
