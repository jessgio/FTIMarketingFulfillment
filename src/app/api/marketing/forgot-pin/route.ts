import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getAppOrigin } from "../../../../lib/app-origin";
import { supabase } from "../../../../lib/supabaseClient";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  const resendConfigured = Boolean(process.env.RESEND_API_KEY);
  if (!resendConfigured) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
  }

  try {
    const { email } = (await request.json()) as { email?: string };
    const normalizedEmail = normalizeEmail(email ?? "");
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("marketing_users")
      .select("email, display_name, pin")
      .eq("email", normalizedEmail)
      .eq("active", true)
      .maybeSingle();

    if (error) {
      console.error("forgot-pin lookup error:", error);
      return NextResponse.json({ error: "Could not look up account" }, { status: 500 });
    }

    if (data) {
      const siteUrl = getAppOrigin(new URL(request.url).origin);
      const marketingUrl = `${siteUrl}/marketing`;
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: "FTI Fulfillment <fulfillment@fromthisisland.com>",
        to: [data.email],
        subject: "[FTI] Your shipment portal PIN",
        text: [
          `Hi ${data.display_name},`,
          "",
          "You requested a reminder of your PIN for the FTI shipment request portal.",
          "",
          `Your PIN: ${data.pin}`,
          "",
          `Sign in here: ${marketingUrl}`,
          "",
          "If you did not request this email, you can ignore it.",
        ].join("\n"),
      });
    }

    return NextResponse.json({
      success: true,
      message: "If that email is registered, your PIN has been sent.",
    });
  } catch (err: unknown) {
    console.error("forgot-pin error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send PIN email" },
      { status: 500 }
    );
  }
}
