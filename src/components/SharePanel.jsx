import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { C, F } from "../styles/tokens";

export default function SharePanel({ rosterId }) {
  const [shares, setShares]           = useState([]);
  const [loaded, setLoaded]           = useState(false);
  const [username, setUsername]       = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [searching, setSearching]     = useState(false);
  const [adding, setAdding]           = useState(false);
  const [removingId, setRemovingId]   = useState(null);

  useEffect(() => {
    supabase.rpc("get_roster_shares", { p_roster_id: rosterId })
      .then(({ data }) => { setShares(data || []); setLoaded(true); });
  }, [rosterId]);

  async function handleSearch() {
    setSearching(true); setSearchResult(null); setSearchError(null);
    const { data, error: err } = await supabase.rpc("find_user_by_username", { p_username: username.trim() });
    if (err || !data?.length) setSearchError("User not found.");
    else if (shares.some(s => s.shared_with_user_id === data[0].id)) setSearchError("Already shared with this user.");
    else setSearchResult(data[0]);
    setSearching(false);
  }

  async function handleAdd() {
    if (!searchResult) return;
    setAdding(true);
    const { error: err } = await supabase.from("roster_shares").insert({ roster_id: rosterId, shared_with_user_id: searchResult.id });
    if (!err) {
      setShares(prev => [...prev, { share_id: null, shared_with_user_id: searchResult.id, display_name: searchResult.display_name }]);
      setSearchResult(null); setUsername("");
      supabase.rpc("get_roster_shares", { p_roster_id: rosterId }).then(({ data }) => setShares(data || []));
    }
    setAdding(false);
  }

  async function handleRemove(shareId) {
    setRemovingId(shareId);
    await supabase.from("roster_shares").delete().eq("id", shareId);
    setShares(prev => prev.filter(s => s.share_id !== shareId));
    setRemovingId(null);
  }

  if (!loaded) return <div style={{ fontSize: 12, color: C.gray400, paddingTop: 12 }}>Loading shares…</div>;

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px dashed ${C.gray100}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Sharing</div>

      {shares.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 10px" }}>
          {shares.map(s => (
            <li key={s.share_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.gray50}` }}>
              <span style={{ fontSize: 13, color: C.gray700 }}>{s.display_name}</span>
              <button onClick={() => handleRemove(s.share_id)} disabled={removingId === s.share_id}
                style={{ fontSize: 11, color: C.red600, background: "none", border: `1px solid ${C.red300}`, borderRadius: 6, cursor: "pointer", padding: "2px 8px" }}>
                {removingId === s.share_id ? "…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <input
          style={{ flex: 1, padding: "7px 10px", fontSize: 13, border: `1px solid ${C.gray200}`, borderRadius: 8, fontFamily: F.ui, boxSizing: "border-box" }}
          placeholder="Username or email"
          value={username}
          autoCapitalize="off" autoCorrect="off"
          onChange={e => { setUsername(e.target.value); setSearchResult(null); setSearchError(null); }}
          onKeyDown={e => e.key === "Enter" && username.trim() && handleSearch()}
        />
        <button onClick={handleSearch} disabled={!username.trim() || searching}
          style={{ padding: "7px 12px", fontSize: 13, fontWeight: 600, background: username.trim() && !searching ? C.gray900 : C.gray300, color: C.white, border: "none", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}>
          {searching ? "…" : "Find"}
        </button>
      </div>

      {searchError && <div style={{ fontSize: 12, color: C.red600, marginBottom: 6 }}>{searchError}</div>}

      {searchResult && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", background: C.gray50, borderRadius: 8 }}>
          <span style={{ fontSize: 13, color: C.gray900 }}>{searchResult.display_name}</span>
          <button onClick={handleAdd} disabled={adding}
            style={{ fontSize: 12, fontWeight: 600, color: C.green600, background: C.green50, border: `1px solid ${C.green200}`, borderRadius: 6, cursor: "pointer", padding: "3px 10px" }}>
            {adding ? "…" : "Share"}
          </button>
        </div>
      )}
    </div>
  );
}
