import { NextResponse } from "next/server";
import { getAppOrigin } from "../../../../lib/app-origin";
import { isLarkConfigured, sendLarkCard } from "../../../../lib/lark";
import { buildNewRequestLarkCard } from "../../../../lib/lark-messages";
import { buildMarketingThreadUrl } from "../../../../lib/marketingDeepLinks";
import { supabase } from "../../../../lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const { requestId } = (await request.json()) as { requestId?: string };
    if (!requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }

    if (!isLarkConfigured("alerts")) {
      return NextResponse.json({ success: true, larkSkipped: true });
    }

    const { data: pkg, error: pkgError } = await supabase
      .from("marketing_requests")
      .select(
        "id, barcode, status, recipient_name, requested_by_name, requested_by_division, due_date, preferred_courier, request_purpose, notes"
      )
      .eq("id", requestId)
      .maybeSingle();

    if (pkgError || !pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    if (pkg.status !== "pending") {
      return NextResponse.json({ error: "Only pending requests can be announced" }, { status: 400 });
    }

    const { data: items } = await supabase
      .from("marketing_request_items")
      .select("product_name, qty")
      .eq("request_id", requestId)
      .order("product_name");

    const origin = getAppOrigin(new URL(request.url).origin);
    const packageUrl = buildMarketingThreadUrl(origin, requestId);
    const itemsSummary =
      items && items.length > 0
        ? items.map((item) => `${item.qty}× ${item.product_name}`).join(", ").slice(0, 500)
        : null;

    const larkCard = buildNewRequestLarkCard({
      barcode: pkg.barcode,
      recipientName: pkg.recipient_name,
      requestedByName: pkg.requested_by_name,
      requestedByDivision: pkg.requested_by_division,
      dueDate: pkg.due_date,
      preferredCourier: pkg.preferred_courier,
      requestPurpose: pkg.request_purpose,
      itemsSummary,
      notes: pkg.notes,
      packageUrl,
    });

    const larkResult = await sendLarkCard(larkCard, { webhookKind: "alerts" });
    if (!larkResult.ok) {
      console.error("Lark new request notify failed:", larkResult.error);
      return NextResponse.json({ success: true, larkError: larkResult.error });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("marketing-request notify error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send Lark notification" },
      { status: 500 }
    );
  }
}
