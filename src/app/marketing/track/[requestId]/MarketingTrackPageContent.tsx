"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { CenteredPage, DashButton, SurfaceCard, cx } from "../../../../components/dashboard/primitives";
import {
  MarketingShipmentTrackingMeta,
  MarketingShipmentTrackingTimeline,
} from "../../../../components/marketing/MarketingShipmentTracking";
import { useAutoRefresh } from "../../../../hooks/useAutoRefresh";
import { getMarketingSession } from "../../../../lib/marketingAuth";
import { formatBiteshipStatus } from "../../../../lib/biteshipCouriers";
import { getStoredShipmentTrackingSummary } from "../../../../lib/shipmentTracking";
import type { BiteshipTrackingDetails } from "../../../../lib/biteship";
import type { MarketingRequest, MarketingSession } from "../../../../types/marketing";

export function MarketingTrackPageContent({ requestId }: { requestId: string }) {
  const [session, setSession] = useState<MarketingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [request, setRequest] = useState<MarketingRequest | null>(null);
  const [live, setLive] = useState<BiteshipTrackingDetails | null>(null);

  useEffect(() => {
    setSession(getMarketingSession());
  }, []);

  const loadTracking = useCallback(
    async (silent = false) => {
      if (!session) {
        if (!silent) setLoading(false);
        return;
      }

      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError("");

      try {
        const response = await fetch("/api/marketing/tracking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session, requestId }),
        });
        const payload = (await response.json()) as {
          error?: string;
          request?: MarketingRequest;
          live?: BiteshipTrackingDetails | null;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load tracking");
        }

        setRequest(payload.request ?? null);
        setLive(payload.live ?? null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load tracking");
      } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [requestId, session]
  );

  useEffect(() => {
    void loadTracking();
  }, [loadTracking]);

  useAutoRefresh(() => loadTracking(true), 30000, Boolean(session && request));

  if (!session) {
    return (
      <CenteredPage className="min-h-[60vh] px-4">
        <SurfaceCard className="max-w-md w-full p-8 text-center">
          <p className="font-bold text-gray-900">Sign in to track shipments</p>
          <p className="text-sm text-gray-600 mt-2">
            Open the marketing portal and sign in with your team email and PIN.
          </p>
          <Link href="/marketing" className="inline-block mt-5">
            <DashButton variant="primary" size="md">
              Go to marketing portal
            </DashButton>
          </Link>
        </SurfaceCard>
      </CenteredPage>
    );
  }

  if (loading) {
    return (
      <CenteredPage className="min-h-[60vh]">
        <Loader2 className="animate-spin w-10 h-10 text-violet-600" />
      </CenteredPage>
    );
  }

  if (error || !request) {
    return (
      <CenteredPage className="min-h-[60vh] px-4">
        <SurfaceCard className="max-w-md w-full p-8 text-center">
          <p className="font-bold text-gray-900">Unable to load tracking</p>
          <p className="text-sm text-red-700 mt-2">{error || "Shipment not found."}</p>
          <Link href="/marketing" className="inline-block mt-5">
            <DashButton variant="subtle" size="md">
              Back to portal
            </DashButton>
          </Link>
        </SurfaceCard>
      </CenteredPage>
    );
  }

  const stored = getStoredShipmentTrackingSummary(request);
  const displayStatus =
    live?.status ?? stored?.statusRaw ?? (stored?.statusLabel ? stored.statusLabel : null);
  const displayAwb = live?.waybill_id ?? stored?.awb ?? null;
  const courierLabel =
    live?.courier_company && live?.courier_name
      ? `${live.courier_name} (${live.courier_company})`
      : stored?.courierLabel ?? request.preferred_courier;

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/marketing">
              <DashButton variant="ghost" size="sm" className="p-2 bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </DashButton>
            </Link>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Shipment tracking</p>
              <h1 className="text-lg font-black text-gray-900 truncate">{request.recipient_name}</h1>
              <p className="text-xs font-mono text-gray-600">{request.barcode}</p>
            </div>
          </div>
          <DashButton
            variant="subtle"
            size="sm"
            disabled={refreshing}
            onClick={() => loadTracking(true)}
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </DashButton>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <SurfaceCard className="p-5 space-y-4">
          <div>
            <p className="text-sm text-gray-600">Delivering to</p>
            <p className="font-semibold text-gray-900 mt-1">
              {request.address_line1}
              {request.address_line2 ? `, ${request.address_line2}` : ""}
            </p>
            <p className="text-sm text-gray-700">
              {request.city}, {request.state} {request.postal_code} · {request.country}
            </p>
          </div>

          <MarketingShipmentTrackingMeta
            awb={displayAwb}
            courierLabel={courierLabel ?? null}
            statusLabel={displayStatus ? formatBiteshipStatus(displayStatus) : stored?.statusLabel ?? null}
            externalLink={live?.link}
          />
        </SurfaceCard>

        <SurfaceCard className="p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-bold text-gray-900">Tracking history</h2>
            <span
              className={cx(
                "text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5",
                live ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
              )}
            >
              {live ? "Live from Biteship" : "Stored status"}
            </span>
          </div>
          <MarketingShipmentTrackingTimeline
            status={displayStatus}
            history={live?.history ?? []}
            fallbackStatus={stored?.statusRaw ?? stored?.statusLabel}
          />
          {(live?.driver_name || live?.driver_phone) && (
            <div className="mt-5 pt-4 border-t border-gray-100 text-sm text-gray-700">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Courier driver</p>
              <p className="font-semibold text-gray-900">{live?.driver_name ?? "—"}</p>
              {live?.driver_phone && <p>{live.driver_phone}</p>}
            </div>
          )}
        </SurfaceCard>

        <p className="text-center text-xs text-gray-500">
          Status refreshes automatically every 30 seconds while this page is open.
        </p>
      </main>
    </div>
  );
}
