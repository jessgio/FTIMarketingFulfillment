import { NextResponse } from "next/server";
import {
  BiteshipApiError,
  fetchBiteshipRates,
  isBiteshipConfigured,
} from "../../../../lib/biteship";
import {
  biteshipNotConfiguredResponse,
  unauthorizedResponse,
  verifyFulfillmentSession,
} from "../../../../lib/biteshipApiAuth";
import { filterRatesForPreferredCourier } from "../../../../lib/biteshipCouriers";
import { supabase } from "../../../../lib/supabaseClient";
import type { MarketingRequest, MarketingSession } from "../../../../types/marketing";
import { courierUsesBiteship, isIndonesiaShipment } from "../../../../types/marketing";

export async function POST(request: Request) {
  if (!isBiteshipConfigured()) {
    return biteshipNotConfiguredResponse();
  }

  try {
    const { session, requestId } = (await request.json()) as {
      session?: MarketingSession;
      requestId?: string;
    };

    const verified = await verifyFulfillmentSession(session);
    if (!verified) return unauthorizedResponse();

    if (!requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("marketing_requests")
      .select("*, marketing_request_items(*)")
      .eq("id", requestId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const marketingRequest = {
      ...data,
      items: data.marketing_request_items ?? [],
    } as MarketingRequest;

    if (marketingRequest.status === "cancelled") {
      return NextResponse.json({ error: "Cancelled requests cannot be booked." }, { status: 400 });
    }

    if (!courierUsesBiteship(marketingRequest.preferred_courier)) {
      return NextResponse.json(
        { error: "This courier is not eligible for Biteship booking." },
        { status: 400 }
      );
    }

    if (!isIndonesiaShipment(marketingRequest.country)) {
      return NextResponse.json(
        { error: "Biteship booking is only available for Indonesia shipments." },
        { status: 400 }
      );
    }

    const rates = await fetchBiteshipRates(marketingRequest);
    const filtered = filterRatesForPreferredCourier(
      rates,
      marketingRequest.preferred_courier ?? "Regular"
    ).sort((a, b) => a.price - b.price);

    return NextResponse.json({
      success: true,
      rates: filtered.map((rate) => ({
        courierCompany: rate.courier_company,
        courierType: rate.courier_type,
        courierName: rate.courier_name,
        serviceName: rate.courier_service_name,
        price: rate.price,
        duration: rate.duration,
        serviceType: rate.service_type,
        shippingType: rate.shipping_type,
      })),
      alreadyBooked: Boolean(marketingRequest.biteship_order_id),
      existingOrderId: marketingRequest.biteship_order_id,
      existingWaybill: marketingRequest.actual_shipping_label,
      existingStatus: marketingRequest.biteship_status,
    });
  } catch (err: unknown) {
    console.error("biteship rates error:", err);
    if (err instanceof BiteshipApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode ?? 502 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch Biteship rates" },
      { status: 500 }
    );
  }
}
