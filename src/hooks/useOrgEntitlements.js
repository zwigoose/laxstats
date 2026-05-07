import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useOrgEntitlements(orgId) {
  const [entitlements, setEntitlements] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId) { setEntitlements({}); return; }
    setLoading(true);
    supabase.rpc("org_entitlement_summary", { p_org_id: orgId })
      .then(({ data: rows }) => {
        const map = {};
        (rows || []).forEach(r => {
          map[r.feature_id] = { ...r, current_usage: Number(r.current_usage) };
        });
        setEntitlements(map);
        setLoading(false);
      });
  }, [orgId]);

  return { entitlements, loading };
}
