import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getAppOrigin } from "../../../../lib/app-origin";
import { isLarkConfigured, sendLarkText } from "../../../../lib/lark";
import { buildMentionLarkText } from "../../../../lib/lark-messages";
import { buildMarketingThreadUrl } from "../../../../lib/marketingDeepLinks";
import { supabase } from "../../../../lib/supabaseClient";
import { mentionHandleFromEmail, parseMentionedEmails } from "../../../../lib/marketingMentions";
import { canFulfill, normalizeUserRole } from "../../../../lib/marketingRoles";
import type { MarketingChatParticipant } from "../../../../types/marketing";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  const resendConfigured = Boolean(process.env.RESEND_API_KEY);
  const larkConfigured = isLarkConfigured("chat");

  if (!resendConfigured && !larkConfigured) {
    return NextResponse.json({ error: "Notification service not configured" }, { status: 503 });
  }

  const resend = resendConfigured ? new Resend(process.env.RESEND_API_KEY) : null;

  try {
    const { messageId } = (await request.json()) as { messageId?: string };
    if (!messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 });
    }

    const { data: message, error: messageError } = await supabase
      .from("marketing_request_messages")
      .select("*")
      .eq("id", messageId)
      .maybeSingle();

    if (messageError || !message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const { data: pkg, error: pkgError } = await supabase
      .from("marketing_requests")
      .select("barcode, recipient_name, status, requested_by_name, requested_by_email")
      .eq("id", message.request_id)
      .maybeSingle();

    if (pkgError || !pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    const { data: users } = await supabase
      .from("marketing_users")
      .select("email, display_name, role, division")
      .eq("active", true);

    const participants: MarketingChatParticipant[] = (users ?? []).map((u) => ({
      email: u.email,
      display_name: u.display_name,
      role: normalizeUserRole(u.role),
      division: (u.division?.trim() || "Other") as MarketingChatParticipant["division"],
      handle: mentionHandleFromEmail(u.email),
    }));
    const roleByEmail = new Map(
      participants.map((p) => [normalizeEmail(p.email), p.role])
    );

    const authorEmail = normalizeEmail(message.author_email);
    const requesterEmail = normalizeEmail(pkg.requested_by_email);
    const mentionedEmailsRaw = parseMentionedEmails(
      message.body,
      participants,
      message.author_email
    );
    const mentionedEmails = mentionedEmailsRaw.map(normalizeEmail);
    const mentionedHandles = mentionedEmailsRaw.map((email) => {
      const participant = participants.find((p) => normalizeEmail(p.email) === normalizeEmail(email));
      return participant?.handle ?? mentionHandleFromEmail(email);
    });

    const recipients = new Set<string>();

    if (authorEmail !== requesterEmail) {
      recipients.add(requesterEmail);
    }

    for (const email of mentionedEmails) {
      if (email !== authorEmail) {
        recipients.add(email);
      }
    }

    let larkError: string | undefined;
    if (mentionedEmails.length > 0 && larkConfigured) {
      const origin = getAppOrigin(new URL(request.url).origin);
      const threadUrl = buildMarketingThreadUrl(origin, message.request_id);
      const larkText = buildMentionLarkText({
        barcode: pkg.barcode,
        recipientName: pkg.recipient_name,
        status: pkg.status,
        requestedByName: pkg.requested_by_name,
        authorName: message.author_name,
        mentionedHandles,
        messagePlain: message.body,
        packageUrl: threadUrl,
      });
      const larkResult = await sendLarkText(larkText, { webhookKind: "chat" });
      if (!larkResult.ok) {
        console.error("Lark mention notify failed:", larkResult.error);
        larkError = larkResult.error;
      }
    }

    if (recipients.size === 0 || !resend) {
      return NextResponse.json({ success: true, emailed: 0, larkError });
    }

    const siteUrl = getAppOrigin(new URL(request.url).origin);
    const marketingUrl = `${siteUrl}/marketing`;
    const fulfillUrl = `${siteUrl}/marketing/fulfill`;

    const packageBlock = [
      `Package barcode: ${pkg.barcode}`,
      `Recipient: ${pkg.recipient_name}`,
      `Status: ${pkg.status}`,
      `Requested by: ${pkg.requested_by_name}`,
      "",
      "Message:",
      `"${message.body}"`,
    ].join("\n");

    let emailed = 0;

    for (const to of recipients) {
      const isRequester = to === requesterEmail;
      const wasMentioned = mentionedEmails.includes(to);
      const openUrl = canFulfill({ email: to, displayName: "", role: roleByEmail.get(to) ?? "requester", division: "Other" })
        ? fulfillUrl
        : marketingUrl;

      let subject: string;
      let intro: string;

      if (isRequester && wasMentioned) {
        subject = `[FTI] ${message.author_name} replied on your request — ${pkg.recipient_name} (${pkg.barcode})`;
        intro = `${message.author_name} mentioned you in the discussion for your marketing request:`;
      } else if (isRequester) {
        subject = `[FTI] New message on your request — ${pkg.recipient_name} (${pkg.barcode})`;
        intro = `${message.author_name} posted in the discussion for your marketing request:`;
      } else {
        subject = `[FTI] ${message.author_name} mentioned you — ${pkg.recipient_name} (${pkg.barcode})`;
        intro = `${message.author_name} mentioned you in a package discussion:`;
      }

      const text = [intro, "", packageBlock, "", `Open the dashboard to reply: ${openUrl}`].join("\n");

      await resend!.emails.send({
        from: "FTI Fulfillment <fulfillment@fromthisisland.com>",
        to: [to],
        subject,
        text,
      });
      emailed += 1;
    }

    return NextResponse.json({ success: true, emailed, larkError });
  } catch (err: unknown) {
    console.error("marketing-chat notify error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send notification emails" },
      { status: 500 }
    );
  }
}
