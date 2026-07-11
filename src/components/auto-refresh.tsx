"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Polls the server for fresh data by re-running the Server Component tree.
// Combat resources (HP/Energy/etc.) change often mid-session, and this app
// has no realtime/websocket infra, so a light interval-based refresh is the
// pragmatic way to keep read-only overview pages current.
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
