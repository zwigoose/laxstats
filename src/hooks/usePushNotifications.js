import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export function usePushNotifications(gameId, userId) {
  const [isSupported, setIsSupported]   = useState(false);
  const [permission, setPermission]     = useState("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [endpoint, setEndpoint]         = useState(null);

  useEffect(() => {
    setIsSupported("serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY);
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!isSupported || !gameId) return;
    checkExistingSubscription();
  }, [isSupported, gameId]);

  async function checkExistingSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      setEndpoint(sub.endpoint);
      const { data } = await supabase
        .from("game_subscriptions")
        .select("id")
        .eq("game_id", gameId)
        .contains("push_subscription", { endpoint: sub.endpoint })
        .maybeSingle();
      setIsSubscribed(!!data);
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

      setEndpoint(sub.endpoint);

      // Check if this browser+game combo is already stored before inserting
      const { data: existing } = await supabase
        .from("game_subscriptions")
        .select("id")
        .eq("game_id", gameId)
        .contains("push_subscription", { endpoint: sub.endpoint })
        .maybeSingle();

      if (!existing) {
        await supabase.from("game_subscriptions").insert({
          game_id:           gameId,
          user_id:           userId ?? null,
          push_subscription: sub.toJSON(),
        });
      }

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
        await sub.unsubscribe();
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
