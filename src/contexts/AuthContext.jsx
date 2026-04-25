import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [profile, setProfile] = useState(null);
  const [orgMemberships, setOrgMemberships] = useState([]); // [{ org_id, role, org: { name, slug } }]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
      if (session) loadProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
      if (session) loadProfile(session.user.id);
      else { setProfile(null); setOrgMemberships([]); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    const [profileRes, membershipsRes] = await Promise.all([
      supabase.from("profiles").select("is_admin").eq("id", userId).single(),
      supabase.from("org_members").select("org_id, role, organizations(name, slug)").eq("user_id", userId),
    ]);

    setProfile(profileRes.data ?? { is_admin: false });
    setOrgMemberships(
      (membershipsRes.data ?? []).map(m => ({
        org_id: m.org_id,
        role: m.role,
        org: m.organizations,
      }))
    );
  }

  // Returns the caller's role in a given org, or null if not a member
  const getOrgRole = useCallback((orgId) => {
    const m = orgMemberships.find(m => m.org_id === orgId);
    return m?.role ?? null;
  }, [orgMemberships]);

  const value = {
    session,
    user: session?.user ?? null,
    isAdmin: profile?.is_admin ?? false,
    isPlatformAdmin: profile?.is_admin ?? false, // alias for v2 naming
    orgMemberships,
    getOrgRole,
    loading: session === undefined,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
