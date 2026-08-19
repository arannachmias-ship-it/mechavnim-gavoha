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

/** 🎯 התוכנית עד המבחן (מחושבת בשרת) */
export function usePlan() {
  const [plan, setPlan] = useState<import("./plan").Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/plan", { cache: "no-store" });
      if (r.status === 401) return setError("unauth");
      const j = await r.json();
      if (j.ok) setPlan(j.plan);
    } catch {
      setError("network");
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { plan, error, reload };
}
