import type { MarketingSession } from "../types/marketing";
import { canAccessFulfillPortal, canAccessRequestPortal } from "./marketingRoles";

export const REQUEST_DEEP_LINK_PARAM = "request";
export const CHAT_DEEP_LINK_PARAM = "chat";
export const PENDING_DEEP_LINK_KEY = "marketing:pendingDeepLink";

export type RequestDeepLinkIntent = {
  requestId: string;
  openChat: boolean;
};

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

export function buildRequestPortalPath(
  requestId: string,
  portal: "marketing" | "fulfill",
  options?: { openChat?: boolean }
): string {
  const path = portal === "fulfill" ? "/marketing/fulfill" : "/marketing";
  const params = new URLSearchParams({ [REQUEST_DEEP_LINK_PARAM]: requestId });
  if (options?.openChat) {
    params.set(CHAT_DEEP_LINK_PARAM, "1");
  }
  return `${path}?${params.toString()}`;
}

export function buildRequestPortalUrl(
  origin: string,
  requestId: string,
  portal: "marketing" | "fulfill",
  options?: { openChat?: boolean }
): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${buildRequestPortalPath(requestId, portal, options)}`;
}

export function buildMarketingThreadUrl(origin: string, requestId: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/marketing/thread/${encodeURIComponent(requestId)}`;
}

export function stashPendingDeepLink(requestId: string, openChat: boolean) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    PENDING_DEEP_LINK_KEY,
    JSON.stringify({ requestId, openChat })
  );
}

export function peekPendingDeepLink(): RequestDeepLinkIntent | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PENDING_DEEP_LINK_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { requestId?: string; openChat?: boolean };
    if (typeof parsed.requestId === "string" && parsed.requestId.trim()) {
      return {
        requestId: parsed.requestId.trim(),
        openChat: Boolean(parsed.openChat),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function clearPendingDeepLink() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_DEEP_LINK_KEY);
}

export function readRequestDeepLinkIntent(): RequestDeepLinkIntent | null {
  if (typeof window === "undefined") return null;

  const fromUrl = readRequestDeepLinkFromSearch(window.location.search);
  if (fromUrl.requestId) {
    return {
      requestId: fromUrl.requestId,
      openChat: fromUrl.openChat,
    };
  }

  return peekPendingDeepLink();
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

export function clearRequestDeepLinkFromBrowserUrl() {
  if (typeof window === "undefined") return;
  const nextSearch = stripRequestDeepLinkFromSearch(window.location.search);
  const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
}
