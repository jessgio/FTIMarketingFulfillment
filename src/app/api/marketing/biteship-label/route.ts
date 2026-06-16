import { NextResponse } from "next/server";
import {
  BiteshipApiError,
  fetchBiteshipOrderLabelFields,
  isBiteshipConfigured,
} from "../../../../lib/biteship";
import { verifyFulfillmentSession } from "../../../../lib/biteshipApiAuth";
import {
  buildBiteshipLabelData,
  canPrintBiteshipLabel,
} from "../../../../lib/biteshipLabelData";
import { verifyPortalSession } from "../../../../lib/marketingTrackingAuth";
import { canViewMarketingRequest } from "../../../../lib/marketingRoles";
import { supabase } from "../../../../lib/supabaseClient";
import type { MarketingRequest, MarketingSession } from "../../../../types/marketing";

async function verifyLabelSession(
  session: MarketingSession | undefined | null
): Promise<MarketingSession | null> {
  const fulfillment = await verifyFulfillmentSession(session);
  if (fulfillment) return fulfillment;
  return verifyPortalSession(session);
}

export async function POST(request: Request) {
  try {
    const { session, requestId, refreshFromBiteship } = (await request.json()) as {
      session?: MarketingSession;
      requestId?: string;
      refreshFromBiteship?: boolean;
    };

    const verified = await verifyLabelSession(session);
    if (!verified) {
      return NextResponse.json({ error: "Sign in to print carrier labels." }, { status: 403 });
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
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    let marketingRequest = {
      ...data,
      items: data.marketing_request_items ?? [],
    } as MarketingRequest;

    if (!canViewMarketingRequest(verified, marketingRequest)) {
      return NextResponse.json({ error: "You do not have access to this shipment." }, { status: 403 });
    }

    if (!canPrintBiteshipLabel(marketingRequest)) {
      return NextResponse.json(
        { error: "This order does not have a Biteship booking with a printable waybill yet." },
        { status: 400 }
      );
    }

    let liveFields: Awaited<ReturnType<typeof fetchBiteshipOrderLabelFields>> | null = null;
    if (
      refreshFromBiteship !== false &&
      isBiteshipConfigured() &&
      marketingRequest.biteship_order_id
    ) {
      try {
        liveFields = await fetchBiteshipOrderLabelFields(marketingRequest.biteship_order_id);

        const updates: Record<string, string> = {};
        if (liveFields.waybillId && liveFields.waybillId !== marketingRequest.actual_shipping_label) {
          updates.actual_shipping_label = liveFields.waybillId;
        }
        if (
          liveFields.routingCode &&
          liveFields.routingCode !== marketingRequest.biteship_routing_code
        ) {
          updates.biteship_routing_code = liveFields.routingCode;
        }
        if (liveFields.status && liveFields.status !== marketingRequest.biteship_status) {
          updates.biteship_status = liveFields.status;
          updates.biteship_status_updated_at = new Date().toISOString();
        }

        if (Object.keys(updates).length > 0) {
          const { data: refreshed } = await supabase
            .from("marketing_requests")
            .update(updates)
            .eq("id", requestId)
            .select("*, marketing_request_items(*)")
            .maybeSingle();

          if (refreshed) {
            marketingRequest = {
              ...refreshed,
              items: refreshed.marketing_request_items ?? [],
            } as MarketingRequest;
          }
        }
      } catch (err: unknown) {
        if (!(err instanceof BiteshipApiError)) {
          console.warn("biteship label refresh failed:", err);
        }
      }
    }

    const label = buildBiteshipLabelData(marketingRequest, {
      waybillId: liveFields?.waybillId ?? marketingRequest.actual_shipping_label,
      routingCode: liveFields?.routingCode ?? marketingRequest.biteship_routing_code,
      courierCompany: liveFields?.courierCompany ?? marketingRequest.biteship_courier_company,
      courierType: liveFields?.courierType ?? marketingRequest.biteship_courier_type,
    });

    if (!label) {
      return NextResponse.json(
        { error: "Unable to build carrier label. AWB may still be pending from Biteship." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      label,
      request: marketingRequest,
    });
  } catch (err: unknown) {
    console.error("marketing biteship label error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load carrier label" },
      { status: 500 }
    );
  }
}
