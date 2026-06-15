import { NextResponse } from "next/server";
import { fetchBiteshipTrackingDetails, isBiteshipConfigured } from "../../../../lib/biteship";
import { verifyPortalSession } from "../../../../lib/marketingTrackingAuth";
import { canViewMarketingRequest } from "../../../../lib/marketingRoles";
import {
  getStoredShipmentTrackingSummary,
  hasLiveTrackingData,
  isTrackableShipment,
} from "../../../../lib/shipmentTracking";
import { supabase } from "../../../../lib/supabaseClient";
import type { MarketingRequest, MarketingSession } from "../../../../types/marketing";

export async function POST(request: Request) {
  try {
    const { session, requestId } = (await request.json()) as {
      session?: MarketingSession;
      requestId?: string;
    };

    const verified = await verifyPortalSession(session);
    if (!verified) {
      return NextResponse.json({ error: "Sign in to view tracking." }, { status: 403 });
    }

    if (!requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("marketing_requests")
      .select("*, marketing_request_items(*)")
      .eq("id", requestId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const marketingRequest = {
      ...data,
      items: data.marketing_request_items ?? [],
    } as MarketingRequest;

    if (!canViewMarketingRequest(verified, marketingRequest)) {
      return NextResponse.json({ error: "You do not have access to this shipment." }, { status: 403 });
    }

    const stored = getStoredShipmentTrackingSummary(marketingRequest);
    let live = null;

    if (isBiteshipConfigured() && hasLiveTrackingData(marketingRequest)) {
      try {
        live = await fetchBiteshipTrackingDetails({
          biteshipOrderId: marketingRequest.biteship_order_id,
          waybillId: marketingRequest.actual_shipping_label,
          courierCompany: marketingRequest.biteship_courier_company,
        });
      } catch (err: unknown) {
        console.warn("marketing tracking live fetch failed:", err);
      }
    }

    return NextResponse.json({
      success: true,
      trackable: isTrackableShipment(marketingRequest),
      request: marketingRequest,
      stored,
      live,
    });
  } catch (err: unknown) {
    console.error("marketing tracking error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load tracking" },
      { status: 500 }
    );
  }
}
