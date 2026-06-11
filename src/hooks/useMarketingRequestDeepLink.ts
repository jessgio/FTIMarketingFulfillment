"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  readRequestDeepLinkFromSearch,
  stripRequestDeepLinkFromSearch,
  takePendingDeepLink,
} from "../lib/marketingDeepLinks";

export function useMarketingRequestDeepLink(
  onOpenRequest: (requestId: string, openChat: boolean) => void,
  enabled = true
) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const processedRef = useRef<string | null>(null);
  const search = searchParams.toString();

  useEffect(() => {
    if (!enabled) return;

    const fromUrl = readRequestDeepLinkFromSearch(search ? `?${search}` : "");
    const fromStorage = takePendingDeepLink();
    const requestId = fromUrl.requestId ?? fromStorage?.requestId ?? null;
    const openChat = fromUrl.requestId ? fromUrl.openChat : Boolean(fromStorage?.openChat);

    if (!requestId || processedRef.current === requestId) return;
    processedRef.current = requestId;

    onOpenRequest(requestId, openChat);

    if (fromUrl.requestId) {
      const nextSearch = stripRequestDeepLinkFromSearch(search ? `?${search}` : "");
      router.replace(`${pathname}${nextSearch}`, { scroll: false });
    }
  }, [enabled, onOpenRequest, pathname, router, search]);
}
