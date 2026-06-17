"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { CenteredPage, DashButton, SurfaceCard } from "../../../../../components/dashboard/primitives";
import { ChatLoginBar } from "../../../../../components/marketing/ChatLoginBar";
import { MarketingBiteshipShippingLabel } from "../../../../../components/marketing/MarketingBiteshipShippingLabel";
import { getMarketingSession } from "../../../../../lib/marketingAuth";
import type { BiteshipLabelData } from "../../../../../lib/biteshipLabelData";
import type { MarketingSession } from "../../../../../types/marketing";

interface LoadedLabel {
  id: string;
  label: BiteshipLabelData;
}

function BatchBiteshipLabelsContent() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids") ?? "";
  const ids = idsParam.split(",").map((id) => id.trim()).filter(Boolean);

  const [session, setSession] = useState<MarketingSession | null>(() => getMarketingSession());
  const [labels, setLabels] = useState<LoadedLabel[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [loading, setLoading] = useState(() => {
    const stored = getMarketingSession();
    return ids.length > 0 && Boolean(stored);
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (ids.length === 0) {
      setError("No orders selected.");
      setLoading(false);
      return;
    }

    if (!session) {
      setLoading(false);
      setError("");
      setLabels([]);
      setSkipped([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    Promise.allSettled(
      ids.map(async (requestId) => {
        const response = await fetch("/api/marketing/biteship-label", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session, requestId, refreshFromBiteship: true }),
        });
        const payload = (await response.json()) as {
          error?: string;
          label?: BiteshipLabelData;
        };
        if (!response.ok || !payload.label) {
          throw new Error(payload.error || `Failed to load label for ${requestId}`);
        }
        return { id: requestId, label: payload.label };
      })
    )
      .then((results) => {
        if (cancelled) return;
        const loaded = results
          .filter((result): result is PromiseFulfilledResult<LoadedLabel> => result.status === "fulfilled")
          .map((result) => result.value);
        setLabels(loaded);
        if (loaded.length < ids.length) {
          const loadedIds = new Set(loaded.map((row) => row.id));
          setSkipped(ids.filter((id) => !loadedIds.has(id)));
        }
        if (loaded.length === 0) {
          const firstError = results.find(
            (result): result is PromiseRejectedResult => result.status === "rejected"
          );
          setError(
            firstError?.reason instanceof Error
              ? firstError.reason.message
              : "No carrier labels could be loaded."
          );
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load carrier labels");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [idsParam, session]);

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
        <p className="text-gray-600 text-sm font-medium">
          Preparing {ids.length} carrier label{ids.length === 1 ? "" : "s"}…
        </p>
      </CenteredPage>
    );
  }

  if (error || labels.length === 0) {
    return (
      <CenteredPage>
        <SurfaceCard className="p-8 text-center max-w-md">
          <p className="text-red-600 font-medium mb-4">{error || "No carrier labels to print"}</p>
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
            <h1 className="text-lg font-bold">Batch carrier labels</h1>
            <p className="text-sm text-gray-600">
              {labels.length} label{labels.length === 1 ? "" : "s"} ready
              {skipped.length > 0 ? ` · ${skipped.length} skipped (no AWB yet)` : ""}
            </p>
          </div>
        </div>
        <DashButton onClick={() => window.print()} variant="primary" size="md">
          <Printer className="w-4 h-4" /> Print all
        </DashButton>
      </div>

      <p className="print:hidden text-sm text-gray-600 text-center my-6 px-4">
        Preview below. Use <strong>Print all</strong> for thermal labels — one page per carrier label.
      </p>

      <div className="p-8 flex flex-wrap gap-8 justify-center print:p-0 print:gap-0">
        {labels.map(({ id, label }) => (
          <MarketingBiteshipShippingLabel key={id} label={label} />
        ))}
      </div>
    </div>
  );
}

export default function MarketingBatchBiteshipLabelsPage() {
  return (
    <Suspense
      fallback={
        <CenteredPage>
          <Loader2 className="animate-spin w-10 h-10 text-emerald-600" />
        </CenteredPage>
      }
    >
      <BatchBiteshipLabelsContent />
    </Suspense>
  );
}
