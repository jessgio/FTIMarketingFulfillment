import type { MarketingRequest } from "../types/marketing";
import { biteshipCourierCodesForTier } from "./biteshipCouriers";

const BITESHIP_API_BASE = "https://api.biteship.com/v1";

export class BiteshipApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: number
  ) {
    super(message);
    this.name = "BiteshipApiError";
  }
}

export function isBiteshipConfigured(): boolean {
  return Boolean(process.env.BITESHIP_API_KEY?.trim());
}

export function getBiteshipOriginConfig() {
  const contactName = process.env.BITESHIP_ORIGIN_CONTACT_NAME?.trim();
  const contactPhone = process.env.BITESHIP_ORIGIN_CONTACT_PHONE?.trim();
  const address = process.env.BITESHIP_ORIGIN_ADDRESS?.trim();
  const postalCode = Number(process.env.BITESHIP_ORIGIN_POSTAL_CODE?.trim());

  if (!contactName || !contactPhone || !address || !Number.isFinite(postalCode)) {
    throw new BiteshipApiError(
      "Biteship origin is not configured. Set BITESHIP_ORIGIN_CONTACT_NAME, BITESHIP_ORIGIN_CONTACT_PHONE, BITESHIP_ORIGIN_ADDRESS, and BITESHIP_ORIGIN_POSTAL_CODE."
    );
  }

  return {
    contactName,
    contactPhone,
    contactEmail: process.env.BITESHIP_ORIGIN_CONTACT_EMAIL?.trim() || undefined,
    address,
    note: process.env.BITESHIP_ORIGIN_NOTE?.trim() || undefined,
    postalCode,
    organization: process.env.BITESHIP_ORIGIN_ORGANIZATION?.trim() || "From This Island",
  };
}

export function getDefaultPackageSpec(itemCount: number) {
  const perItemWeight = Number(process.env.BITESHIP_DEFAULT_ITEM_WEIGHT_GRAMS ?? "400");
  const weight = Math.max(200, perItemWeight * Math.max(1, itemCount));
  return {
    weight,
    length: Number(process.env.BITESHIP_DEFAULT_LENGTH_CM ?? "25"),
    width: Number(process.env.BITESHIP_DEFAULT_WIDTH_CM ?? "20"),
    height: Number(process.env.BITESHIP_DEFAULT_HEIGHT_CM ?? "10"),
    value: Number(process.env.BITESHIP_DEFAULT_ITEM_VALUE ?? "150000"),
  };
}

