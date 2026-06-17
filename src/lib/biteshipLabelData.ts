import type { MarketingRequest } from "../types/marketing";
import { getBiteshipOriginConfig, getDefaultPackageSpec } from "./biteship";

const COURIER_DISPLAY_NAMES: Record<string, string> = {
  jne: "JNE",
  sicepat: "SiCepat",
  anteraja: "AnterAja",
  tiki: "TIKI",
  idexpress: "ID Express",
  ninja: "Ninja",
  paxel: "Paxel",
  lion: "Lion Parcel",
  jnt: "J&T Express",
  grab: "Grab",
  gojek: "Gojek",
  lalamove: "Lalamove",
  borzo: "Borzo",
  sap: "SAP",
  rpx: "RPX",
};

export interface BiteshipLabelData {
  courierCompany: string;
  courierType: string;
  courierDisplayName: string;
  serviceLabel: string;
  waybillId: string;
  routingCode: string | null;
  senderName: string;
  senderPhone: string;
  senderOrganization: string;
  senderAddress: string;
  senderPostalCode: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddressLines: string[];
  recipientCityStatePostal: string;
  recipientCountry: string;
  packageWeightGrams: number;
  packageSummary: string;
  referenceBarcode: string;
  biteshipOrderId: string;
  orderNote: string | null;
}

function formatCourierName(code: string): string {
  const normalized = code.trim().toLowerCase();
  return COURIER_DISPLAY_NAMES[normalized] ?? code.toUpperCase();
}

function formatServiceLabel(company: string, type: string): string {
  const name = formatCourierName(company);
  const service = type.trim().toUpperCase();
  if (!service || service === name.toUpperCase()) return name;
  return `${name} · ${service}`;
}

export function biteshipLabelPagePath(requestId: string): string {
  return `/marketing/labels/biteship/${requestId}`;
}

export function biteshipLabelsBatchPagePath(ids: string[]): string {
  return `/marketing/labels/biteship/batch?ids=${encodeURIComponent(ids.join(","))}`;
}

export function marketingPackingLabelsBatchPagePath(ids: string[]): string {
  return `/marketing/labels/batch?ids=${encodeURIComponent(ids.join(","))}`;
}

export function requestIdsWithBiteshipLabels(
  requests: MarketingRequest[],
  ids: string[]
): string[] {
  const eligible = new Set(
    requests.filter((req) => canPrintBiteshipLabel(req)).map((req) => req.id)
  );
  return ids.filter((id) => eligible.has(id));
}

export function canPrintBiteshipLabel(request: MarketingRequest): boolean {
  return Boolean(request.biteship_order_id);
}

export function buildBiteshipLabelData(
  request: MarketingRequest,
  overrides?: {
    waybillId?: string | null;
    routingCode?: string | null;
    courierCompany?: string | null;
    courierType?: string | null;
  }
): BiteshipLabelData | null {
  if (!request.biteship_order_id) return null;

  const waybillId =
    overrides?.waybillId?.trim() ||
    request.actual_shipping_label?.trim() ||
    null;
  if (!waybillId) return null;

  const courierCompany =
    overrides?.courierCompany?.trim() ||
    request.biteship_courier_company?.trim() ||
    "courier";
  const courierType =
    overrides?.courierType?.trim() || request.biteship_courier_type?.trim() || "";

  const origin = getBiteshipOriginConfig();
  const packageSpec = getDefaultPackageSpec(request.items?.length ?? 1);
  const itemSummary = (request.items ?? [])
    .map((item) => `${item.qty}× ${item.product_name}`)
    .join(", ")
    .slice(0, 120);

  const recipientAddressLines = [
    request.address_line1,
    request.address_line2,
  ].filter(Boolean) as string[];

  return {
    courierCompany,
    courierType,
    courierDisplayName: formatCourierName(courierCompany),
    serviceLabel: formatServiceLabel(courierCompany, courierType),
    waybillId,
    routingCode:
      overrides?.routingCode?.trim() || request.biteship_routing_code?.trim() || null,
    senderName: origin.contactName,
    senderPhone: origin.contactPhone,
    senderOrganization: origin.organization,
    senderAddress: origin.address,
    senderPostalCode: String(origin.postalCode),
    recipientName: request.recipient_name,
    recipientPhone: request.recipient_phone?.trim() || "—",
    recipientAddressLines,
    recipientCityStatePostal: `${request.city}, ${request.state} ${request.postal_code}`.trim(),
    recipientCountry: request.country,
    packageWeightGrams: packageSpec.weight,
    packageSummary: itemSummary || request.barcode,
    referenceBarcode: request.barcode,
    biteshipOrderId: request.biteship_order_id,
    orderNote: request.notes?.trim() || request.request_purpose?.trim() || null,
  };
}
