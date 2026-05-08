import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function usePersonalGameUsage(user) {
  const [usage, setUsage] = useState(null);
  useEffect(() => {
    if (!user) { setUsage(null); return; }
    supabase.rpc("personal_game_usage").then(({ data }) => {
      setUsage(data?.[0] ?? null);
    });
  }, [user?.id]);
  return usage;
}
