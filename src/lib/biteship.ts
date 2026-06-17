import type { MarketingRequest } from "../types/marketing";
import { biteshipCouriersParamForRequest } from "./biteshipCouriers";
import {
  buildBiteshipLineItems,
  getDefaultPackageSpec,
  resolvePackageSpec,
  type BiteshipPackageSpec,
} from "./biteshipPackageSpec";

export {
  BITESHIP_PACKAGE_DEFAULTS,
  computeDefaultPackageSpec,
  getDefaultPackageSpec,
  type BiteshipPackageSpec,
} from "./biteshipPackageSpec";

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

export async function fetchBiteshipRates(
  request: MarketingRequest,
  packageSpecOverride?: Partial<BiteshipPackageSpec> | null
): Promise<BiteshipRatesPricing[]> {
  const origin = getBiteshipOriginConfig();
  const destinationPostal = Number(request.postal_code?.trim());
  if (!Number.isFinite(destinationPostal)) {
    throw new BiteshipApiError("Destination postal code is required for Biteship rates.");
  }

  const couriers = biteshipCouriersParamForRequest(request.preferred_courier);
  if (!couriers) {
    throw new BiteshipApiError(
      "Biteship couriers are required for rate lookup but none were configured for this shipment."
    );
  }

  const packageSpec = resolvePackageSpec(request, packageSpecOverride);
  const items = buildBiteshipLineItems(request, packageSpec).map(({ sku: _sku, ...item }) => item);

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
  packageSpec?: Partial<BiteshipPackageSpec> | null;
}

export interface BiteshipOrderResult {
  orderId: string;
  waybillId: string | null;
  routingCode: string | null;
  status: string;
  courierCompany: string;
  courierType: string;
  price: number | null;
}

export async function createBiteshipOrder(input: BiteshipCreateOrderInput): Promise<BiteshipOrderResult> {
  const { request, courierCompany, courierType, bookedBy, packageSpec: packageSpecOverride } = input;
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

  const packageSpec = resolvePackageSpec(request, packageSpecOverride);
  const lineItems = buildBiteshipLineItems(request, packageSpec);

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
      routing_code?: string | null;
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
    routingCode: result.courier?.routing_code?.trim() || null,
    status: result.status,
    courierCompany: result.courier?.company ?? courierCompany,
    courierType: result.courier?.type ?? courierType,
    price: result.price ?? null,
  };
}

export interface BiteshipOrderLabelFields {
  waybillId: string | null;
  routingCode: string | null;
  courierCompany: string | null;
  courierType: string | null;
  status: string | null;
}

export async function fetchBiteshipOrderLabelFields(
  biteshipOrderId: string
): Promise<BiteshipOrderLabelFields> {
  const order = await biteshipGet<{
    status?: string;
    courier?: {
      waybill_id?: string | null;
      routing_code?: string | null;
      company?: string;
      type?: string;
    };
  }>(`/orders/${encodeURIComponent(biteshipOrderId.trim())}`);

  return {
    waybillId: order.courier?.waybill_id?.trim() || null,
    routingCode: order.courier?.routing_code?.trim() || null,
    courierCompany: order.courier?.company?.trim() || null,
    courierType: order.courier?.type?.trim() || null,
    status: order.status ?? null,
  };
}

export type BiteshipWebhookEvent = "order.status" | "order.waybill_id" | "order.price";

export interface BiteshipTrackingHistoryEntry {
  status: string;
  note: string;
  updated_at: string;
  service_type?: string;
}

export interface BiteshipTrackingDetails {
  status: string;
  waybill_id: string | null;
  courier_company: string | null;
  courier_name: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  origin_address: string | null;
  destination_address: string | null;
  link: string | null;
  history: BiteshipTrackingHistoryEntry[];
}

type RawBiteshipTracking = {
  status?: string;
  waybill_id?: string | null;
  link?: string | null;
  courier?: {
    company?: string;
    name?: string;
    driver_name?: string | null;
    driver_phone?: string | null;
    tracking_id?: string | null;
    waybill_id?: string | null;
  };
  origin?: { contact_name?: string; address?: string };
  destination?: { contact_name?: string; address?: string };
  history?: BiteshipTrackingHistoryEntry[];
};

function normalizeTrackingDetails(raw: RawBiteshipTracking): BiteshipTrackingDetails {
  return {
    status: raw.status ?? "unknown",
    waybill_id: raw.waybill_id ?? raw.courier?.waybill_id ?? null,
    courier_company: raw.courier?.company ?? null,
    courier_name: raw.courier?.name ?? null,
    driver_name: raw.courier?.driver_name ?? null,
    driver_phone: raw.courier?.driver_phone ?? null,
    origin_address: raw.origin?.address ?? null,
    destination_address: raw.destination?.address ?? null,
    link: raw.link ?? null,
    history: (raw.history ?? []).slice().sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    ),
  };
}

async function biteshipGet<T>(path: string): Promise<T> {
  const apiKey = process.env.BITESHIP_API_KEY?.trim();
  if (!apiKey) {
    throw new BiteshipApiError("BITESHIP_API_KEY is not configured.");
  }

  const response = await fetch(`${BITESHIP_API_BASE}${path}`, {
    method: "GET",
    headers: {
      authorization: apiKey,
    },
  });

  const payload = (await response.json()) as T & {
    success?: boolean;
    error?: string;
    message?: string;
    code?: number;
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

export async function fetchBiteshipTrackingDetails(input: {
  biteshipOrderId?: string | null;
  waybillId?: string | null;
  courierCompany?: string | null;
}): Promise<BiteshipTrackingDetails | null> {
  const waybill = input.waybillId?.trim() || null;
  let courierCompany = input.courierCompany?.trim() || null;
  let trackingId: string | null = null;

  if (input.biteshipOrderId?.trim()) {
    try {
      const order = await biteshipGet<RawBiteshipTracking & { courier?: { tracking_id?: string; company?: string; waybill_id?: string } }>(
        `/orders/${encodeURIComponent(input.biteshipOrderId.trim())}`
      );
      trackingId = order.courier?.tracking_id?.trim() || null;
      courierCompany = courierCompany ?? order.courier?.company?.trim() ?? null;
      if (order.status || order.history?.length) {
        return normalizeTrackingDetails(order);
      }
    } catch {
      /* fall through to tracking endpoints */
    }
  }

  if (trackingId) {
    try {
      const tracking = await biteshipGet<RawBiteshipTracking>(
        `/trackings/${encodeURIComponent(trackingId)}`
      );
      return normalizeTrackingDetails(tracking);
    } catch {
      /* fall through */
    }
  }

  if (waybill && courierCompany) {
    const tracking = await biteshipGet<RawBiteshipTracking>(
      `/trackings/${encodeURIComponent(waybill)}/couriers/${encodeURIComponent(courierCompany)}`
    );
    return normalizeTrackingDetails(tracking);
  }

  return null;
}

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
