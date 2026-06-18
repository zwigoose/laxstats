import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../contexts/AuthContext";
import SeoMeta from "../hooks/useSeoMeta";

const SECTIONS = [
  { id: "start",    label: "Getting Started" },
  { id: "home",     label: "Your Home Screen" },
  { id: "setup",    label: "Setting Up a Game" },
  { id: "tracking", label: "Tracking a Game" },
  { id: "events",   label: "Event Types" },
  { id: "quarters", label: "Quarters & Game Flow" },
  { id: "editing",  label: "Editing Entries" },
  { id: "stats",    label: "Stats & Views" },
  { id: "sharing",  label: "Live View & Sharing" },
  { id: "multi",    label: "Multi-User Scoring" },
  { id: "rosters",  label: "Saved Rosters" },
  { id: "orgs",     label: "Organizations" },
  { id: "plans",    label: "Plans" },
  { id: "stat-defs","label": "Stat Definitions" },
];

const S = {
  page:      { maxWidth: 700, margin: "0 auto", padding: "36px 16px 64px", fontFamily: "system-ui, sans-serif" },

  hero:      { marginBottom: 40, paddingBottom: 36, borderBottom: "1px solid #f0f0f0" },
  heroTitle: { fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em", color: "#111", margin: "0 0 10px 0" },
  heroSub:   { fontSize: 15, color: "#555", lineHeight: 1.65, margin: "0 0 22px 0", maxWidth: 520 },
  heroBtns:  { display: "flex", gap: 8, flexWrap: "wrap" },
  btnDark:   { background: "#111", color: "#fff", fontSize: 13, fontWeight: 600, borderRadius: 9, padding: "9px 18px", border: "none", cursor: "pointer", fontFamily: "system-ui, sans-serif" },
  btnLight:  { background: "none", color: "#555", fontSize: 13, fontWeight: 600, borderRadius: 9, padding: "9px 18px", border: "1px solid #d0d0d0", cursor: "pointer", fontFamily: "system-ui, sans-serif" },

  toc:       { background: "#f7f7f7", border: "1px solid #e8e8e8", borderRadius: 12, padding: "16px 20px", marginBottom: 44 },
  tocLabel:  { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#aaa", marginBottom: 10 },
  tocGrid:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px" },
  tocLink:   { fontSize: 13, color: "#1a6bab", textDecoration: "none", lineHeight: 2.1, cursor: "pointer" },

  section:   { marginBottom: 52, scrollMarginTop: 60 },
  h2:        { fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "#111", margin: "0 0 6px 0" },
  lead:      { fontSize: 14, color: "#666", lineHeight: 1.65, margin: "0 0 18px 0" },

  card:      { background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, padding: "16px 18px", marginBottom: 10 },
  cardTitle: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#999", margin: "0 0 9px 0" },
  cardBody:  { fontSize: 14, color: "#444", lineHeight: 1.65, margin: 0 },

  divider:   { height: 1, background: "#f0f0f0", margin: "0 0 52px 0" },

  steps:     { display: "flex", flexDirection: "column", gap: 3, margin: "12px 0" },
  step:      { display: "flex", alignItems: "flex-start", gap: 11, padding: "11px 14px", background: "#f7f7f7", borderRadius: 8 },
  stepNum:   { width: 20, height: 20, borderRadius: "50%", background: "#111", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  stepMain:  { fontSize: 14, color: "#333", lineHeight: 1.5, fontWeight: 500 },
  stepSub:   { fontSize: 12, color: "#888", marginTop: 2, lineHeight: 1.4 },

  table:     { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th:        { textAlign: "left", padding: "7px 10px", borderBottom: "2px solid #e8e8e8", fontWeight: 700, color: "#666", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" },
  td:        { padding: "8px 10px", borderBottom: "1px solid #f0f0f0", color: "#444", verticalAlign: "top" },

  tip:       { background: "#fffbec", border: "1px solid #f5e9b8", borderRadius: 10, padding: "11px 15px", marginBottom: 8, fontSize: 13, color: "#664d00", lineHeight: 1.55 },
  tipLabel:  { fontWeight: 700, color: "#8a6400", marginRight: 6 },

  grid2:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 },
  grid3:     { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 },

  code:      { background: "#f0f0f0", borderRadius: 4, padding: "1px 6px", fontFamily: "monospace", fontSize: 12 },
  codeBlock: { display: "block", background: "#f5f5f5", borderRadius: 8, padding: "10px 14px", marginTop: 8, fontFamily: "monospace", fontSize: 13, lineHeight: 1.8, color: "#333" },

  screenshot:     { margin: "14px 0", borderRadius: 10, overflow: "hidden", border: "1px solid #e8e8e8", display: "flex", justifyContent: "center", background: "#f5f5f5" },
  screenshotImg:  { display: "block", width: "100%", height: "auto" },
  screenshotImgSm:{ display: "block", width: "100%", height: "auto", maxWidth: 360 },
};

function Screenshot({ label, file, full }) {
  return (
    <div style={S.screenshot}>
      <img src={`/screenshots/${file}`} alt={label} style={full ? S.screenshotImg : S.screenshotImgSm} />
    </div>
  );
}

function Step({ num, title, sub }) {
  return (
    <div style={S.step}>
      <div style={S.stepNum}>{num}</div>
      <div>
        <div style={S.stepMain}>{title}</div>
        {sub && <div style={S.stepSub}>{sub}</div>}
      </div>
    </div>
  );
}

function Tip({ text }) {
  return (
    <div style={S.tip}>
      <span style={S.tipLabel}>Tip:</span>{text}
    </div>
  );
}

const FAQ_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is LaxStats?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "LaxStats is a digital scorebook and live stats platform for men's lacrosse. Score games on your phone, share them live with anyone, and get a full box score the moment the final whistle blows.",
      },
    },
    {
      "@type": "Question",
      "name": "Do I need an account to view a game?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. Live View and Press Box are public links — anyone with the link can watch a game in real time without signing up.",
      },
    },
    {
      "@type": "Question",
      "name": "How do I share a live game?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "From the scorekeeper, tap the Share button to copy the Live View or Press Box link. Anyone who opens the link will see the score, play-by-play, and box score update in real time.",
      },
    },
    {
      "@type": "Question",
      "name": "What stats does LaxStats track?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "LaxStats tracks goals, assists, shots, ground balls, faceoffs, turnovers, forced turnovers, penalties, clears, failed clears, rides, man-down defense (MDD), extra-man offense (EMO), save percentage, and clearing percentage.",
      },
    },
    {
      "@type": "Question",
      "name": "Can multiple people score the same game?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. The game owner can send a scorekeeper invite link to a second scorer. Both scorers work on the same game simultaneously, with changes syncing in real time.",
      },
    },
    {
      "@type": "Question",
      "name": "How do organizations work in LaxStats?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Organizations let coaches, admins, and scorekeepers manage a full league or program together. Orgs have seasons, teams, roster management, season-level stats, and role-based access control.",
      },
    },
    {
      "@type": "Question",
      "name": "Is LaxStats free to use?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes — personal scoring is free to start. Paid plans unlock more games per month and organization features. See the pricing page for details.",
      },
    },
  ],
});

