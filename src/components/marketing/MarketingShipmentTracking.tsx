"use client";

import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";
import { cx } from "../dashboard/primitives";
import { formatBiteshipStatus } from "../../lib/biteshipCouriers";
import {
  getStoredShipmentTrackingSummary,
  isTrackableShipment,
  marketingTrackingPagePath,
  trackingStatusTone,
  trackingStatusToneClasses,
} from "../../lib/shipmentTracking";
import type { MarketingRequest } from "../../types/marketing";

function formatTrackingWhen(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MarketingShipmentTrackingSummary({
  request,
  compact = false,
  showLink = true,
}: {
  request: MarketingRequest;
  compact?: boolean;
  showLink?: boolean;
}) {
  const summary = getStoredShipmentTrackingSummary(request);
  if (!summary?.statusLabel && !summary?.awb) {
    if (!isTrackableShipment(request)) {
      return compact ? null : <span className="text-xs text-gray-400">Not shipped yet</span>;
    }
    return compact ? null : <span className="text-xs text-gray-400">No tracking yet</span>;
  }

  const tone = trackingStatusTone(summary.statusRaw ?? summary.statusLabel);
  const toneClass = trackingStatusToneClasses[tone];

  return (
    <div className={cx("space-y-1", compact && "min-w-[140px]")}>
      {summary.statusLabel && (
        <span
          className={cx(
            "inline-flex items-center text-[10px] font-bold uppercase tracking-wide rounded-full border px-2 py-0.5",
            toneClass
          )}
        >
          {summary.statusLabel}
        </span>
      )}
      {summary.awb && (
        <p className={cx("font-mono text-gray-800", compact ? "text-[10px]" : "text-xs")}>
          AWB {summary.awb}
        </p>
      )}
      {summary.updatedAt && (
        <p className="text-[10px] text-gray-500">Updated {formatTrackingWhen(summary.updatedAt)}</p>
      )}
      {showLink && isTrackableShipment(request) && (
        <Link
          href={marketingTrackingPagePath(request.id)}
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-violet-700 hover:text-violet-900"
          onClick={(e) => e.stopPropagation()}
        >
          Track shipment
          <ExternalLink className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

export function MarketingShipmentTrackingTimeline({
  status,
  history,
  fallbackStatus,
}: {
  status: string | null;
  history: { status: string; note: string; updated_at: string }[];
  fallbackStatus?: string | null;
}) {
  const events =
    history.length > 0
      ? history
      : fallbackStatus
        ? [
            {
              status: fallbackStatus,
              note: "Latest status from warehouse records.",
              updated_at: new Date().toISOString(),
            },
          ]
        : [];

  if (events.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Tracking history is not available yet. Check back after the courier scans the package.
      </p>
    );
  }

  return (
    <ol className="space-y-0">
      {events.map((event, index) => {
        const tone = trackingStatusTone(event.status);
        const isLatest = index === 0;
        return (
          <li key={`${event.updated_at}-${index}`} className="relative pl-6 pb-5 last:pb-0">
            {index < events.length - 1 && (
              <span
                className="absolute left-[7px] top-2 bottom-0 w-px bg-gray-200"
                aria-hidden="true"
              />
            )}
            <span
              className={cx(
                "absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-white",
                isLatest ? "border-violet-500" : "border-gray-300"
              )}
              aria-hidden="true"
            />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cx(
                    "text-[10px] font-bold uppercase tracking-wide rounded-full border px-2 py-0.5",
                    trackingStatusToneClasses[tone]
                  )}
                >
                  {formatBiteshipStatus(event.status)}
                </span>
                <span className="text-[10px] text-gray-500">{formatTrackingWhen(event.updated_at)}</span>
              </div>
              <p className="text-sm text-gray-800">{event.note}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function MarketingShipmentTrackingMeta({
  awb,
  courierLabel,
  statusLabel,
  externalLink,
}: {
  awb: string | null;
  courierLabel: string | null;
  statusLabel: string | null;
  externalLink?: string | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Latest status</p>
        <p className="text-lg font-black text-gray-900 mt-1 capitalize">{statusLabel ?? "—"}</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">AWB</p>
        <p className="text-lg font-mono font-bold text-gray-900 mt-1">{awb ?? "—"}</p>
      </div>
      {courierLabel && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 sm:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Courier</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{courierLabel}</p>
        </div>
      )}
      {externalLink && (
        <a
          href={externalLink}
          target="_blank"
          rel="noopener noreferrer"
          className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-800 hover:bg-violet-100 transition"
        >
          <MapPin className="w-4 h-4" />
          Open courier tracking
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}
