"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { CenteredPage } from "../../../../components/dashboard/primitives";
import { getMarketingSession } from "../../../../lib/marketingAuth";
import { buildRequestPortalUrl, portalForSession } from "../../../../lib/marketingDeepLinks";

export default function MarketingThreadPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = typeof params.requestId === "string" ? params.requestId : "";

  useEffect(() => {
    if (!requestId) {
      router.replace("/marketing");
      return;
    }

    const session = getMarketingSession();
    const portal = portalForSession(session);
    const url = buildRequestPortalUrl(window.location.origin, requestId, portal, {
      openChat: true,
    });
    router.replace(url);
  }, [requestId, router]);

  return (
    <CenteredPage>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Loader2 className="w-4 h-4 animate-spin" />
        Opening package thread…
      </div>
    </CenteredPage>
  );
}
