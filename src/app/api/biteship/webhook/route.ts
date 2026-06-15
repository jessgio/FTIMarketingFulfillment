import { NextResponse } from "next/server";
import type { BiteshipWebhookPayload } from "../../../../lib/biteship";
import { verifyBiteshipWebhook } from "../../../../lib/biteship";
import { supabase } from "../../../../lib/supabaseClient";

function installationOkResponse() {
  return NextResponse.json({ ok: true, success: true });
}

function isInstallationProbe(rawBody: string): boolean {
  const trimmed = rawBody.trim();
  if (!trimmed) return true;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed === null) return true;
    if (typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(parsed).length === 0) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

async function findRequestForWebhook(payload: BiteshipWebhookPayload) {
  if (payload.order_id) {
    const { data } = await supabase
      .from("marketing_requests")
      .select("id")
      .eq("biteship_order_id", payload.order_id)
      .maybeSingle();
    if (data) return data.id;
  }

  if (payload.reference_id) {
    const { data } = await supabase
      .from("marketing_requests")
      .select("id")
      .eq("id", payload.reference_id)
      .maybeSingle();
    if (data) return data.id;
  }

  return null;
}

/** Biteship pings the URL during setup; respond OK without validation. */
export async function GET() {
  return installationOkResponse();
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (isInstallationProbe(rawBody)) {
    return installationOkResponse();
  }

  if (!verifyBiteshipWebhook(request)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as BiteshipWebhookPayload;
    const requestId = await findRequestForWebhook(payload);

    if (!requestId) {
      console.warn("biteship webhook: no matching marketing request", payload);
      return NextResponse.json({ ok: true, success: true, ignored: true });
    }

    const now = new Date().toISOString();
    const updates: Record<string, string | null> = {
      biteship_status_updated_at: now,
    };

    if (payload.status) {
      updates.biteship_status = payload.status;
    }

    if (payload.order_id) {
      updates.biteship_order_id = payload.order_id;
    }

    if (payload.courier_company) {
      updates.biteship_courier_company = payload.courier_company;
    }

    if (payload.courier_type) {
      updates.biteship_courier_type = payload.courier_type;
    }

    const waybill = payload.courier_waybill_id?.trim();
    if (waybill) {
      updates.actual_shipping_label = waybill;
      updates.actual_shipping_label_at = now;
      updates.actual_shipping_label_by = "Biteship webhook";
    }

    const { error } = await supabase.from("marketing_requests").update(updates).eq("id", requestId);

    if (error) {
      console.error("biteship webhook update failed:", error, payload);
      return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, success: true, requestId, event: payload.event });
  } catch (err: unknown) {
    console.error("biteship webhook error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}
