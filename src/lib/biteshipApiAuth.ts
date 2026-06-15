import { NextResponse } from "next/server";
import { supabase } from "./supabaseClient";
import type { MarketingSession } from "../types/marketing";
import { canFulfill, normalizeUserRole } from "./marketingRoles";
import { normalizeRequesterDivision } from "./marketingAuth";

export async function verifyFulfillmentSession(
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

  return canFulfill(verified) ? verified : null;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Fulfillment access required." }, { status: 403 });
}

export function biteshipNotConfiguredResponse() {
  return NextResponse.json({ error: "Biteship is not configured on this server." }, { status: 503 });
}
