function line(label: string, value: string | null | undefined) {
  if (!value?.trim()) return "";
  return `${label}: ${value.trim()}\n`;
}

function formatPackageStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  if (!normalized) return "Unknown";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function buildMentionLarkText(opts: {
  barcode: string;
  recipientName: string;
  status: string;
  requestedByName: string;
  authorName: string;
  mentionedHandles: string[];
  messagePlain: string;
  packageUrl: string;
}) {
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
      : undefined;

  return [
    `💬 Package chat mention — ${statusLabel}`,
    "",
    line("Barcode", barcode),
    line("Recipient", recipientName),
    line("Status", statusLabel),
    line("Requested by", requestedByName),
    line("From", authorName),
    line("Mentioned", mentioned),
    "",
    messagePlain.trim(),
    "",
    `Open thread: ${packageUrl}`,
  ]
    .filter((row, i, arr) => row !== "" || (i > 0 && arr[i - 1] !== ""))
    .join("\n")
    .trim();
}

export function buildShippedLarkText(opts: {
  barcode: string;
  recipientName: string;
  requestedByName: string;
  shippedBy: string;
  shippedAt: string | null;
  packageUrl: string;
}) {
  const { barcode, recipientName, requestedByName, shippedBy, shippedAt, packageUrl } = opts;

  const shippedAtLabel = shippedAt
    ? new Date(shippedAt).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })
    : undefined;

  return [
    "📦 Package shipped",
    "",
    line("Barcode", barcode),
    line("Recipient", recipientName),
    line("Requested by", requestedByName),
    line("Shipped by", shippedBy),
    line("Shipped at", shippedAtLabel),
    "",
    `Open fulfillment: ${packageUrl}`,
  ]
    .filter((row, i, arr) => row !== "" || (i > 0 && arr[i - 1] !== ""))
    .join("\n")
    .trim();
}
