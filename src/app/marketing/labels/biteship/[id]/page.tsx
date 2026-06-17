"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { CenteredPage, DashButton, SurfaceCard } from "../../../../../components/dashboard/primitives";
import { ChatLoginBar } from "../../../../../components/marketing/ChatLoginBar";
import { MarketingBiteshipShippingLabel } from "../../../../../components/marketing/MarketingBiteshipShippingLabel";
import { getMarketingSession } from "../../../../../lib/marketingAuth";
import type { BiteshipLabelData } from "../../../../../lib/biteshipLabelData";
import type { MarketingSession } from "../../../../../types/marketing";

export default function MarketingBiteshipLabelPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const [session, setSession] = useState<MarketingSession | null>(() => getMarketingSession());
  const [label, setLabel] = useState<BiteshipLabelData | null>(null);
  const [referenceBarcode, setReferenceBarcode] = useState("");
  const [loading, setLoading] = useState(Boolean(getMarketingSession()));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) {
      setLoading(false);
      setError("");
      setLabel(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    fetch("/api/marketing/biteship-label", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session, requestId: id, refreshFromBiteship: true }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          error?: string;
          label?: BiteshipLabelData;
        };
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load carrier label");
        }
        if (!payload.label) {
          throw new Error("Carrier label data is unavailable.");
        }
        return payload.label;
      })
      .then((data) => {
        if (cancelled) return;
        setLabel(data);
        setReferenceBarcode(data.referenceBarcode);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load carrier label");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, session]);

  if (!session) {
    return (
      <CenteredPage>
        <SurfaceCard className="p-8 max-w-lg w-full">
          <h1 className="text-lg font-bold text-gray-900 mb-2">Carrier label sign-in</h1>
          <p className="text-sm text-gray-600 mb-4">
            Packer initials are not the same as account sign-in. Use your fulfillment email and PIN
            to print carrier labels.
          </p>
          <ChatLoginBar session={session} onSessionChange={setSession} />
          <Link href="/marketing/fulfill" className="inline-block mt-4">
            <DashButton variant="ghost" size="md">Back to queue</DashButton>
          </Link>
        </SurfaceCard>
      </CenteredPage>
    );
  }

  if (loading) {
    return (
      <CenteredPage>
        <Loader2 className="animate-spin w-10 h-10 text-emerald-600 mb-3" />
        <p className="text-gray-600 text-sm font-medium">Preparing carrier label…</p>
      </CenteredPage>
    );
  }

  if (error || !label) {
    return (
      <CenteredPage>
        <SurfaceCard className="p-8 text-center max-w-md">
          <p className="text-red-600 font-medium mb-4">{error || "Carrier label unavailable"}</p>
          <Link href="/marketing/fulfill">
            <DashButton variant="primary" size="md">Back to queue</DashButton>
          </Link>
        </SurfaceCard>
      </CenteredPage>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-24 text-black">
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/marketing/fulfill">
            <DashButton variant="ghost" size="sm" className="p-2 bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </DashButton>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Carrier label · {referenceBarcode}</h1>
            <p className="text-xs text-gray-600">{label.serviceLabel} · {label.waybillId}</p>
          </div>
        </div>
        <DashButton onClick={() => window.print()} variant="primary" size="md">
          <Printer className="w-4 h-4" /> Print label
        </DashButton>
      </div>

      <div className="p-8 flex justify-center print:p-0">
        <MarketingBiteshipShippingLabel label={label} />
      </div>
    </div>
  );
}
