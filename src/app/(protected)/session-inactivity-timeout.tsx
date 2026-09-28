"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const idleTimeoutMs = 30 * 60 * 1000;
const activityKeyPrefix = "leaf-assemble:last-activity:";

export function SessionInactivityTimeout({ authUserId }: { authUserId: string }) {
  const router = useRouter();

  useEffect(() => {
    const key = `${activityKeyPrefix}${authUserId}`;
    let timer = 0;
    let lastWrite = 0;

    function getLastActivity() {
      const stored = Number(window.localStorage.getItem(key));
      return Number.isFinite(stored) && stored > 0 ? stored : Date.now();
    }

    function signOutIfIdle() {
      const lastActivity = getLastActivity();
      const remaining = idleTimeoutMs - (Date.now() - lastActivity);
      if (remaining <= 0) {
        router.replace("/auth/signout?reason=idle");
        return;
      }
      timer = window.setTimeout(signOutIfIdle, remaining);
    }

    function recordActivity() {
      const now = Date.now();
      if (now - lastWrite >= 1000) {
        window.localStorage.setItem(key, String(now));
        lastWrite = now;
      }
      window.clearTimeout(timer);
      signOutIfIdle();
    }

    function syncActivity(event: StorageEvent) {
      if (event.key !== key) return;
      window.clearTimeout(timer);
      if (event.newValue === null) {
        router.replace("/login");
        return;
      }
      signOutIfIdle();
    }

    if (!window.localStorage.getItem(key)) {
      window.localStorage.setItem(key, String(Date.now()));
    }
    signOutIfIdle();

    const activityEvents = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart", "wheel"] as const;
    activityEvents.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    window.addEventListener("storage", syncActivity);
    window.addEventListener("focus", signOutIfIdle);
    window.addEventListener("pageshow", signOutIfIdle);
    document.addEventListener("visibilitychange", signOutIfIdle);

    return () => {
      window.clearTimeout(timer);
      activityEvents.forEach((event) => window.removeEventListener(event, recordActivity));
      window.removeEventListener("storage", syncActivity);
      window.removeEventListener("focus", signOutIfIdle);
      window.removeEventListener("pageshow", signOutIfIdle);
      document.removeEventListener("visibilitychange", signOutIfIdle);
    };
  }, [authUserId, router]);

  return null;
}
