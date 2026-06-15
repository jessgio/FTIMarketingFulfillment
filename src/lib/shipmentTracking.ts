import type { MarketingRequest } from "../types/marketing";
import { formatBiteshipStatus } from "./biteshipCouriers";

export interface StoredShipmentTrackingSummary {
  awb: string | null;
  statusLabel: string | null;
  statusRaw: string | null;
  courierLabel: string | null;
  updatedAt: string | null;
}

export function isTrackableShipment(request: MarketingRequest): boolean {
  return Boolean(
    request.actual_shipping_label?.trim() ||
      request.biteship_order_id ||
      request.biteship_status ||
      request.status === "shipped"
  );
}

export function hasLiveTrackingData(request: MarketingRequest): boolean {
  return Boolean(
    request.biteship_order_id ||
      (request.actual_shipping_label?.trim() && request.biteship_courier_company)
  );
}

export function getStoredShipmentTrackingSummary(
  request: MarketingRequest
): StoredShipmentTrackingSummary | null {
  if (!isTrackableShipment(request)) return null;

  const awb = request.actual_shipping_label?.trim() || null;
  const statusRaw = request.biteship_status?.trim() || null;
  const statusLabel = statusRaw
    ? formatBiteshipStatus(statusRaw)
    : awb
      ? "AWB recorded"
      : request.status === "shipped"
        ? "Shipped"
        : null;

  const courierLabel = request.biteship_courier_company
    ? `${request.biteship_courier_company}${request.biteship_courier_type ? ` · ${request.biteship_courier_type}` : ""}`
    : request.preferred_courier;

  const updatedAt =
    request.biteship_status_updated_at ??
    request.actual_shipping_label_at ??
    request.shipped_at ??
    request.packed_at;

  return {
    awb,
    statusLabel,
    statusRaw,
    courierLabel: courierLabel ?? null,
    updatedAt,
  };
}

export function marketingTrackingPagePath(requestId: string): string {
  return `/marketing/track/${requestId}`;
}

export function trackingStatusTone(
  status: string | null | undefined
): "delivered" | "transit" | "pending" | "issue" | "neutral" {
  const normalized = status?.trim().toLowerCase() ?? "";
  if (!normalized) return "neutral";
  if (normalized === "delivered") return "delivered";
  if (
    normalized.includes("cancel") ||
    normalized.includes("reject") ||
    normalized.includes("return") ||
    normalized.includes("dispose") ||
    normalized.includes("hold")
  ) {
    return "issue";
  }
  if (
    normalized.includes("transit") ||
    normalized.includes("pick") ||
    normalized.includes("drop") ||
    normalized.includes("deliver") ||
    normalized === "confirmed" ||
    normalized === "allocated" ||
    normalized === "scheduled" ||
    normalized === "picked"
  ) {
    return "transit";
  }
  if (normalized === "shipped" || normalized.includes("awb")) return "transit";
  return "pending";
}

export const trackingStatusToneClasses = {
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  transit: "bg-sky-100 text-sky-800 border-sky-200",
  pending: "bg-amber-100 text-amber-900 border-amber-200",
  issue: "bg-red-100 text-red-800 border-red-200",
  neutral: "bg-gray-100 text-gray-700 border-gray-200",
} as const;
