import { NextResponse } from "next/server";
import { supabase } from "./supabaseClient";
import type { MarketingSession } from "../types/marketing";
import { canAccessRequestPortal, canFulfill, normalizeUserRole } from "./marketingRoles";
import { normalizeRequesterDivision } from "./marketingAuth";

export async function verifyPortalSession(
  session: MarketingSession | undefined | null
): Promise<MarketingSession | null> {
  if (!session?.email?.trim()) return null;

  const { data, error } = await supabase
    .from("marketing_users")
    .select("email, display_name, role, division, active")
    .eq("email", session.email.trim().toLowerCase())
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return null;

  const verified: MarketingSession = {
    email: data.email,
    displayName: data.display_name,
    role: normalizeUserRole(data.role),
    division: normalizeRequesterDivision(data.division),
  };

  return canAccessRequestPortal(verified) || canFulfill(verified) ? verified : null;
}

export function portalUnauthorizedResponse() {
  return NextResponse.json({ error: "Sign in to the marketing portal." }, { status: 403 });
}