async function biteshipFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.BITESHIP_API_KEY?.trim();
  if (!apiKey) {
    throw new BiteshipApiError("BITESHIP_API_KEY is not configured.");
  }

  const response = await fetch(`${BITESHIP_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      authorization: apiKey,
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as T & {
    success?: boolean;
    error?: string;
    code?: number;
    message?: string;
  };

  if (!response.ok || payload.success === false) {
    throw new BiteshipApiError(
      payload.error || payload.message || `Biteship request failed (${response.status})`,
      response.status,
      payload.code
    );
  }

  return payload;
}

export interface BiteshipRatesPricing {
  courier_company: string;
  courier_type: string;
  courier_name: string;
  courier_service_name: string;
  price: number;
  duration: string;
  service_type: string;
  shipping_type: string;
}

type RawBiteshipRate = {
  company?: string;
  courier_code?: string;
  courier_company?: string;
  type?: string;
  courier_service_code?: string;
  courier_type?: string;
  courier_name?: string;
  courier_service_name?: string;
  price?: number;
  shipping_fee?: number;
  duration?: string;
  service_type?: string;
  shipping_type?: string;
};

export function normalizeBiteshipRate(raw: RawBiteshipRate): BiteshipRatesPricing {
  return {
    courier_company: raw.company ?? raw.courier_code ?? raw.courier_company ?? "",
    courier_type: raw.type ?? raw.courier_service_code ?? raw.courier_type ?? "",
    courier_name: raw.courier_name ?? raw.company ?? "Courier",
    courier_service_name: raw.courier_service_name ?? raw.type ?? "",
    price: raw.price ?? raw.shipping_fee ?? 0,
    duration: raw.duration ?? "",
    service_type: raw.service_type ?? "",
    shipping_type: raw.shipping_type ?? "",
  };
}

export async function fetchBiteshipRates(request: MarketingRequest): Promise<BiteshipRatesPricing[]> {
  const origin = getBiteshipOriginConfig();
  const destinationPostal = Number(request.postal_code?.trim());
  if (!Number.isFinite(destinationPostal)) {
    throw new BiteshipApiError("Destination postal code is required for Biteship rates.");
  }

  const preferredCourier = request.preferred_courier ?? "Regular";
  const couriers = biteshipCourierCodesForTier(preferredCourier).join(",");
  const packageSpec = getDefaultPackageSpec(request.items?.length ?? 1);
  const items = (request.items ?? []).map((item) => ({
    name: item.product_name.slice(0, 255),
    description: item.product_barcode ? `SKU ${item.product_barcode}` : undefined,
    category: "fashion",
    value: packageSpec.value,
    quantity: item.qty,
    weight: Math.max(100, Math.round(packageSpec.weight / Math.max(1, request.items?.length ?? 1))),
    length: packageSpec.length,
    width: packageSpec.width,
    height: packageSpec.height,
  }));

  if (items.length === 0) {
    items.push({
      name: `Marketing shipment ${request.barcode}`,
      description: undefined,
      category: "fashion",
      value: packageSpec.value,
      quantity: 1,
      weight: packageSpec.weight,
      length: packageSpec.length,
      width: packageSpec.width,
      height: packageSpec.height,
    });
  }

  const body = {
    origin_postal_code: origin.postalCode,
    destination_postal_code: destinationPostal,
    couriers,
    items,
  };

  const result = await biteshipFetch<{
    pricing?: RawBiteshipRate[];
  }>("/rates/couriers", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return (result.pricing ?? []).map(normalizeBiteshipRate).filter((rate) => rate.courier_company && rate.courier_type);
}

export interface BiteshipCreateOrderInput {
  request: MarketingRequest;
  courierCompany: string;
  courierType: string;
  bookedBy: string;
}

export interface BiteshipOrderResult {
  orderId: string;
  waybillId: string | null;
  status: string;
  courierCompany: string;
  courierType: string;
  price: number | null;
}

export async function createBiteshipOrder(input: BiteshipCreateOrderInput): Promise<BiteshipOrderResult> {
  const { request, courierCompany, courierType, bookedBy } = input;
  const origin = getBiteshipOriginConfig();
  const destinationPostal = Number(request.postal_code?.trim());
  if (!Number.isFinite(destinationPostal)) {
    throw new BiteshipApiError("Destination postal code is required.");
  }
  if (!request.recipient_phone?.trim()) {
    throw new BiteshipApiError("Recipient phone is required for Biteship booking.");
  }

  const destinationAddress = [
    request.address_line1,
    request.address_line2,
    `${request.city}, ${request.state}`,
  ]
    .filter(Boolean)
    .join(", ");

  const packageSpec = getDefaultPackageSpec(request.items?.length ?? 1);
  const lineItems = (request.items ?? []).map((item) => ({
    name: item.product_name.slice(0, 255),
    description: item.product_barcode ? `SKU ${item.product_barcode}` : undefined,
    category: "fashion",
    sku: item.product_barcode ?? undefined,
    value: packageSpec.value,
    quantity: item.qty,
    weight: Math.max(100, Math.round(packageSpec.weight / Math.max(1, request.items?.length ?? 1))),
    length: packageSpec.length,
    width: packageSpec.width,
    height: packageSpec.height,
  }));

  if (lineItems.length === 0) {
    lineItems.push({
      name: `Marketing shipment ${request.barcode}`,
      description: undefined,
      category: "fashion",
      sku: request.barcode,
      value: packageSpec.value,
      quantity: 1,
      weight: packageSpec.weight,
      length: packageSpec.length,
      width: packageSpec.width,
      height: packageSpec.height,
    });
  }

  const orderNote = [
    request.notes?.trim(),
    request.request_purpose ? `Purpose: ${request.request_purpose}` : null,
    `Barcode: ${request.barcode}`,
    `Booked by: ${bookedBy}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const body = {
    shipper_contact_name: origin.contactName,
    shipper_contact_phone: origin.contactPhone,
    shipper_contact_email: origin.contactEmail,
    shipper_organization: origin.organization,
    origin_contact_name: origin.contactName,
    origin_contact_phone: origin.contactPhone,
    origin_contact_email: origin.contactEmail,
    origin_address: origin.address,
    origin_note: origin.note,
    origin_postal_code: origin.postalCode,
    destination_contact_name: request.recipient_name,
    destination_contact_phone: request.recipient_phone.trim(),
    destination_address: destinationAddress,
    destination_note: request.notes?.trim() || undefined,
    destination_postal_code: destinationPostal,
    courier_company: courierCompany,
    courier_type: courierType,
    delivery_type: "now",
    reference_id: request.id,
    order_note: orderNote || undefined,
    metadata: {
      marketing_request_id: request.id,
      marketing_barcode: request.barcode,
    },
    items: lineItems,
  };

  const result = await biteshipFetch<{
    id: string;
    status: string;
    price?: number;
    courier?: {
      waybill_id?: string | null;
      company?: string;
      type?: string;
    };
  }>("/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    orderId: result.id,
    waybillId: result.courier?.waybill_id ?? null,
    status: result.status,
    courierCompany: result.courier?.company ?? courierCompany,
    courierType: result.courier?.type ?? courierType,
    price: result.price ?? null,
  };
}

export type BiteshipWebhookEvent = "order.status" | "order.waybill_id" | "order.price";

export interface BiteshipWebhookPayload {
  event?: BiteshipWebhookEvent;
  order_id?: string;
  status?: string;
  courier_waybill_id?: string;
  courier_tracking_id?: string;
  courier_company?: string;
  courier_type?: string;
  reference_id?: string;
}

export function verifyBiteshipWebhook(request: Request): boolean {
  const expectedSecret = process.env.BITESHIP_WEBHOOK_SECRET?.trim();
  if (!expectedSecret) return true;

  const headerName = process.env.BITESHIP_WEBHOOK_HEADER_NAME?.trim() || "x-webhook-secret";
  const received = request.headers.get(headerName);
  return received === expectedSecret;
}
