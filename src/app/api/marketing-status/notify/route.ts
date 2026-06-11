import { NextResponse } from "next/server";
import { getAppOrigin } from "../../../../lib/app-origin";
import { isLarkConfigured, sendLarkText } from "../../../../lib/lark";
import { buildShippedLarkText } from "../../../../lib/lark-messages";
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
        "id, barcode, recipient_name, status, requested_by_name, shipped_by, shipped_at"
      )
      .eq("id", requestId)
      .maybeSingle();

    if (pkgError || !pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    if (pkg.status !== "shipped") {
      return NextResponse.json({ error: "Package is not shipped" }, { status: 400 });
    }

    const origin = getAppOrigin(new URL(request.url).origin);
    const packageUrl = `${origin}/marketing/fulfill`;
    const larkText = buildShippedLarkText({
      barcode: pkg.barcode,
      recipientName: pkg.recipient_name,
      requestedByName: pkg.requested_by_name,
      shippedBy: pkg.shipped_by ?? "Unknown",
      shippedAt: pkg.shipped_at,
      packageUrl,
    });

    const larkResult = await sendLarkText(larkText, { webhookKind: "alerts" });
    if (!larkResult.ok) {
      console.error("Lark shipped notify failed:", larkResult.error);
      return NextResponse.json({ success: true, larkError: larkResult.error });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("marketing-status notify error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send Lark notification" },
      { status: 500 }
    );
  }
}
