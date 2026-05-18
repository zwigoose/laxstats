                : <div style={S.logList}>
                    {(() => {
                      const items = [];
                      let lastQ = null;
                      const reversed = [...logGroups].reverse();
                      reversed.forEach((group, gi) => {
                        const primary = groupPrimary(group);
                        const q = primary.quarter;
                        if (statsQtr === "all" && q !== lastQ) {
                          items.push(<div key={`qd-${q}-${gi}`} style={S.qtrDivider}>{qLabel(q)}</div>);
                          lastQ = q;
                        }
                        const { icon, label, player } = entryDisplayInfo(primary);
                        const playerStr = primary.teamStat ? `${teams[primary.teamIdx]?.name} (team)` : (player ? `#${player.num} ${player.name}` : "");
                        const subItems = [];
                        group.forEach(e => {
                          if (e.event === "shot_saved") subItems.push(`🧤 Saved by #${e.player?.num} ${e.player?.name}`);
                          if (e.event === "assist") subItems.push(`🤝 Assist: #${e.player?.num} ${e.player?.name}`);
                          if (e.event === "turnover" && group.some(x => x.event === "forced_to")) subItems.push(`↩️ TO by #${e.player?.num} ${e.player?.name}`);
                        });
                        if (primary.event === "goal" && primary.goalTime) subItems.push(`⏱ ${primary.goalTime} remaining`);
                        if (primary.event === "goal" && primary.emo) subItems.push("⚡ EMO");
                        const gid = primary.groupId;
                        items.push(
                          <div key={gid} style={S.logGroup}>
                            <div style={S.logGroupMain}>
                              <div style={S.logDot(teamColors[primary.teamIdx])}></div>
                              <span style={{ fontWeight: 500, flex: 1 }}>{icon} {label}</span>
                              <span style={{ color: "#888", fontSize: 12 }}>{playerStr}</span>
                              <span style={{ color: teamColors[primary.teamIdx], fontSize: 11, marginLeft: 6 }}>{teams[primary.teamIdx]?.name}</span>
                              {!gameOver && <>
                                <button style={S.logActionBtn()} title="Edit" onClick={() => startEdit(gid)}>✏️</button>
                                <button style={S.logActionBtn("#c0392b")} title="Delete" onClick={() => { setDeletingGroupId(gid); setScreen("track"); setStep("confirm_delete"); }}>✕</button>
                              </>}
                            </div>
                            {subItems.length > 0 && <div style={S.logGroupSub}>{subItems.map((s, i) => <span key={i} style={S.logSubChip}>{s}</span>)}</div>}
                          </div>
                        );
                      });
                      return items;
                    })()}
                  </div>
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
  function handleFaceoffGBNo() {
    const entries = pendingEntries;
    const f = entries.find(e => e.event === 'faceoff_win');
    commitEntries(entries, `Faceoff W — #${f.player.num} ${f.player.name}`);
    resetEntry();
  }
  function handleFaceoffGBYes() { setStep("faceoff_gb_player"); }
  function handleFaceoffGBPlayerSelected(player) {
    const f = pendingEntries.find(e => e.event === 'faceoff_win');
    const entries = [...pendingEntries, mkEntry(selectedTeam, "ground_ball", player)];
    commitEntries(entries, `FO Win + GB — #${f.player.num} / #${player.num}`);
    resetEntry();
  }

          {step === "ask_faceoff_gb" && (
            <div>
              <button style={S.backBtn} onClick={() => setStep("player")}>← Back</button>
              <div style={S.pendingBubble(teamColors[selectedTeam])}>
                🔄 Faceoff Win — #{selectedPlayer?.num} {selectedPlayer?.name} · {teams[selectedTeam]?.name}
              </div>
              <div style={S.questionCard}><div style={S.questionText}>Who came up with the GB?</div></div>
              <div style={S.yesNoRow}>
                <button style={S.btnNo} onClick={handleFaceoffGBNo}>Nobody (Straight win)</button>
                <button style={S.btnYes} onClick={() => handleFaceoffGBPlayerSelected(selectedPlayer)}>FOGO did (#{selectedPlayer?.num})</button>
                <button style={S.btnYes} onClick={handleFaceoffGBYes}>Someone else...</button>
              </div>
            </div>
          )}

          {step === "faceoff_gb_player" && (
            <div>
              <button style={S.backBtn} onClick={() => setStep("ask_faceoff_gb")}>← Back</button>
              <div style={{ ...S.stepLabel }}>Ground Ball — Which player?</div>
              {(() => {
                const isHome = selectedTeam === 0;
                const roster = parsedRosters[selectedTeam] || [];
                return (
                  <div style={S.playerGrid}>
                    {roster.map((p, i) => (
                      <button key={i} style={S.playerBtn(false, teamColors[selectedTeam], isHome)} onClick={() => handleFaceoffGBPlayerSelected(p)}>
                        <span style={S.playerNum(false, isHome, teamColors[selectedTeam])}>#{p.num}</span>
                        <span style={S.playerName(false, isHome, teamColors[selectedTeam])}>{p.name}</span>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

}