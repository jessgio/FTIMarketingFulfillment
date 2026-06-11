import type { MarketingRequest, MarketingSession, MarketingUserRole } from "../types/marketing";

/** Legacy DB value — treated as requester in app code. */
const LEGACY_REQUESTER_ROLE = "marketing";

export function normalizeUserRole(role: string | null | undefined): MarketingUserRole {
  if (role === "admin" || role === "fulfillment" || role === "requester") {
    return role;
  }
  if (role === LEGACY_REQUESTER_ROLE) return "requester";
  return "requester";
}

export function canAccessRequestPortal(session: MarketingSession): boolean {
  return session.role === "requester" || session.role === "admin";
}

export function canAccessFulfillPortal(session: MarketingSession): boolean {
  return session.role === "fulfillment" || session.role === "admin";
}

export function canFulfill(session: MarketingSession): boolean {
  return canAccessFulfillPortal(session);
}

export function isAdmin(session: MarketingSession): boolean {
  return session.role === "admin";
}

export function canDeleteMarketingRequest(
  session: MarketingSession,
  req: MarketingRequest
): boolean {
  if (req.status === "cancelled") return false;
  if (isAdmin(session)) return true;
  return (
    req.requested_by_email.trim().toLowerCase() === session.email.trim().toLowerCase() &&
    req.status === "pending"
  );
}

export function roleLabel(role: MarketingUserRole): string {
  if (role === "admin") return "Admin";
  if (role === "fulfillment") return "Fulfillment";
  return "Requester";
}
