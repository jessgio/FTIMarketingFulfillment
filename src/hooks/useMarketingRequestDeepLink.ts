"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import {
  clearPendingDeepLink,
  clearRequestDeepLinkFromBrowserUrl,
  readRequestDeepLinkIntent,
  type RequestDeepLinkIntent,
} from "../lib/marketingDeepLinks";

export function useMarketingRequestDeepLink(
  onOpenRequest: (intent: RequestDeepLinkIntent) => void | Promise<void>
) {
  const openedRef = useRef(false);

  useLayoutEffect(() => {
    if (openedRef.current) return;

    const intent = readRequestDeepLinkIntent();
    if (!intent) return;

    openedRef.current = true;
    void Promise.resolve(onOpenRequest(intent));
  }, [onOpenRequest]);
}

export function useClearRequestDeepLinkWhenOpen(requestId: string | null, isOpen: boolean) {
  const clearedRef = useRef(false);

  useEffect(() => {
    if (!requestId || !isOpen || clearedRef.current) return;
    clearedRef.current = true;
    clearPendingDeepLink();
    clearRequestDeepLinkFromBrowserUrl();
  }, [requestId, isOpen]);
}
