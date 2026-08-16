import { cookies } from "next/headers";

export type Profile = "noga" | "parent";
export const PROFILE_COOKIE = "mg_profile";

export async function getProfile(): Promise<Profile | null> {
  const c = await cookies();
  const v = c.get(PROFILE_COOKIE)?.value;
  return v === "noga" || v === "parent" ? v : null;
}

export function parentPin() {
  return process.env.PARENT_PIN ?? "1234";
}
