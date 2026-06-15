import type { LarkInteractiveCard } from "./lark";

function formatPackageStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  if (!normalized) return "Unknown";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function escapeLarkMd(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/([*_`\[\]])/g, "\\$1");
}

function markdownDiv(content: string) {
  return {
    tag: "div",
    text: {
      tag: "lark_md",
      content,
    },
  };
}

function openButton(label: string, url: string) {
  return {
    tag: "action",
    actions: [
      {
        tag: "button",
        text: {
          tag: "plain_text",
          content: label,
        },
        type: "primary",
        url,
      },
    ],
  };
}

function metadataLines(entries: Array<[string, string | null | undefined]>): string {
  return entries
    .filter(([, value]) => value?.trim())
    .map(([label, value]) => `${label}: ${value!.trim()}`)
    .join("\n");
}

export function buildMentionLarkCard(opts: {
  barcode: string;
  recipientName: string;
  status: string;
  requestedByName: string;
  authorName: string;
  mentionedHandles: string[];
  messagePlain: string;
  packageUrl: string;
}): LarkInteractiveCard {
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

  const metadata = metadataLines([
    ["Barcode", barcode],
    ["Recipient", recipientName],
    ["Status", statusLabel],
    ["Requested by", requestedByName],
    ["From", authorName],
    ["Mentioned", mentioned],
  ]);

  const message = escapeLarkMd(messagePlain.trim().slice(0, 2000));

  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      template: "blue",
      title: {
        tag: "plain_text",
        content: `💬 Package chat mention — ${statusLabel}`,
      },
    },
    elements: [
      markdownDiv(metadata),
      markdownDiv(`**${message}**`),
      openButton("Open thread", packageUrl),
    ],
  };
}

export function buildShippedLarkCard(opts: {
  barcode: string;
  recipientName: string;
  requestedByName: string;
  shippedBy: string;
  shippedAt: string | null;
  packageUrl: string;
}): LarkInteractiveCard {
  const { barcode, recipientName, requestedByName, shippedBy, shippedAt, packageUrl } = opts;

  const shippedAtLabel = shippedAt
    ? new Date(shippedAt).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })
    : null;

  const metadata = metadataLines([
    ["Barcode", barcode],
    ["Recipient", recipientName],
    ["Requested by", requestedByName],
    ["Shipped by", shippedBy],
    ["Shipped at", shippedAtLabel],
  ]);

  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      template: "green",
      title: {
        tag: "plain_text",
        content: "📦 Package shipped",
      },
    },
    elements: [markdownDiv(metadata), openButton("Open fulfillment", packageUrl)],
  };
}

function formatDueDate(dueDate: string | null | undefined): string | null {
  if (!dueDate?.trim()) return null;
  return new Date(`${dueDate.trim()}T12:00:00`).toLocaleDateString("en-SG", {
    timeZone: "Asia/Singapore",
  });
}

function formatItemsSummary(items: Array<{ product_name: string; qty: number }>): string | null {
  if (!items.length) return null;
  const summary = items
    .map((item) => `${item.qty}× ${item.product_name.trim()}`)
    .join(", ")
    .slice(0, 500);
  return summary || null;
}

export function buildNewRequestLarkCard(opts: {
  barcode: string;
  recipientName: string;
  requestedByName: string;
  requestedByDivision: string | null;
  dueDate: string | null;
  preferredCourier: string | null;
  requestPurpose: string | null;
  itemsSummary: string | null;
  notes: string | null;
  packageUrl: string;
}): LarkInteractiveCard {
  const {
    barcode,
    recipientName,
    requestedByName,
    requestedByDivision,
    dueDate,
    preferredCourier,
    requestPurpose,
    itemsSummary,
    notes,
    packageUrl,
  } = opts;

  const metadata = metadataLines([
    ["Barcode", barcode],
    ["Recipient", recipientName],
    ["Requested by", requestedByName],
    ["Division", requestedByDivision],
    ["Due", formatDueDate(dueDate)],
    ["Courier", preferredCourier],
    ["Purpose", requestPurpose],
    ["Items", itemsSummary],
    ["Notes", notes?.trim() || null],
  ]);

  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      template: "orange",
      title: {
        tag: "plain_text",
        content: "📋 New marketing request",
      },
    },
    elements: [markdownDiv(metadata), openButton("Open request", packageUrl)],
  };
}
