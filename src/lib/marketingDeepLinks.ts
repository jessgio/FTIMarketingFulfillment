import type { MarketingSession } from "../types/marketing";
import { canAccessFulfillPortal, canAccessRequestPortal } from "./marketingRoles";

export const REQUEST_DEEP_LINK_PARAM = "request";
export const CHAT_DEEP_LINK_PARAM = "chat";

export function portalForSession(session: MarketingSession | null): "marketing" | "fulfill" {
  if (!session) return "fulfill";
  if (canAccessFulfillPortal(session) && !canAccessRequestPortal(session)) {
    return "fulfill";
  }
  if (canAccessFulfillPortal(session)) {
    return "fulfill";
  }
  return "marketing";
}

export function buildRequestPortalUrl(
  origin: string,
  requestId: string,
  portal: "marketing" | "fulfill",
  options?: { openChat?: boolean }
): string {
  const base = origin.replace(/\/$/, "");
  const path = portal === "fulfill" ? "/marketing/fulfill" : "/marketing";
  const params = new URLSearchParams({ [REQUEST_DEEP_LINK_PARAM]: requestId });
  if (options?.openChat) {
    params.set(CHAT_DEEP_LINK_PARAM, "1");
  }
  return `${base}${path}?${params.toString()}`;
}

export function buildMarketingThreadUrl(origin: string, requestId: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/marketing/thread/${encodeURIComponent(requestId)}`;
}

export function readRequestDeepLinkFromSearch(search: string): {
  requestId: string | null;
  openChat: boolean;
} {
  const params = new URLSearchParams(search);
  return {
    requestId: params.get(REQUEST_DEEP_LINK_PARAM),
    openChat: params.get(CHAT_DEEP_LINK_PARAM) === "1",
  };
}

export function stripRequestDeepLinkFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(REQUEST_DEEP_LINK_PARAM);
  params.delete(CHAT_DEEP_LINK_PARAM);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
