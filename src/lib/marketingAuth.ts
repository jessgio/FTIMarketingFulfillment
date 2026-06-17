import type { MarketingSession, RequesterDivision } from "../types/marketing";
import { normalizeUserRole } from "./marketingRoles";

const SESSION_KEY = "fti_marketing_session";

export function normalizeRequesterDivision(value: string | null | undefined): RequesterDivision {
  const trimmed = value?.trim();
  if (trimmed === "Marketing" || trimmed === "R&D" || trimmed === "Leadership" || trimmed === "Operations") {
    return trimmed;
  }
  return "Other";
}

export function getMarketingSession(): MarketingSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readStoredSessionRaw();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MarketingSession;
    if (!parsed.email || !parsed.displayName) return null;
    const session = {
      email: parsed.email,
      displayName: parsed.displayName,
      role: normalizeUserRole(parsed.role),
      division: normalizeRequesterDivision(parsed.division),
    };
    persistSessionRaw(raw);
    return session;
  } catch {
    return null;
  }
}

function readStoredSessionRaw(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
}

function persistSessionRaw(raw: string): void {
  localStorage.setItem(SESSION_KEY, raw);
  sessionStorage.setItem(SESSION_KEY, raw);
}

export function setMarketingSession(session: MarketingSession): void {
  persistSessionRaw(JSON.stringify(session));
}

export function clearMarketingSession(): void {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}
