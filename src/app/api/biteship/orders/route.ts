import { NextResponse } from "next/server";
import {
  BiteshipApiError,
  createBiteshipOrder,
  isBiteshipConfigured,
} from "../../../../lib/biteship";
import {
  biteshipNotConfiguredResponse,
  unauthorizedResponse,
  verifyFulfillmentSession,
} from "../../../../lib/biteshipApiAuth";
import { parsePackageSpecInput } from "../../../../lib/biteshipPackageSpec";
import { supabase } from "../../../../lib/supabaseClient";
import type { MarketingRequest, MarketingSession } from "../../../../types/marketing";
import { courierUsesBiteship, isIndonesiaShipment } from "../../../../types/marketing";

export async function POST(request: Request) {
  if (!isBiteshipConfigured()) {
    return biteshipNotConfiguredResponse();
  }

  try {
    const { session, requestId, courierCompany, courierType, packageSpec: packageSpecInput } =
      (await request.json()) as {
      session?: MarketingSession;
      requestId?: string;
      courierCompany?: string;
      courierType?: string;
      packageSpec?: unknown;
    };

    const verified = await verifyFulfillmentSession(session);
    if (!verified) return unauthorizedResponse();

    if (!requestId || !courierCompany?.trim() || !courierType?.trim()) {
      return NextResponse.json(
        { error: "requestId, courierCompany, and courierType are required" },
        { status: 400 }
      );
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

    if (marketingRequest.status === "pending") {
      return NextResponse.json(
        { error: "Pack the order before booking shipment via Biteship." },
        { status: 400 }
      );
    }

    if (marketingRequest.biteship_order_id) {
      return NextResponse.json(
        {
          error: "This order already has a Biteship booking.",
          orderId: marketingRequest.biteship_order_id,
          waybillId: marketingRequest.actual_shipping_label,
          status: marketingRequest.biteship_status,
        },
        { status: 409 }
      );
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

    const bookedBy = verified.displayName || verified.email;

    const parsedPackage = parsePackageSpecInput(
      packageSpecInput,
      marketingRequest.items?.length ?? 1
    );
    if ("error" in parsedPackage) {
      return NextResponse.json({ error: parsedPackage.error }, { status: 400 });
    }

    const order = await createBiteshipOrder({
      request: marketingRequest,
      courierCompany: courierCompany.trim(),
      courierType: courierType.trim(),
      bookedBy,
      packageSpec: parsedPackage.spec,
    });

    const now = new Date().toISOString();
    const waybill = order.waybillId?.trim() || null;
    const routingCode = order.routingCode?.trim() || null;

    const { data: updated, error: updateError } = await supabase
      .from("marketing_requests")
      .update({
        biteship_order_id: order.orderId,
        biteship_status: order.status,
        biteship_courier_company: order.courierCompany,
        biteship_courier_type: order.courierType,
        biteship_booked_at: now,
        biteship_booked_by: bookedBy,
        biteship_status_updated_at: now,
        biteship_package_weight_grams: parsedPackage.spec.weight,
        biteship_package_length_cm: parsedPackage.spec.length,
        biteship_package_width_cm: parsedPackage.spec.width,
        biteship_package_height_cm: parsedPackage.spec.height,
        biteship_package_value_idr: parsedPackage.spec.value,
        ...(routingCode ? { biteship_routing_code: routingCode } : {}),
        ...(waybill
          ? {
              actual_shipping_label: waybill,
              actual_shipping_label_at: now,
              actual_shipping_label_by: `Biteship · ${bookedBy}`,
            }
          : {}),
      })
      .eq("id", requestId)
      .select("*, marketing_request_items(*)")
      .maybeSingle();

    if (updateError || !updated) {
      console.error("biteship order saved to Biteship but DB update failed:", updateError);
      return NextResponse.json(
        {
          error: "Shipment was created in Biteship but failed to save locally. Contact support.",
          orderId: order.orderId,
          waybillId: waybill,
          status: order.status,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: order.orderId,
      waybillId: waybill,
      status: order.status,
      price: order.price,
      courierCompany: order.courierCompany,
      courierType: order.courierType,
      request: {
        ...updated,
        items: updated.marketing_request_items ?? [],
      },
    });
  } catch (err: unknown) {
    console.error("biteship create order error:", err);
    if (err instanceof BiteshipApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode ?? 502 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create Biteship order" },
      { status: 500 }
    );
  }
}
