                  <span style={{ margin: "0 12px", color: "#ccc" }}>—</span>
                  <span style={{ color: teamColors[1] }}>{totalScores[1]}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, textAlign: "left" }}>
                  {[0, 1].map(ti => { const qs = qSummaryStats(ti, currentQuarter); return (
                    <div key={ti} style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", border: "1px solid #e5e5e5" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: teamColors[ti], marginBottom: 6 }}>{teams[ti].name}</div>
                      {[["goal","Goals"],["shot","Shots"],["ground_ball","GBs"],["faceoff_win","FO W"],["turnover","TOs"],["clear","Clears"],["failed_clear","Failed Cl"]].map(([k,l]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                          <span style={{ color: "#888" }}>{l}</span>
                          <span style={{ fontWeight: qs[k] > 0 ? 600 : 400, color: qs[k] > 0 ? "#111" : "#ccc" }}>{qs[k]}</span>
                        </div>
                      ))}
                    </div>
                  ); })}
                </div>
                {currentQuarter === 4 && totalScores[0] === totalScores[1] && <div style={{ fontSize: 12, color: "#e67e22", marginTop: 12 }}>Score is tied — overtime will begin</div>}
                {currentQuarter === 4 && totalScores[0] !== totalScores[1] && <div style={{ fontSize: 12, color: "#555", marginTop: 12 }}>This will finalize the game.</div>}
                {currentQuarter < 4 && <div style={{ fontSize: 11, color: "#aaa", marginTop: 12 }}>Stats for this quarter will be locked.</div>}
              </div>
              <div style={S.confirmBtns}>
                <button style={S.btnSecondary} onClick={resetEntry}>Cancel</button>
                <button style={S.btnWarning} onClick={handleEndQuarter}>
                  {currentQuarter === 4 && totalScores[0] !== totalScores[1] ? "Finalize Game ✓" : currentQuarter === 4 ? "Start OT ✓" : `Confirm End ${curQLabel} ✓`}
                </button>
              </div>
            </div>
          )}

          {/* Duplicate confirm — clock-anchored event already exists in log from another scorer */}
          {step === "confirm_duplicate" && pendingDuplicateCommit && (
            <div>
              <div style={{ ...S.confirmCard, background: "#fff8ec", border: "1px solid #e0c060" }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>⚠️</div>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Possible duplicate</div>
                <div style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>
                  Another scorer already logged the same event at the same time. Is this a separate entry or a duplicate?
                </div>
              </div>
              <div style={S.confirmBtns}>
                <button style={S.btnSecondary} onClick={() => { setPendingDuplicateCommit(null); resetEntry(); }}>
                  Discard
                </button>
                <button style={S.btnWarning} onClick={() => {
                  const { entries: e, flashText: ft } = pendingDuplicateCommit;
                  setPendingDuplicateCommit(null);
                  doCommitEntries(e, ft);
                }}>
                  Log anyway
                </button>              </div>
            </div>
          )}

          {/* Delete confirm */}
          {step === "confirm_delete" && deletingGroupId && (
            <div>
              <div style={{ ...S.confirmCard, background: "#fff5f5", border: "1px solid #f0a0a0" }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>🗑️</div>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Delete this entry?</div>
                {(() => { const group = getGroupById(deletingGroupId); const primary = groupPrimary(group); const { icon, label, player } = entryDisplayInfo(primary); return (
                  <div style={{ fontSize: 14, color: "#888" }}>
                    {icon} {label}{player ? ` — #${player.num} ${player.name}` : ""} · {teams[primary.teamIdx]?.name}
                    {group.length > 1 && <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>({group.length} linked entries will be removed)</div>}
                  </div>
                ); })()}
              </div>
              <div style={S.confirmBtns}>
                <button style={S.btnSecondary} onClick={() => { setDeletingGroupId(null); setStep("team"); }}>Cancel</button>
                <button style={S.btnDanger} onClick={() => { handleDeleteGroup(deletingGroupId); setStep("team"); }}>Delete ✓</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ STATS ══ */}
      {screen === "stats" && (
        <div>
          {gameOver ? (
            <div style={S.finalBanner}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa", marginBottom: 8 }}>Final</div>
              <div style={{ fontSize: 42, fontWeight: 500, letterSpacing: 4, marginBottom: 6 }}>
                <span style={{ color: teamColors[0] }}>{totalScores[0]}</span>
                <span style={{ color: "#555", margin: "0 10px" }}>—</span>
                <span style={{ color: teamColors[1] }}>{totalScores[1]}</span>
              </div>
              <div style={{ fontSize: 13, color: "#aaa", marginBottom: 10 }}>{totalScores[0] > totalScores[1] ? teams[0].name : teams[1].name} wins{allQuarters.some(q => isOT(q)) ? " in overtime" : ""}</div>
              <button style={{ fontSize: 13, padding: "8px 18px", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, background: "transparent", color: exportCopied ? "#9fe1cb" : "rgba(255,255,255,0.7)", cursor: "pointer" }}
                onClick={handleExport}>{exportCopied ? "✓ Copied!" : "Export game JSON"}</button>
            </div>
          ) : (
            <div style={S.scoreHeader}>
              <div style={{ fontSize: 13, fontWeight: 600, color: teamColors[0] }}>{teams[0].name}</div>
              <div style={S.scoreBig}>
                <span style={{ color: teamColors[0] }}>{totalScores[0]}</span>
                <span style={{ color: "#ddd", margin: "0 8px" }}>—</span>
                <span style={{ color: teamColors[1] }}>{totalScores[1]}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: teamColors[1], textAlign: "right" }}>{teams[1].name}</div>
            </div>
          )}

          {/* Timeouts remaining (live games only) */}
          {!gameOver && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              {[0, 1].map(ti => (
                <div key={ti} style={{ fontSize: 12, color: teamColors[ti], fontWeight: 500 }}>
                  ⏸ {timeoutsLeft[ti]} timeout{timeoutsLeft[ti] !== 1 ? "s" : ""} left
                </div>
              ))}
            </div>
          )}

          {/* Quarter score grid */}
          {allQuarters.length > 1 && (
            <div style={{ ...S.tableWrap, marginBottom: 20 }}>
              <table style={{ ...S.table, fontSize: 13 }}>
                <thead><tr>
                  <th style={S.thLeft}>Team</th>
                  {allQuarters.map(q => <th key={q} style={{ ...S.th(false), color: completedQuarters.includes(q) ? "#888" : teamColors[0] }}>
                    {qLabel(q)}{!completedQuarters.includes(q) && !gameOver && <span style={{ display: "block", fontSize: 9, color: "#4caf50", fontWeight: 400 }}>live</span>}
                  </th>)}
                  <th style={{ ...S.th(false), color: "#111", borderLeft: "1px solid #e5e5e5" }}>Total</th>
                </tr></thead>
                <tbody>{[0,1].map(ti => <tr key={ti}>
                  <td style={{ ...S.tdLeft, fontWeight: 600, color: teamColors[ti] }}>{teams[ti].name}</td>
                  {allQuarters.map(q => <td key={q} style={S.td}>{(scoresByQuarter[q] || [0,0])[ti]}</td>)}
                  <td style={{ ...S.td, fontWeight: 600, borderLeft: "1px solid #e5e5e5" }}>{totalScores[ti]}</td>
                </tr>)}</tbody>
              </table>
            </div>
          )}

          {/* Quarter filter */}
          <div style={S.tabsRow}>
            <button style={S.tabBtn(statsQtr === "all")} onClick={() => setStatsQtr("all")}>All</button>
            {completedQuarters.map(q => <button key={q} style={S.tabBtn(statsQtr === String(q))} onClick={() => setStatsQtr(String(q))}>{qLabel(q)}</button>)}
            {!gameOver && <button style={S.tabBtn(statsQtr === String(currentQuarter))} onClick={() => setStatsQtr(String(currentQuarter))}>{curQLabel} <span style={{ fontSize: 10, color: statsQtr === String(currentQuarter) ? "#aaa" : "#4caf50" }}>●</span></button>}
          </div>

          {/* Stats sub-tabs: Summary | Players | Timeline */}
          <div style={S.tabsRow}>
            {["summary","players","timeline"].map(t => (
              <button key={t} style={{ ...S.tabBtn(statsTab === t), border: "1px solid #ddd" }} onClick={() => setStatsTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Summary */}
          {statsTab === "summary" && (
            <div style={S.summaryGrid}>
              {[
                { heading: "Scoring" },
                { label: "Goals", key: "goal" }, { label: "Assists", key: "assist" },
                { label: "Successful EMO", key: "emo_goal" }, { label: "Failed EMO", key: "emo_fail" },
                { label: "EMO %", custom: emoPct },
                { heading: "Defense" },
                { label: "Successful MDD", key: "mdd_success" }, { label: "Failed MDD", key: "mdd_fail" },
                { label: "MDD %", custom: mddPct },
                { label: "Saves", key: "shot_saved" }, { label: "Save %", custom: savePct },
                { label: "Caused TOs", key: "forced_to" },
                { heading: "Shooting" },
                { label: "Total Shots", key: "shot" }, { label: "Shot %", custom: shotPct },
                { label: "Shots on Goal", key: "sog" }, { label: "SOG %", custom: sogPct },
                { label: "Blocked Shots", key: "shot_blocked" },
                { heading: "Possession" },
                { label: "Ground Balls", key: "ground_ball" }, { label: "Faceoffs Won", key: "faceoff_win" },
                { label: "Turnovers", key: "turnover" },
                { heading: "Clearing" },
                { label: "Successful Clears", key: "clear" }, { label: "Failed Clears", key: "failed_clear" },
                { label: "Clearing %", custom: clearPct },
                { label: "Successful Rides", key: "successful_ride" }, { label: "Failed Rides", key: "failed_ride" },
                { heading: "Penalties" },
                { label: "Technicals", key: "penalty_tech" }, { label: "PF Minutes", key: "penalty_min" },
              ].map((item) => item.heading ? (
                <div key={item.heading} style={{ gridColumn: "1 / -1", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#bbb", padding: "8px 2px 2px" }}>{item.heading}</div>
              ) : (
                <div key={item.label} style={S.summaryCard}>
                  <div style={S.summaryLabel}>{item.label}</div>
                  {[0,1].map(ti => (
                    <div key={ti} style={S.summaryRow}>
                      <div style={{ fontSize: 12, color: teamColors[ti] }}>{teams[ti].name}</div>
                      <div style={{ fontSize: 20, fontWeight: 500, color: teamColors[ti] }}>{item.custom ? item.custom(ti) : (teamTotals[ti][item.key] || 0)}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Players */}
          {statsTab === "players" && (
            filteredLog.filter(e => !e.teamStat).length === 0
              ? <div style={S.emptyState}>No player stats for this period</div>
              : <div style={S.tableWrap}>
                  <div style={S.tableTitle}><span>Player stats</span><span style={{ fontWeight: 400, fontSize: 11 }}>tap column to sort</span></div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={S.table}>
                      <thead><tr>
                        <th style={S.thLeft}>Player</th>
                        {STAT_KEYS.filter(k => k !== "clear" && k !== "failed_clear" && k !== "successful_ride" && k !== "failed_ride" && k !== "mdd_success" && k !== "mdd_fail" && k !== "emo_fail" && k !== "shot_post").map(k => <th key={k} style={S.th(sortKey === k)} onClick={() => setSortKey(k)}>{STAT_LABELS[k]}{sortKey === k ? " ▾" : ""}</th>)}
                      </tr></thead>
                      <tbody>
                        {[0,1].map(ti => {
                          const rows = sortedPlayers.filter(p => p.teamIdx === ti);
                          if (!rows.length) return null;
                          return [
                            <tr key={`h-${ti}`}><td colSpan={STAT_KEYS.length} style={{ padding: "8px 14px 4px", fontSize: 11, fontWeight: 600, color: teamColors[ti], background: "#fafafa" }}>{teams[ti].name.toUpperCase()}</td></tr>,
                            ...rows.map((row, i) => (
                              <tr key={`${ti}-${i}`}>
                                <td style={S.tdLeft}><span style={S.numBadge}>#{row.player.num}</span>{row.player.name}</td>
                                {STAT_KEYS.filter(k => k !== "clear" && k !== "failed_clear" && k !== "successful_ride" && k !== "failed_ride" && k !== "mdd_success" && k !== "mdd_fail" && k !== "emo_fail" && k !== "shot_post").map(k => <td key={k} style={{ ...S.td, fontWeight: k === sortKey ? 600 : 400, opacity: row[k] === 0 ? 0.3 : 1 }}>{k === "penalty_min" && row[k] > 0 ? `${row[k]}m` : row[k]}</td>)}
                              </tr>
                            ))
                          ];
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
          )}

          {/* Timeline — goals, timeouts, and penalties with timestamps */}
          {statsTab === "timeline" && (
            scoringTimeline.length === 0
              ? <div style={S.emptyState}>No events recorded yet</div>
              : <div style={S.tableWrap}>
                  <div style={S.tableTitle}><span>Timeline</span></div>
                  <table style={S.table}>
                    <thead><tr>
                      <th style={{ ...S.th(false), textAlign: "left", paddingLeft: 14 }}>Time</th>
                      <th style={{ ...S.th(false), textAlign: "left" }}>Team</th>
                      <th style={{ ...S.th(false), textAlign: "left" }}>Event</th>
                      <th style={{ ...S.th(false), textAlign: "left" }}>Assist</th>
                      <th style={S.th(false)}>Score</th>
                    </tr></thead>
                    <tbody>
                      {(() => {
                        const withScores = [];
                        const scores = [0, 0];
                        scoringTimeline.forEach(entry => {
                          if (entry.type === "goal") scores[entry.goal.teamIdx]++;
                          withScores.push({ ...entry, scoreSnap: [...scores] });
                        });
                        return [...withScores].reverse().map((entry, gi) => {
                          if (entry.type === "timeout") {
                            const to = entry.timeout;
                            return (
                              <tr key={`to-${gi}`} style={{ background: "#fafafa" }}>
                                <td style={{ ...S.tdLeft, fontVariantNumeric: "tabular-nums", width: 72, verticalAlign: "top", paddingTop: 12 }}>
                                  {to.timeoutTime ? <span style={{ fontWeight: 600, color: "#111", fontSize: 15 }}>{to.timeoutTime}</span> : <span style={{ color: "#ccc" }}>—</span>}
                                  <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#111", marginTop: 1 }}>{qLabel(to.quarter)}</span>
                                </td>
                                <td style={S.tdLeft}><span style={{ color: teamColors[to.teamIdx], fontWeight: 500 }}>{teams[to.teamIdx]?.name}</span></td>
                                <td style={{ ...S.tdLeft, color: "#888", fontStyle: "italic" }} colSpan={2}>⏸ Timeout</td>
                                <td style={{ ...S.td, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                  <span style={{ color: teamColors[0] }}>{entry.scoreSnap[0]}</span>
                                  <span style={{ color: "#ccc", margin: "0 3px" }}>–</span>
                                  <span style={{ color: teamColors[1] }}>{entry.scoreSnap[1]}</span>
                                </td>
                              </tr>
                            );
                          }
                          if (entry.type === "penalty") {
                            const p = entry.penalty;
                            const isTech = p.event === "penalty_tech";
                            const desc = isTech
                              ? `🟨 ${p.foulName ? `${p.foulName} (Technical)` : "Technical foul"}`
                              : `🟥 ${p.foulName ? `${p.foulName} (${p.penaltyMin}min${p.nonReleasable ? " NR" : ""})` : `Personal foul (${p.penaltyMin}min${p.nonReleasable ? " NR" : ""})`}`;
                            return (
                              <tr key={`p-${gi}`} style={{ background: "#fdf8f8" }}>
                                <td style={{ ...S.tdLeft, fontVariantNumeric: "tabular-nums", width: 72, verticalAlign: "top", paddingTop: 12 }}>
                                  {p.penaltyTime ? <span style={{ fontWeight: 600, color: "#111", fontSize: 15 }}>{p.penaltyTime}</span> : <span style={{ color: "#ccc" }}>—</span>}
                                  <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#111", marginTop: 1 }}>{qLabel(p.quarter)}</span>
                                </td>
                                <td style={S.tdLeft}><span style={{ color: teamColors[p.teamIdx], fontWeight: 500 }}>{teams[p.teamIdx]?.name}</span></td>
                                <td style={S.tdLeft} colSpan={2}>
                                  <span style={{ color: "#555" }}>{desc}</span>
                                  <span style={{ color: "#888", marginLeft: 6 }}>— #{p.player?.num} {p.player?.name}</span>
                                </td>
                                <td style={{ ...S.td, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                  <span style={{ color: teamColors[0] }}>{entry.scoreSnap[0]}</span>
                                  <span style={{ color: "#ccc", margin: "0 3px" }}>–</span>
                                  <span style={{ color: teamColors[1] }}>{entry.scoreSnap[1]}</span>
                                </td>
                              </tr>
                            );
                          }
                          const { goal, assist, scoreSnap } = entry;
                          return (
                            <tr key={`g-${gi}`}>
                              <td style={{ ...S.tdLeft, fontVariantNumeric: "tabular-nums", width: 72, verticalAlign: "top", paddingTop: 12 }}>
                                {goal.goalTime ? <span style={{ fontWeight: 600, color: "#111", fontSize: 15 }}>{goal.goalTime}</span> : <span style={{ color: "#ccc" }}>—</span>}
                                <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#111", marginTop: 1 }}>{qLabel(goal.quarter)}</span>
                              </td>
                              <td style={S.tdLeft}><span style={{ color: teamColors[goal.teamIdx], fontWeight: 500 }}>{teams[goal.teamIdx]?.name}</span></td>
                              <td style={S.tdLeft}>
                                <span style={{ fontWeight: 500 }}>#{goal.player?.num} {goal.player?.name}</span>
                                {goal.emo && <span style={{ marginLeft: 6, fontSize: 11, background: "#e8f5e9", color: "#2a7a3b", borderRadius: 4, padding: "1px 5px" }}>EMO</span>}
                              </td>
                              <td style={S.tdLeft}>
                                {assist ? <span style={{ color: "#888" }}>#{assist.player?.num} {assist.player?.name}</span> : <span style={{ color: "#ddd" }}>—</span>}
                              </td>
                              <td style={{ ...S.td, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                <span style={{ color: teamColors[0] }}>{scoreSnap[0]}</span>
                                <span style={{ color: "#ccc", margin: "0 3px" }}>–</span>
                                <span style={{ color: teamColors[1] }}>{scoreSnap[1]}</span>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
          )}
        </div>
      )}

      {/* ══ EVENT LOG (own top-level tab) ══ */}
      {screen === "log" && (
        <div>
          {/* Quarter filter */}
          <div style={S.tabsRow}>
            <button style={S.tabBtn(statsQtr === "all")} onClick={() => setStatsQtr("all")}>All</button>
            {completedQuarters.map(q => <button key={q} style={S.tabBtn(statsQtr === String(q))} onClick={() => setStatsQtr(String(q))}>{qLabel(q)}</button>)}
            {!gameOver && <button style={S.tabBtn(statsQtr === String(currentQuarter))} onClick={() => setStatsQtr(String(currentQuarter))}>{curQLabel} <span style={{ fontSize: 10, color: statsQtr === String(currentQuarter) ? "#aaa" : "#4caf50" }}>●</span></button>}
          </div>

          <div style={S.tableWrap}>
            <div style={S.tableTitle}>
              <span>Event log</span>
              <span style={{ fontWeight: 400 }}>{logGroups.length} entries</span>
            </div>
            {logGroups.length === 0
              ? <div style={S.emptyState}>No events for this period</div>
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