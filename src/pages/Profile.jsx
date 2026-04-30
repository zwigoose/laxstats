import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { displayName, FAKE_DOMAIN } from "./Admin/helpers";

const FAKE = FAKE_DOMAIN; // "@laxstats.app"

const S = {
  page:       { maxWidth: 480, margin: "0 auto", padding: "28px 16px 40px", fontFamily: "system-ui, sans-serif" },
  heading:    { fontSize: 22, fontWeight: 800, color: "#111", letterSpacing: "-0.02em", marginBottom: 24 },
  card:       { background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, padding: "20px 20px", marginBottom: 16 },
  cardTitle:  { fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 },
  row:        { display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 },
  label:      { fontSize: 12, fontWeight: 600, color: "#888" },
  value:      { fontSize: 14, color: "#111" },
  input:      { width: "100%", fontSize: 14, padding: "8px 10px", border: "1px solid #ddd", borderRadius: 8, outline: "none", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" },
  btn:        { padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "system-ui, sans-serif" },
  btnPrimary: { background: "#111", color: "#fff" },
  btnDanger:  { background: "#fff", color: "#c0392b", border: "1px solid #e0b0b0" },
  success:    { fontSize: 12, color: "#2a7a3b", marginTop: 6 },
  error:      { fontSize: 12, color: "#c0392b", marginTop: 6 },
  divider:    { height: 1, background: "#f0f0f0", margin: "14px 0" },
};

function Field({ label, value }) {
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <span style={S.value}>{value}</span>
    </div>
  );
}

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const isLaxstatsAccount = user?.email?.endsWith(FAKE);
  const username  = user ? displayName(user.email) : "";
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  // ── Display name ──────────────────────────────────────────────────────────
  const [displayNameVal, setDisplayNameVal] = useState("");
  const [displayNameStatus, setDisplayNameStatus] = useState(null); // null | "saving" | "saved" | "error"

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).single()
      .then(({ data }) => { if (data?.display_name) setDisplayNameVal(data.display_name); });
  }, [user?.id]);

  async function saveDisplayName() {
    setDisplayNameStatus("saving");
    const { error } = await supabase.from("profiles").update({ display_name: displayNameVal.trim() || null }).eq("id", user.id);
    setDisplayNameStatus(error ? "error" : "saved");
    if (!error) setTimeout(() => setDisplayNameStatus(null), 2500);
  }

  // ── Change email ──────────────────────────────────────────────────────────
  const [newEmail, setNewEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState(null);

  async function changeEmail() {
    setEmailStatus("saving");
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) { setEmailStatus({ error: error.message }); return; }
    setEmailStatus("sent");
    setNewEmail("");
  }

  // ── Change password ───────────────────────────────────────────────────────
  const [newPassword, setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus]   = useState(null);

  async function changePassword() {
    if (newPassword.length < 6) { setPasswordStatus({ error: "Password must be at least 6 characters." }); return; }
    if (newPassword !== confirmPassword) { setPasswordStatus({ error: "Passwords do not match." }); return; }
    setPasswordStatus("saving");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setPasswordStatus({ error: error.message }); return; }
    setPasswordStatus("saved");
    setNewPassword(""); setConfirmPassword("");
    setTimeout(() => setPasswordStatus(null), 2500);
  }

  // ── Sign out ──────────────────────────────────────────────────────────────
  async function signOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  if (authLoading) return null;

  return (
    <div style={S.page}>
      <div style={S.heading}>Profile</div>

      {/* ── Account info ── */}
      <div style={S.card}>
        <div style={S.cardTitle}>Account</div>
        {isLaxstatsAccount
          ? <Field label="Username" value={username} />
          : <Field label="Email" value={user.email} />
        }
        <Field label="Member since" value={memberSince} />
      </div>

      {/* ── Display name ── */}
      <div style={S.card}>
        <div style={S.cardTitle}>Display name</div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
          Shown in place of your username wherever your name appears.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            style={S.input}
            placeholder={username}
            value={displayNameVal}
            onChange={e => { setDisplayNameVal(e.target.value); setDisplayNameStatus(null); }}
            onKeyDown={e => e.key === "Enter" && saveDisplayName()}
            maxLength={60}
          />
          <button
            style={{ ...S.btn, ...S.btnPrimary, whiteSpace: "nowrap" }}
            onClick={saveDisplayName}
            disabled={displayNameStatus === "saving"}
          >
            {displayNameStatus === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
        {displayNameStatus === "saved" && <div style={S.success}>Display name saved.</div>}
        {displayNameStatus === "error"  && <div style={S.error}>Failed to save. Try again.</div>}
      </div>

      {/* ── Change email ── */}
      <div style={S.card}>
        <div style={S.cardTitle}>Change email</div>
        {isLaxstatsAccount && (
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
            You currently sign in with the username <strong>{username}</strong>. Adding a real email lets you use it to sign in instead.
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            style={S.input}
            type="email"
            placeholder="new@example.com"
            value={newEmail}
            onChange={e => { setNewEmail(e.target.value); setEmailStatus(null); }}
            onKeyDown={e => e.key === "Enter" && changeEmail()}
          />
          <button
            style={{ ...S.btn, ...S.btnPrimary, whiteSpace: "nowrap" }}
            onClick={changeEmail}
            disabled={!newEmail.trim() || emailStatus === "saving"}
          >
            {emailStatus === "saving" ? "Sending…" : "Update"}
          </button>
        </div>
        {emailStatus === "sent" && (
          <div style={S.success}>Confirmation sent — check your new inbox to complete the change.</div>
        )}
        {emailStatus?.error && <div style={S.error}>{emailStatus.error}</div>}
      </div>

      {/* ── Change password ── */}
      <div style={S.card}>
        <div style={S.cardTitle}>Change password</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            style={S.input}
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); setPasswordStatus(null); }}
          />
          <input
            style={S.input}
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setPasswordStatus(null); }}
            onKeyDown={e => e.key === "Enter" && changePassword()}
          />
          <button
            style={{ ...S.btn, ...S.btnPrimary, alignSelf: "flex-start" }}
            onClick={changePassword}
            disabled={!newPassword || passwordStatus === "saving"}
          >
            {passwordStatus === "saving" ? "Saving…" : "Change password"}
          </button>
        </div>
        {passwordStatus === "saved"   && <div style={S.success}>Password updated.</div>}
        {passwordStatus?.error        && <div style={S.error}>{passwordStatus.error}</div>}
      </div>

      {/* ── Sign out ── */}
      <div style={S.card}>
        <div style={S.cardTitle}>Session</div>
        <button style={{ ...S.btn, ...S.btnDanger }} onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}
