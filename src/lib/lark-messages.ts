import type { LarkPostContent, LarkPostParagraph } from "./lark";

function formatPackageStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  if (!normalized) return "Unknown";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function metadataLine(label: string, value: string | null | undefined): LarkPostParagraph | null {
  if (!value?.trim()) return null;
  return [{ tag: "text", text: `${label}: ${value.trim()}` }];
}

function blankLine(): LarkPostParagraph {
  return [{ tag: "text", text: "" }];
}

function linkLine(label: string, url: string, linkText = "Open"): LarkPostParagraph {
  return [
    { tag: "text", text: `${label}: ` },
    { tag: "a", text: linkText, href: url },
  ];
}

export function buildMentionLarkPost(opts: {
  barcode: string;
  recipientName: string;
  status: string;
  requestedByName: string;
  authorName: string;
  mentionedHandles: string[];
  messagePlain: string;
  packageUrl: string;
}): LarkPostContent {
  const {
    barcode,
    recipientName,
    status,
    requestedByName,
    authorName,
    mentionedHandles,
    messagePlain,
    packageUrl,
  } = opts;

  const statusLabel = formatPackageStatus(status);
  const mentioned =
    mentionedHandles.length > 0
      ? mentionedHandles.map((h) => `@${h}`).join(", ")
      : null;

  const metadata = [
    metadataLine("Barcode", barcode),
    metadataLine("Recipient", recipientName),
    metadataLine("Status", statusLabel),
    metadataLine("Requested by", requestedByName),
    metadataLine("From", authorName),
    metadataLine("Mentioned", mentioned),
  ].filter((line): line is LarkPostParagraph => line !== null);

  const message = messagePlain.trim().slice(0, 4000);

  return {
    title: `💬 Package chat mention — ${statusLabel}`,
    content: [
      ...metadata,
      blankLine(),
      [{ tag: "text", text: message, style: ["bold"] }],
      blankLine(),
      linkLine("Open thread", packageUrl),
    ],
  };
}

export function buildShippedLarkPost(opts: {
  barcode: string;
  recipientName: string;
  requestedByName: string;
  shippedBy: string;
  shippedAt: string | null;
  packageUrl: string;
}): LarkPostContent {
  const { barcode, recipientName, requestedByName, shippedBy, shippedAt, packageUrl } = opts;

  const shippedAtLabel = shippedAt
    ? new Date(shippedAt).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })
    : null;

  const metadata = [
    metadataLine("Barcode", barcode),
    metadataLine("Recipient", recipientName),
    metadataLine("Requested by", requestedByName),
    metadataLine("Shipped by", shippedBy),
    metadataLine("Shipped at", shippedAtLabel),
  ].filter((line): line is LarkPostParagraph => line !== null);

  return {
    title: "📦 Package shipped",
    content: [...metadata, linkLine("Open fulfillment", packageUrl)],
  };
}
