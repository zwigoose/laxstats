              : <div style={S.logList}>
                  {(() => {
                    const items = [];
                    let lastQ = null;
                    // Show newest first; quarter dividers only in "all" view
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
        </div>
      )}
    </div>
  );
}