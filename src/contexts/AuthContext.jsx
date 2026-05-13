import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession]           = useState(undefined); // undefined = still initializing
  const [profile, setProfile]           = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [orgMemberships, setOrgMemberships] = useState([]); // [{ org_id, role, org: { name, slug } }]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
      if (session) loadProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
      if (session) loadProfile(session.user.id);
      else { setProfile(null); setOrgMemberships([]); setProfileLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    setProfileLoading(true);
    const [profileRes, membershipsRes] = await Promise.all([
      supabase.from("profiles")
        .select("is_admin, personal_plan, personal_plan_status, display_name")
        .eq("id", userId).single(),
      supabase.from("org_members")
        .select("org_id, role, organizations(id, name, slug, plan, plan_status)")
        .eq("user_id", userId),
    ]);

    if (profileRes.error) {
      console.error("[AuthContext] profile fetch error:", profileRes.error);
      // Fallback: fetch only is_admin so admin access is never lost due to schema issues
      const { data: minProfile } = await supabase
        .from("profiles").select("is_admin").eq("id", userId).single();
      setProfile({ is_admin: minProfile?.is_admin ?? false, personal_plan: "free", personal_plan_status: "active" });
    } else {
      setProfile(profileRes.data);
    }

    setOrgMemberships(
      (membershipsRes.data ?? []).map(m => ({
        org_id: m.org_id,
        role: m.role,
        org: m.organizations,
      }))
    );
    setProfileLoading(false);
  }

  // Allows any page to force a re-read of profile + org memberships from the DB.
  // Used by Orgs.jsx after a Stripe checkout redirect to detect the webhook-created org.
  const refreshProfile = useCallback(() => {
    const uid = session?.user?.id;
    if (!uid) return Promise.resolve();
    return loadProfile(uid);
  // loadProfile is a stable closure — the session dep captures the user id
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Returns the caller's role in a given org, or null if not a member
  const getOrgRole = useCallback((orgId) => {
    const m = orgMemberships.find(m => m.org_id === orgId);
    return m?.role ?? null;
  }, [orgMemberships]);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    isAdmin: profile?.is_admin ?? false,
    isPlatformAdmin: profile?.is_admin ?? false,
    orgMemberships,
    getOrgRole,
    refreshProfile,
    loading: session === undefined || profileLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
