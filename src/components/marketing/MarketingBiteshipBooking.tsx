"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Printer, Truck, X } from "lucide-react";
import { DashButton, cx } from "../dashboard/primitives";
import { formatBiteshipStatus } from "../../lib/biteshipCouriers";
import { biteshipLabelPagePath } from "../../lib/biteshipLabelData";
import {
  courierUsesBiteship,
  isIndonesiaShipment,
  type MarketingRequest,
  type MarketingSession,
} from "../../types/marketing";

interface BiteshipRateRow {
  courierCompany: string;
  courierType: string;
  courierName: string;
  serviceName: string;
  price: number;
  duration: string;
}

function formatIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function canBookViaBiteship(request: MarketingRequest): boolean {
  return (
    courierUsesBiteship(request.preferred_courier) &&
    isIndonesiaShipment(request.country) &&
    request.status !== "cancelled" &&
    request.status !== "pending"
  );
}

export function MarketingBiteshipBookingModal({
  request,
  session,
  onClose,
  onBooked,
}: {
  request: MarketingRequest;
  session: MarketingSession;
  onClose: () => void;
  onBooked: () => void;
}) {
  const [loadingRates, setLoadingRates] = useState(true);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [error, setError] = useState("");
  const [rates, setRates] = useState<BiteshipRateRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const loadRates = useCallback(async () => {
    setLoadingRates(true);
    setError("");
    try {
      const response = await fetch("/api/biteship/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, requestId: request.id }),
      });
      const payload = (await response.json()) as {
        error?: string;
        rates?: BiteshipRateRow[];
        alreadyBooked?: boolean;
        existingWaybill?: string | null;
        existingStatus?: string | null;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load courier rates");
      }

      if (payload.alreadyBooked) {
        setError(
          payload.existingWaybill
            ? `Already booked. AWB ${payload.existingWaybill} · ${formatBiteshipStatus(payload.existingStatus)}`
            : "This order already has a Biteship booking."
        );
        setRates([]);
        return;
      }

      setRates(payload.rates ?? []);
      if ((payload.rates ?? []).length === 0) {
        setError("No courier rates returned for this route. Check postal codes or try again later.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load rates");
      setRates([]);
    } finally {
      setLoadingRates(false);
    }
  }, [request.id, session]);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  const handleBook = async () => {
    const selected = rates.find(
      (rate) => `${rate.courierCompany}:${rate.courierType}` === selectedKey
    );
    if (!selected) {
      setError("Select a courier option first.");
      return;
    }

    setBooking(true);
    setError("");
    try {
      const response = await fetch("/api/biteship/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session,
          requestId: request.id,
          courierCompany: selected.courierCompany,
          courierType: selected.courierType,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to book shipment");
      }

      setBooked(true);
      onBooked();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setBooking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="biteship-booking-title"
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto rounded-t-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Biteship</p>
            <h2 id="biteship-booking-title" className="text-lg font-black text-gray-900">
              Book shipment
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              {request.recipient_name} · {request.barcode}
            </p>
          </div>
          <DashButton type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </DashButton>
        </div>

        <div className="px-5 py-5 space-y-4">
          {booked ? (
            <>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                <p className="font-bold text-emerald-900">Shipment booked</p>
                <p className="text-sm text-emerald-800 mt-1">
                  Print the carrier label and affix it to the package. Mark the order shipped when it
                  leaves the warehouse.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <DashButton
                  variant="success"
                  size="md"
                  className="w-full"
                  onClick={() =>
                    window.open(biteshipLabelPagePath(request.id), "_blank", "noopener,noreferrer")
                  }
                >
                  <Printer className="w-4 h-4" /> Print carrier label
                </DashButton>
                <DashButton variant="ghost" size="md" className="w-full" onClick={onClose}>
                  Done — back to queue
                </DashButton>
              </div>
            </>
          ) : (
            <>
          <p className="text-sm text-gray-600">
            Choose a courier rate. AWB will populate automatically when Biteship confirms the order.
          </p>

          {loadingRates ? (
            <div className="flex items-center justify-center py-10 text-gray-600">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading rates…
            </div>
          ) : rates.length > 0 ? (
            <div className="space-y-2">
              {rates.map((rate) => {
                const key = `${rate.courierCompany}:${rate.courierType}`;
                const selected = selectedKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    className={cx(
                      "w-full text-left rounded-xl border px-4 py-3 transition",
                      selected
                        ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900">
                          {rate.courierName} · {rate.serviceName}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {rate.courierCompany}/{rate.courierType}
                          {rate.duration ? ` · ${rate.duration}` : ""}
                        </p>
                      </div>
                      <p className="font-black text-emerald-800 shrink-0">{formatIdr(rate.price)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <DashButton
              variant="success"
              size="md"
              className="w-full"
              disabled={booking || loadingRates || !selectedKey || rates.length === 0}
              onClick={handleBook}
            >
              {booking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Truck className="w-4 h-4" />
              )}
              Confirm booking
            </DashButton>
            <DashButton variant="ghost" size="md" className="w-full" onClick={onClose}>
              Cancel
            </DashButton>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function BiteshipStatusBadge({ request }: { request: MarketingRequest }) {
  if (!request.biteship_order_id && !request.biteship_status) return null;

  return (
    <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
      Biteship · {formatBiteshipStatus(request.biteship_status ?? "booked")}
    </span>
  );
}