export default function Guide() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <SeoMeta
        title="How to Use LaxStats — Complete Lacrosse Scorebook Guide"
        description="Step-by-step guide to scoring lacrosse games, sharing live stats, managing rosters, and running a league with LaxStats."
        url="https://laxstats.com/guide"
      />
      <Helmet>
        <script type="application/ld+json">{FAQ_JSON_LD}</script>
      </Helmet>
    <div style={S.page}>

      {/* ── Hero ── */}
      <div style={S.hero}>
        <h1 style={S.heroTitle}>How to Use LaxStats</h1>
        <p style={S.heroSub}>
          LaxStats is a digital scorebook and live stats platform for men's lacrosse.
          Score a game on your phone, share it live with anyone, and get a full box score
          the moment the final whistle blows.
        </p>
        <Screenshot label="Home screen showing game list with Live, Pending, and Final tabs" file="home-game-list.png" />
        <div style={{ ...S.heroBtns, marginTop: 20 }}>
          <button style={S.btnDark} onClick={() => navigate(user ? "/" : "/login")}>{user ? "Go to my games" : "Get started free"}</button>
          <button style={S.btnLight} onClick={() => navigate("/pricing")}>View plans</button>
        </div>
      </div>

      {/* ── Table of Contents ── */}
      <div style={S.toc}>
        <div style={S.tocLabel}>On this page</div>
        <div style={S.tocGrid}>
          {SECTIONS.map(s => (
            <span key={s.id} style={S.tocLink} onClick={() => scrollTo(s.id)} role="link" tabIndex={0}
              onKeyDown={e => e.key === "Enter" && scrollTo(s.id)}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Getting Started ── */}
      <section style={S.section} id="start">
        <h2 style={S.h2}>Getting Started</h2>
        <p style={S.lead}>You can view any game without an account. Scoring one requires an account — or just an invite link from the game owner.</p>

        <div style={S.card}>
          <p style={S.cardTitle}>Who needs an account?</p>
          <div style={S.cardBody}>
            <strong>Scoring a personal game</strong> — requires an account. Sign up with your email and a password at the login screen.<br /><br />
            <strong>Scoring via invite link</strong> — no account needed. Open the link in any browser; you go straight to the scorekeeper as a guest.<br /><br />
            <strong>Viewing a game</strong> — no account required. Live View and Press Box are public links — share them with coaches, parents, and players.
          </div>
        </div>

        <Screenshot label="Login screen — sign in and sign up tabs" file="login-screen.png" />

        <Tip text="After signing up, check your email to confirm your address before signing in for the first time." />
      </section>

      <div style={S.divider} />

      {/* ── Home Screen ── */}
      <section style={S.section} id="home">
        <h2 style={S.h2}>Your Home Screen</h2>
        <p style={S.lead}>The home screen lists all your games organized by status, plus your saved rosters.</p>

        <div style={S.card}>
          <p style={S.cardTitle}>Game tabs</p>
          <div style={S.cardBody}>
            <strong>Live</strong> — games in progress right now.<br />
            <strong>Pending</strong> — games set up but not yet started.<br />
            <strong>Final</strong> — completed games with full box scores preserved.
          </div>
        </div>

        <Screenshot label="Home screen — Pending tab with game cards (team names, score, action buttons)" file="home-pending-tab.png" />

        <div style={S.card}>
          <p style={S.cardTitle}>Game card actions</p>
          <div style={S.cardBody}>
            Each card shows teams, score, and date with quick-action buttons:
            <ul style={{ margin: "8px 0 0 0", paddingLeft: 18, lineHeight: 2.1 }}>
              <li><strong>Score</strong> — open the scorekeeper</li>
              <li><strong>View</strong> — open the Live View (public, read-only)</li>
              <li><strong>Press Box</strong> — open the full-screen press box view</li>
              <li><strong>Delete</strong> — permanently remove the game (requires two confirmations)</li>
            </ul>
          </div>
        </div>

        <div style={S.card}>
          <p style={S.cardTitle}>Creating a game</p>
          <div style={S.cardBody}>
            Tap <strong>+ New Game</strong> and choose between two game types:
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <div style={{ background: "#f7f7f7", borderRadius: 9, padding: "14px 16px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Personal game</div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "#555", lineHeight: 2 }}>
                <li>Standalone — just yours</li>
                <li>Enter rosters manually or load a saved team</li>
                <li>Stats available per game</li>
                <li>No season or org required</li>
                <li>Can be moved to an org later</li>
              </ul>
              <div style={{ marginTop: 10, fontSize: 12, color: "#888" }}>Best for: pickup games, one-off scrimmages, or getting started.</div>
            </div>
            <div style={{ background: "#f7f7f7", borderRadius: 9, padding: "14px 16px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Org game</div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "#555", lineHeight: 2 }}>
                <li>Linked to an organization</li>
                <li>Uses registered team rosters</li>
                <li>Stats roll up across the full season</li>
                <li>Shared with org members</li>
                <li>Optionally tied to a season</li>
              </ul>
              <div style={{ marginTop: 10, fontSize: 12, color: "#888" }}>Best for: league play, club programs, or any tracked season.</div>
            </div>
          </div>
        </div>
      </section>

      <div style={S.divider} />

      {/* ── Setup ── */}
      <section style={S.section} id="setup">
        <h2 style={S.h2}>Setting Up a Game</h2>
        <p style={S.lead}>Before tracking begins, configure your two teams: rosters, colors, and logos.</p>

        <div style={S.card}>
          <p style={S.cardTitle}>Home & Away</p>
          <div style={S.cardBody}>
            The <strong>left card is always Home</strong>, the right is <strong>Away</strong>. Home team buttons show a colored border; Away buttons are solid color — matching jerseys on the field.
          </div>
        </div>

        <Screenshot label="Scorekeeper setup screen — two team cards side by side with roster text areas" file="setup-team-cards.png" />

        <div style={S.card}>
          <p style={S.cardTitle}>Entering the roster</p>
          <div style={S.cardBody}>
            Type players into the text area, one per line in <code style={S.code}>#number Name</code> format. Minimum 10 players per team. You can also <strong>Upload CSV</strong> or tap <strong>Load saved…</strong> to pull in a saved roster in a single tap.
            <code style={S.codeBlock}>#2 John Smith{"\n"}#7 Mike Johnson{"\n"}#11 Alex Williams</code>
          </div>
        </div>

        <div style={S.card}>
          <p style={S.cardTitle}>Team logos</p>
          <div style={S.cardBody}>
            Tap <strong>Upload logo</strong> on either team card to add an image. Logos appear on game cards, Live View, Press Box, and the Hero Card. Loading a saved roster with a logo attached fills it in automatically.
          </div>
        </div>

        <div style={S.card}>
          <p style={S.cardTitle}>Starting tracking</p>
          <div style={S.cardBody}>
            Once both rosters pass validation, tap <strong>Start Tracking →</strong>. You can begin logging events immediately.
          </div>
        </div>

        <Tip text="Set up the scorekeeper a few minutes before the game. All fields can still be changed up until you tap Start Tracking." />
      </section>

      <div style={S.divider} />

      {/* ── Tracking ── */}
      <section style={S.section} id="tracking">
        <h2 style={S.h2}>Tracking a Game</h2>
        <p style={S.lead}>The Track tab walks you through every stat entry in a guided four-step flow. Nothing is saved until you complete the flow — tap Back at any step to cancel without recording anything.</p>

        <div style={S.steps}>
          <Step num="1" title="Select the team" sub="Two large buttons show the current score. Tap whichever team the event belongs to. Faceoffs involve both teams, so they start from their own button on this screen." />
          <Step num="2" title="Select the event type" sub="Goal, Shot, Ground Ball, Turnover, Penalty, Timeout, or Clear." />
          <Step num="3" title="Select the player" sub="A number grid shows the team's roster. Tap the player's number — or tap ＋ # to add a missing jersey number on the spot. Team stats (Timeout, Clear) skip this step." />
          <Step num="4" title="Answer follow-ups" sub="Assist, shot outcome, who caused a turnover, clear result, foul type, time remaining — varies by event type. Then confirm to save." />
        </div>

        <Screenshot label="Step 1 — Team select buttons showing current score (e.g. Home 3, Away 2)" file="track-team-select.png" />
        <Screenshot label="Step 3 — Player number grid for the selected team" file="track-player-grid.png" />

        <div style={S.card}>
          <p style={S.cardTitle}>After each entry</p>
          <div style={S.cardBody}>
            A confirmation banner appears with what was recorded and an <strong>undo</strong> button. Tap undo to remove the entire entry instantly. The header shows <strong>Saving…</strong> then <strong>Saved ✓</strong> as the event syncs.
          </div>
        </div>

        <div style={S.card}>
          <p style={S.cardTitle}>Time entry</p>
          <div style={S.cardBody}>
            Events that need a clock time use a numeric keypad. Type the time remaining as digits — e.g. type <code style={S.code}>854</code> for 8:54. The keypad validates against the quarter ceiling and shows an error if the entered time conflicts with an existing entry.
          </div>
        </div>

        <Screenshot label="Numeric time keypad with digit buttons and confirm" file="track-time-keypad.png" />

        <Tip text="Keep the Track screen open the whole game. Flip to Stats to check a quarter, then come right back." />
      </section>

      <div style={S.divider} />

      {/* ── Events ── */}
      <section style={S.section} id="events">
        <h2 style={S.h2}>Event Types</h2>
        <p style={S.lead}>LaxStats tracks the following event types. Several stats (EMO, MDD, rides) are computed automatically from other events — you never need to enter them manually.</p>

        <div style={S.card}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: 130 }}>Event</th>
                <th style={S.th}>Follow-ups required</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Goal",        "Assist? (optional) · Time remaining · EMO auto-detected from penalty box"],
                ["Shot",        "Outcome: Missed / Saved — auto-attributed to the active goalie when one is set, otherwise pick from the grid"],
                ["Ground Ball", "None — commits immediately after player selection"],
                ["Faceoff",     "Started from the team screen: pick both faceoff players, then the winner, then the ground ball (winner / teammate / nobody)"],
                ["Turnover",    "Who caused it? (opposing player, or Skip — unforced) · Ground ball? (optional)"],
                ["Penalty",     "Time remaining · Player · Foul type · Minutes (personal fouls) · Releasable?"],
                ["Timeout",     "Time remaining (or tap Log without time)"],
                ["Clear",       "Successful / Failed — a failed clear can chain straight into the turnover flow"],
              ].map(([event, followups]) => (
                <tr key={event}>
                  <td style={{ ...S.td, fontWeight: 600 }}>{event}</td>
                  <td style={{ ...S.td, color: "#666", fontSize: 12 }}>{followups}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={S.card}>
          <p style={S.cardTitle}>Auto-computed stats</p>
          <div style={S.cardBody}>
            <strong>EMO</strong> — automatically flagged on any goal when the defending team is net shorthanded at that moment. No scorer input needed.<br /><br />
            <strong>MDD</strong> — automatically credited to the defense when a penalty window expires without a goal. No scorer input needed.<br /><br />
            <strong>Rides / Failed Rides</strong> — the inverse of the opposing team's Clears and Failed Clears, computed in real time.<br /><br />
            <strong>Active goalies</strong> — set each team's goalie via the 🧤 chips at the top of the Track screen. Saves then attribute automatically and every goal records a Goal Allowed against the goalie in net at the time. Tap a chip mid-game to substitute.
          </div>
        </div>

        <Screenshot label="Event type selection screen — step 2" file="track-event-types.png" />

        <div style={S.card}>
          <p style={S.cardTitle}>Penalty details</p>
          <div style={S.cardBody}>
            After selecting Penalty: enter time remaining, pick the player, then choose the foul from the list. Tech vs. personal is inferred automatically from the foul type.<br /><br />
            <strong>Technicals (30s, releasable):</strong> Conduct, Delay of Game, Holding, Illegal Procedure, Interference, Offsides, Pushing.<br /><br />
            <strong>Personals (1–3 min):</strong> Cross Check, Illegal Body Check, Slashing, Tripping, Unnecessary Roughness, Unsportsmanlike Conduct, and others.<br /><br />
            The app automatically handles <strong>consecutive fouls</strong> (same player, same dead-ball cycle) and <strong>simultaneous fouls</strong> (one per team — both become NR).
          </div>
        </div>
      </section>

      <div style={S.divider} />

      {/* ── Quarters ── */}
      <section style={S.section} id="quarters">
        <h2 style={S.h2}>Quarters & Game Flow</h2>
        <p style={S.lead}>The scorekeeper guides you from Q1 through final. Overtime is handled automatically.</p>

        <div style={S.card}>
          <p style={S.cardTitle}>Ending a quarter</p>
          <div style={S.cardBody}>
            Tap <strong>End Q# →</strong> at the bottom of the Track screen. A summary shows the quarter's stats. Tap confirm to lock the quarter and advance.
          </div>
        </div>

        <div style={S.card}>
          <p style={S.cardTitle}>Overtime</p>
          <div style={S.cardBody}>
            After Q4, if the game is tied, overtime begins. Overtime is sudden death — the first goal opens the game finalization review. Multiple OT periods are supported. When a game ends (Q4 with a winner, or an OT goal), a short finalization wizard runs: fix any players added mid-game, pick the winning and losing goalies, and confirm the final summary. Nothing is committed until you tap Finalize Game.
          </div>
        </div>

        <div style={S.card}>
          <p style={S.cardTitle}>Timeouts</p>
          <div style={S.cardBody}>
            Each team gets <strong>2 timeouts per half</strong> (Q1+Q2 combined, Q3+Q4 combined) and <strong>1 per OT period</strong>. Remaining counts appear on the team select buttons. Unused first-half timeouts do not carry to the second half.
          </div>
        </div>

        <div style={S.card}>
          <p style={S.cardTitle}>Penalty Box panel</p>
          <div style={S.cardBody}>
            When penalties are active, a <strong>Penalty Box</strong> panel appears above the End Quarter button. Each row shows the player's number, release time, NR badge, and a quarter label if the penalty carries over a break.
          </div>
        </div>

        <Screenshot label="Track screen showing End Q2 button and active Penalty Box panel" file="track-penalty-box.png" />
      </section>

      <div style={S.divider} />

      {/* ── Editing ── */}
      <section style={S.section} id="editing">
        <h2 style={S.h2}>Editing Entries</h2>
        <p style={S.lead}>Every entry can be fixed at any time — even after the quarter has ended.</p>

        <div style={S.card}>
          <p style={S.cardTitle}>Undo last entry</p>
          <div style={S.cardBody}>
            Immediately after logging, tap <strong>undo</strong> in the confirmation banner to remove the entire entry group instantly. Fastest way to fix a misclick.
          </div>
        </div>

        <div style={S.card}>
          <p style={S.cardTitle}>Edit from Event Log</p>
          <div style={S.cardBody}>
            Open the <strong>Event Log</strong> tab and tap the edit (pencil) icon on any entry. The tracking flow restarts with the original values pre-filled. Make your changes and complete the flow — the entry is updated in its original chronological position.
          </div>
        </div>

        <div style={S.card}>
          <p style={S.cardTitle}>Delete from Event Log</p>
          <div style={S.cardBody}>
            Tap the delete (×) icon on any entry and confirm. The entire linked group is removed — for example, deleting a goal also removes the associated assist, EMO flag, and time entry.
          </div>
        </div>

        <Screenshot label="Event Log tab — entry rows with edit (pencil) and delete (×) buttons" file="event-log.png" />

        <Tip text="The Event Log shows quarter dividers in the 'All quarters' view, so you can jump straight to any period's events." />
      </section>

      <div style={S.divider} />

      {/* ── Stats ── */}
      <section style={S.section} id="stats">
        <h2 style={S.h2}>Stats & Views</h2>
        <p style={S.lead}>Stats update live as events are logged. A quarter filter at the top lets you drill into any individual quarter or see all combined.</p>

        <div style={S.grid2}>
          {[
            ["Summary",   "Team totals side by side, organized into Scoring, Defense, Shooting, Possession, Clearing, and Penalties."],
            ["Players",   "Sortable table of individual player stats. Tap any column header to sort. Grouped by team."],
            ["Timeline",  "Reverse-chronological list of goals, timeouts, and penalties with running score and quarter."],
            ["Event Log", "Full feed of every event with edit and delete controls. Scorekeeper view only."],
          ].map(([title, desc]) => (
            <div key={title} style={S.card}>
              <p style={S.cardTitle}>{title}</p>
              <div style={{ ...S.cardBody, fontSize: 13 }}>{desc}</div>
            </div>
          ))}
        </div>

        <Screenshot label="Stats — Summary tab with team totals in two columns" file="stats-summary.png" />
        <Screenshot label="Stats — Players tab with sortable column headers" file="stats-players.png" />
      </section>

      <div style={S.divider} />

      {/* ── Sharing ── */}
      <section style={S.section} id="sharing">
        <h2 style={S.h2}>Live View & Sharing</h2>
        <p style={S.lead}>Every game has public links that update in real time. No account required to view.</p>

        <div style={S.card}>
          <p style={S.cardTitle}>Live View</p>
          <div style={S.cardBody}>
            Score, stats, and timeline updating live as events are logged. Send this link to coaches, parents, and players — anyone can open it. The header shows <strong>Live</strong> or <strong>Final</strong> status.<br /><br />
            The Live View toolbar includes:<br />
            <ul style={{ margin: "8px 0 0 0", paddingLeft: 18, lineHeight: 2.1 }}>
              <li><strong>Press Box</strong> — opens the press box for the same game in a new tab</li>
              <li><strong>Follow</strong> (live games) — subscribe to push notifications for goals</li>
              <li><strong>QR</strong> — generates a scannable QR code for the game URL; save as PNG</li>
              <li><strong>Hero Card</strong> (final games) — generates a shareable score graphic</li>
            </ul>
          </div>
        </div>

        <Screenshot label="Live View — live score header with Follow, QR, and Press Box buttons" file="live-view-header.png" />

        <div style={S.card}>
          <p style={S.cardTitle}>MOMENTUM 📈</p>
          <div style={S.cardBody}>
            MOMENTUM is LaxStats' live view of game control — a single line below the Live View score showing which team is dictating play. The line rises toward whichever team is in control; the dashed center line is neutral.<br /><br />
            Every recorded play moves the line, weighted by impact: <strong>goals</strong> swing it most, then <strong>faceoff wins</strong>, <strong>shots</strong>, and <strong>clears / caused turnovers</strong>. <strong>Penalties</strong> swing MOMENTUM toward the opposing (man-up) team. During quiet stretches the line drifts back toward neutral, so it always reflects who is controlling the game <em>now</em>.<br /><br />
            There are no numbers to interpret — the axis is labeled with the team names, and distance from center means firmer control. Hover or tap any point to see the play behind it (e.g. <em>Q3 8:12 · Goal — #4 Smith</em>). On finished games, MOMENTUM is a one-glance story of how the game unfolded.
          </div>
        </div>

        <Screenshot label="MOMENTUM graph on a completed game — the full story of control across four quarters" file="momentum.png" full />

        <div style={S.card}>
          <p style={S.cardTitle}>Press Box</p>
          <div style={S.cardBody}>
            Full-screen two-column layout designed for a tablet or laptop at the press table. Shows everything at once — score by quarter, team stats, player stats, event log, and timeline — no tabs needed.
          </div>
        </div>

        <Screenshot label="Press Box — full-screen two-column layout on a tablet" file="pressbox-tablet.png" full />

        <div style={S.card}>
          <p style={S.cardTitle}>Hero Card</p>
          <div style={S.cardBody}>
            Once a game is final, tap <strong>Hero Card</strong> in the Live View header to generate a PNG graphic with the final score, team colors, logos, and player of the game. One tap to download and share.
          </div>
        </div>

        <Screenshot label="Hero Card graphic — final score with team colors, logos, and player of the game" file="hero-card.png" full />

        <Tip text="The QR code is great for displaying at the venue — print it out or show it on a screen so anyone with a phone can follow along instantly." />
      </section>

      <div style={S.divider} />

      {/* ── Multi-user ── */}
      <section style={S.section} id="multi">
        <h2 style={S.h2}>Multi-User Scoring</h2>
        <p style={S.lead}>Multiple people can score the same game simultaneously from separate devices. All events sync in real time — events logged on one device appear on every other connected screen within seconds.</p>

        <div style={S.card}>
          <p style={S.cardTitle}>Primary vs. secondary scorers</p>
          <div style={S.cardBody}>
            The <strong>primary scorer</strong> is the first person to open the scorekeeper. They control quarter endings and game finalization.<br /><br />
            <strong>Secondary scorers</strong> join via an invite link. They can log any event type but cannot end quarters.
          </div>
        </div>

        <div style={S.card}>
          <p style={S.cardTitle}>Inviting a scorer</p>
          <div style={S.cardBody}>
            <div style={S.steps}>
              <Step num="1" title="Open the scorekeeper as the primary scorer." />
              <Step num="2" title='Tap "Invite scorer" in the scorekeeper header.' />
              <Step num="3" title="Copy the generated link and send it to the other scorer." sub="The link expires in 24 hours. Tap New link to generate a fresh one at any time." />
            </div>
            <div style={{ marginTop: 10 }}>The recipient opens the link in any browser — no account needed.</div>
          </div>
        </div>

        <Screenshot label="Scorekeeper header — scorer count badge and Invite scorer button" file="multi-scorer-header.png" />

        <div style={S.card}>
          <p style={S.cardTitle}>Duplicate protection</p>
          <div style={S.cardBody}>
            If two scorers log the same clock-anchored event (e.g., a goal at the same time), a <strong>Possible duplicate</strong> warning appears before the second entry is saved. Choose <strong>Discard</strong> to drop it, or <strong>Log anyway</strong> if it's a genuinely separate event.
          </div>
        </div>

        <Tip text="Run the scorekeeper on a phone at the table and send an invite link to a second device as a backup — both feeds sync in real time." />
      </section>

      <div style={S.divider} />

      {/* ── Rosters ── */}
      <section style={S.section} id="rosters">
        <h2 style={S.h2}>Saved Rosters</h2>
        <p style={S.lead}>Enter a team once, load it into any future personal game with a single tap.</p>

        <div style={S.card}>
          <p style={S.cardTitle}>Creating a saved team</p>
          <div style={S.cardBody}>
            Go to the <strong>Rosters</strong> tab on the home screen, tap <strong>+ New Team</strong>, enter the team name, pick a color, and type the roster. Tap <strong>Save team</strong>.
          </div>
        </div>

        <div style={S.card}>
          <p style={S.cardTitle}>Loading a saved team</p>
          <div style={S.cardBody}>
            In scorekeeper setup, tap the <strong>Load saved…</strong> dropdown on either team card. Selecting a saved team fills in the name, color, roster, and logo (if one is attached) in a single tap.
          </div>
        </div>

        <div style={S.card}>
          <p style={S.cardTitle}>Sharing a roster</p>
          <div style={S.cardBody}>
            Expand the team row on the Rosters tab, enter another user's email in the <strong>Sharing</strong> section, and tap <strong>Share</strong>. Shared users can load the roster in their own games but cannot edit or delete it. Shared rosters appear in the <strong>Load saved…</strong> dropdown automatically.
          </div>
        </div>

        <Screenshot label="Rosters tab — team card expanded with sharing panel and Upload logo button" file="rosters-sharing.png" />

        <Tip text="Attach a logo to a saved roster once — it will appear automatically on game cards and in the scorekeeper whenever that roster is loaded." />
      </section>

      <div style={S.divider} />

      {/* ── Orgs ── */}
      <section style={S.section} id="orgs">
        <h2 style={S.h2}>Organizations</h2>
        <p style={S.lead}>Organizations add registered teams, seasonal stat rollups, and multi-member management for programs and leagues.</p>

        <div style={S.card}>
          <p style={S.cardTitle}>What an org gives you</p>
          <div style={S.cardBody}>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 2.1 }}>
              <li>Registered team rosters shared across all org games</li>
              <li>Seasons with start/end dates and automatic per-season stat rollups</li>
              <li>Multiple members with role-based access</li>
              <li>A shared org dashboard listing all games across every team</li>
            </ul>
          </div>
        </div>

        <div style={S.card}>
          <p style={S.cardTitle}>Org roles</p>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: 130 }}>Role</th>
                <th style={S.th}>What they can do</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Org admin",   "Manage members, teams, seasons, and games — full control"],
                ["Coach",       "Create games and manage team rosters"],
                ["Scorekeeper", "Score games they are invited to"],
                ["Viewer",      "View games and stats — read-only"],
              ].map(([role, desc]) => (
                <tr key={role}>
                  <td style={{ ...S.td, fontWeight: 600 }}>{role}</td>
                  <td style={{ ...S.td, color: "#666", fontSize: 12 }}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Screenshot label="Org dashboard — Games tab with team filters and Live / Pending / Final sections" file="org-dashboard.png" />

        <div style={S.card}>
          <p style={S.cardTitle}>Creating an org</p>
          <div style={S.cardBody}>
            Go to <strong>Pricing</strong> and select an Org plan (Pro or Max). After checkout you'll name your organization and are automatically made its org admin. An active org plan is required to create or manage an org.
          </div>
        </div>

        <Tip text="Season stats roll up automatically across all games in the season for any registered player — no manual entry required." />
      </section>

      <div style={S.divider} />

      {/* ── Plans ── */}
      <section style={S.section} id="plans">
        <h2 style={S.h2}>Plans</h2>
        <p style={S.lead}>LaxStats is free to try. Paid plans unlock more games and org features.</p>

        <div style={{ marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#999" }}>Personal plans</div>
        <div style={S.grid3}>
          {[
            { name: "Free",  price: "$0",     desc: "3 personal games" },
            { name: "Basic", price: "$5/mo",  desc: "10 personal games" },
            { name: "Plus",  price: "$10/mo", desc: "20 personal games" },
          ].map(p => (
            <div key={p.name} style={{ ...S.card, textAlign: "center", marginBottom: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 4 }}>{p.price}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{p.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ margin: "16px 0 6px 0", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#999" }}>Org plans</div>
        <div style={S.grid2}>
          {[
            { name: "Pro", price: "$10/mo", desc: "Registered teams, seasons, season stats, Press Box" },
            { name: "Max", price: "$20/mo", desc: "Everything in Pro + multi-scorer, higher limits" },
          ].map(p => (
            <div key={p.name} style={{ ...S.card, textAlign: "center", marginBottom: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{p.name} Org</div>
              <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 4 }}>{p.price}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{p.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <button style={S.btnDark} onClick={() => navigate("/pricing")}>View all plans →</button>
        </div>
      </section>

      <div style={S.divider} />

      {/* ── Stat Definitions ── */}
      <section style={S.section} id="stat-defs">
        <h2 style={S.h2}>Stat Definitions</h2>
        <p style={S.lead}>Every stat LaxStats tracks, with its abbreviation and a plain-English description.</p>

        {[
          { group: "Scoring", rows: [
            ["G",      "Goals",             "Goals scored"],
            ["A",      "Assists",           "Pass directly leading to a goal"],
            ["EMO",    "Extra-man opp.",    "Goal scored while the opponent was net shorthanded — auto-detected from the penalty box"],
            ["FEMO",   "Failed EMO",        "Man-up opportunities that ended without a goal — auto-computed"],
            ["EMO %",  "EMO percentage",    "Successful EMO ÷ (Successful + Failed EMO)"],
          ]},
          { group: "Defense", rows: [
            ["MDD",    "Man-down defense",  "Held the opponent scoreless on a man-down — auto-credited when a penalty expires"],
            ["FMDD",   "Failed MDD",        "Man-down situations that resulted in a goal — auto-computed"],
            ["MDD %",  "MDD percentage",    "Successful MDD ÷ (Successful + Failed MDD)"],
            ["Sv",     "Saves",             "Shots stopped by the goalie"],
            ["GA",     "Goals allowed",     "Goals charged to the active goalie at entry time"],
            ["Sv%",    "Goalie save %",     "A single goalie's saves ÷ (their saves + goals allowed while in net) — one line per goalie"],
            ["Save %", "Team save %",       "The team's combined save rate: total saves ÷ opponent's shots on goal (all goalies aggregated)"],
            ["FTO",    "Forced turnovers",  "Turnovers caused by applied pressure"],
          ]},
          { group: "Shooting", rows: [
            ["Sh",     "Total shots",       "All shot attempts (does not include goals)"],
            ["Shot %", "Shot percentage",   "Goals ÷ Total shots"],
            ["SOG",    "Shots on goal",     "Goals + saves + post/crossbar hits"],
            ["SOG %",  "SOG percentage",    "Goals ÷ SOG"],
          ]},
          { group: "Possession", rows: [
            ["GB",     "Ground balls",      "Loose ball pickups"],
            ["FW",     "Faceoff wins",      "Faceoffs won"],
            ["FL",     "Faceoff losses",    "Faceoffs lost — recorded per player as the other side of every faceoff win"],
            ["FO %",   "Faceoff percentage","Faceoff wins ÷ (wins + losses); older games recorded wins only, so no percentage is shown"],
            ["TO",     "Turnovers",         "Turnovers committed"],
          ]},
          { group: "Clearing & Riding", rows: [
            ["Clr",       "Successful clears",  "Team cleared the ball from the defensive half"],
            ["FCl",       "Failed clears",      "Team failed to clear"],
            ["Clearing %","Clearing percentage","Successful clears ÷ (Successful + Failed clears)"],
            ["SRide",     "Successful rides",   "Opponent's failed clears (auto-computed)"],
            ["FRide",     "Failed rides",       "Opponent's successful clears (auto-computed)"],
          ]},
          { group: "Penalties", rows: [
            ["Tech",   "Technical fouls",       "30-second releasable fouls"],
            ["PF Min", "Personal foul minutes", "Total penalty minutes from personal fouls"],
          ]},
        ].map(({ group, rows }) => (
          <div key={group} style={{ ...S.card, marginBottom: 10 }}>
            <p style={S.cardTitle}>{group}</p>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: 72 }}>Abbrev</th>
                  <th style={{ ...S.th, width: 160 }}>Name</th>
                  <th style={S.th}>Description</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([abbr, name, desc]) => (
                  <tr key={abbr}>
                    <td style={{ ...S.td, fontWeight: 700, fontFamily: "monospace", fontSize: 12 }}>{abbr}</td>
                    <td style={{ ...S.td, fontWeight: 600 }}>{name}</td>
                    <td style={{ ...S.td, color: "#666" }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

    </div>
    </>
  );
}
