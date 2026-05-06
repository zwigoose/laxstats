import { useEffect } from "react";

const BASE = import.meta.env.VITE_APP_TITLE || "LaxStats";

export function useDocTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : BASE;
    return () => { document.title = BASE; };
  }, [title]);
}
