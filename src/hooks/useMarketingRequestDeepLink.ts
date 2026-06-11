"use client";

import { useEffect, useRef } from "react";
import {
  readRequestDeepLinkFromSearch,
  stripRequestDeepLinkFromSearch,
} from "../lib/marketingDeepLinks";

export function useMarketingRequestDeepLink(
  onOpenRequest: (requestId: string, openChat: boolean) => void,
  enabled = true
) {
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const { requestId, openChat } = readRequestDeepLinkFromSearch(window.location.search);
    if (!requestId) return;

    const key = `${requestId}:${openChat ? "1" : "0"}`;
    if (handledRef.current === key) return;
    handledRef.current = key;

    onOpenRequest(requestId, openChat);

    const nextSearch = stripRequestDeepLinkFromSearch(window.location.search);
    const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [enabled, onOpenRequest]);
}
