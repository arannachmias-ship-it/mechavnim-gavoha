"use client";
import { useEffect, useState, useCallback } from "react";
import type { Summary } from "./progress";

export function useProgress() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [profile, setProfile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/progress", { cache: "no-store" });
      if (r.status === 401) {
        setError("unauth");
        return;
      }
      const j = await r.json();
      setSummary(j.summary);
      setProfile(j.profile ?? null);
    } catch {
      setError("network");
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { summary, profile, error, reload };
}

export async function logAttempt(body: Record<string, unknown>) {
  try {
    await fetch("/api/attempt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    /* offline – ignore */
  }
}
