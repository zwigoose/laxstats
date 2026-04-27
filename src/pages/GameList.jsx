          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 28 }}>
            Stat Tracker
          </div>
          {user && (
            <button onClick={handleNewGame} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "11px 22px", fontSize: 14, fontWeight: 700,
              background: "#fff", color: "#111",
              border: "none", borderRadius: 12, cursor: "pointer",
            }}>
              ＋ New Game
            </button>
          )}
        </div>
      </div>

      {/* ── Live Games (all users, public) ── */}
      <LiveGamesSection user={user} />

      {/* ── Completed games (public, unauth only — auth users see theirs in My Games) ── */}
      {!authLoading && !user && <PublicCompletedSection />}

      {/* ── My Games + Rosters tabs (authenticated only) ── */}
      {user && (
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>
          <div style={{ display: "flex", gap: 4, padding: "12px 0 0", marginBottom: 16, borderBottom: "1px solid #e8e8e8" }}>
            {[
              ["games", "My Games"],
              ...(orgMemberships?.length ? [["orgs", "Orgs"]] : []),
              ["rosters", "Rosters"],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding: "8px 18px", fontSize: 14, fontWeight: tab === id ? 700 : 500,
                border: "none", background: "transparent", cursor: "pointer",
                color: tab === id ? "#111" : "#aaa",
                borderBottom: tab === id ? "2px solid #111" : "2px solid transparent",
                marginBottom: -1,
              }}>{label}</button>
            ))}
          </div>

          {tab === "games" && <GamesTab onNewGame={handleNewGame} user={user} orgMemberships={orgMemberships} />}
          {tab === "orgs" && <OrgGamesSection orgMemberships={orgMemberships} />}
          {tab === "rosters" && <RostersTab />}
        </div>
      )}
    </div>
  );
}