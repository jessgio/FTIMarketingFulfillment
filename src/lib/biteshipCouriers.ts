import type { MarketingCourier } from "../types/marketing";

/** Biteship courier codes to query per preferred courier tier. */
export const BITESHIP_COURIER_CODES_BY_TIER: Record<
  Extract<MarketingCourier, "Instant" | "Same Day" | "Regular" | "Kargo">,
  string[]
> = {
  Instant: ["grab", "gojek", "borzo"],
  "Same Day": ["grab", "gojek", "lalamove"],
  Regular: ["jne", "sicepat", "anteraja", "tiki", "idexpress", "ninja", "paxel", "lion"],
  Kargo: ["jnt", "jne", "sap", "sentral", "lion", "rpx"],
};

export function biteshipCourierCodesForTier(courier: MarketingCourier): string[] {
  if (courier in BITESHIP_COURIER_CODES_BY_TIER) {
    return BITESHIP_COURIER_CODES_BY_TIER[courier as keyof typeof BITESHIP_COURIER_CODES_BY_TIER];
  }
  return BITESHIP_COURIER_CODES_BY_TIER.Regular;
}

export interface BiteshipRateOption {
  courier_company: string;
  courier_type: string;
  courier_name: string;
  courier_service_name: string;
  price: number;
  duration: string;
  service_type: string;
  shipping_type: string;
}

export function filterRatesForPreferredCourier(
  rates: BiteshipRateOption[],
  preferredCourier: MarketingCourier
): BiteshipRateOption[] {
  const serviceMatchers: Record<string, (rate: BiteshipRateOption) => boolean> = {
    Instant: (rate) =>
      rate.service_type === "instant" ||
      rate.courier_type === "instant" ||
      /instant/i.test(rate.courier_service_name),
    "Same Day": (rate) =>
      rate.service_type === "same_day" ||
      rate.courier_type === "same_day" ||
      /same.?day/i.test(rate.courier_service_name),
    Regular: (rate) =>
      rate.service_type === "standard" ||
      rate.shipping_type === "parcel" ||
      /reg(ular)?|standard/i.test(rate.courier_type),
    Kargo: (rate) =>
      rate.shipping_type === "freight" ||
      /cargo|kargo|freight|truck/i.test(rate.courier_service_name) ||
      /cargo|freight|truck/i.test(rate.courier_type),
  };

  const matcher = serviceMatchers[preferredCourier];
  if (!matcher) return rates;

  const filtered = rates.filter(matcher);
  return filtered.length > 0 ? filtered : rates;
}

export function formatBiteshipStatus(status: string | null | undefined): string {
  if (!status) return "—";
  return status.replace(/_/g, " ");
}
