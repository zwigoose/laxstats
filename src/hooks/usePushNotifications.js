import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// The browser push subscription is one-per-origin and shared by every game
// this browser follows. Which games are followed is tracked per game in
// game_subscriptions rows (server side, for delivery) and mirrored in
// localStorage (client side, for UI status) — anonymous rows have no SELECT
// policy, so the followed-game list can't be read back from the DB for guests.
const FOLLOWS_KEY = "laxstats:push-follows";

function getFollows() {
  try { return JSON.parse(localStorage.getItem(FOLLOWS_KEY)) || []; } catch { return []; }
}

function setFollows(ids) {
  try { localStorage.setItem(FOLLOWS_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
}

export function usePushNotifications(gameId, userId) {
  const [isSupported, setIsSupported]   = useState(false);
  const [permission, setPermission]     = useState("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    setIsSupported("serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY);
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!isSupported || !gameId) return;
    checkExistingSubscription();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported, gameId]);

  async function checkExistingSubscription() {
    try {
      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return; // browser isn't subscribed to anything

      // Following is per game, not per browser — check the local follow list
      if (getFollows().includes(gameId)) {
        setIsSubscribed(true);
        return;
      }

      // Authenticated users can read their own rows back (e.g. localStorage was
      // cleared) — resync the local list from the DB.
      if (userId) {
        const { data } = await supabase
          .from("game_subscriptions")
          .select("id")
          .eq("game_id", gameId)
          .contains("push_subscription", { endpoint: sub.endpoint })
          .maybeSingle();
        if (data) {
          setFollows([...new Set([...getFollows(), gameId])]);
          setIsSubscribed(true);
        }
      }
    } catch {
      // ignore — browser may not have an active SW yet
    }
  }

  async function subscribe() {
    if (!isSupported || loading) return;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      // Delete-then-insert instead of select-then-insert: anonymous rows can't
      // be SELECTed under RLS, but they can be deleted by endpoint — this keeps
      // re-follows from piling up duplicate rows (= duplicate notifications).
      await supabase
        .from("game_subscriptions")
        .delete()
        .eq("game_id", gameId)
        .contains("push_subscription", { endpoint: sub.endpoint });
      const { error: insertErr } = await supabase.from("game_subscriptions").insert({
        game_id:           gameId,
        user_id:           userId ?? null,
        push_subscription: sub.toJSON(),
      });
      if (insertErr) { console.error("Push subscription save failed:", insertErr); return; }

      setFollows([...new Set([...getFollows(), gameId])]);
      setIsSubscribed(true);
    } catch (err) {
      console.error("Push subscribe failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    if (!isSupported || loading) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase
          .from("game_subscriptions")
          .delete()
          .eq("game_id", gameId)
          .contains("push_subscription", { endpoint: sub.endpoint });
        const remaining = getFollows().filter(id => id !== gameId);
        setFollows(remaining);
        // The browser-level subscription is shared by every followed game —
        // only tear it down once nothing follows it anymore.
        if (remaining.length === 0) await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return { isSupported, permission, isSubscribed, loading, subscribe, unsubscribe };
}
