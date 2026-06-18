import type { MarketingRequest } from "../types/marketing";

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export function buildMarketingDestinationAddress(request: MarketingRequest): string {
  return [
    request.address_line1,
    request.address_line2,
    `${request.city}, ${request.state}`,
    request.postal_code,
    request.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function parseGeocodeResult(
  results: Array<{ lat?: string; lon?: string }>
): GeoCoordinate | null {
  const match = results[0];
  if (!match?.lat || !match.lon) return null;

  const latitude = Number(match.lat);
  const longitude = Number(match.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude };
}

async function nominatimSearch(params: Record<string, string>): Promise<GeoCoordinate | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "FTI-Marketing-Fulfillment/1.0 (biteship-instant-shipping)",
    },
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    throw new Error(`Failed to geocode destination address (${response.status}).`);
  }

  const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
  return parseGeocodeResult(results);
}

export async function geocodeAddress(address: string): Promise<GeoCoordinate | null> {
  const query = address.trim();
  if (!query) return null;
  return nominatimSearch({ q: query, countrycodes: "id" });
}

export async function geocodeMarketingRequestDestination(
  request: MarketingRequest
): Promise<GeoCoordinate> {
  const queries = [
    buildMarketingDestinationAddress(request),
    [request.city, request.state, request.postal_code, request.country].filter(Boolean).join(", "),
    [request.postal_code, request.city, request.state, request.country].filter(Boolean).join(", "),
  ];

  for (const query of queries) {
    const coordinate = await geocodeAddress(query);
    if (coordinate) return coordinate;
  }

  const postal = request.postal_code?.trim();
  if (postal) {
    const byPostal = await nominatimSearch({ postalcode: postal, country: "Indonesia" });
    if (byPostal) return byPostal;
  }

  throw new Error(
    "Could not resolve destination coordinates for instant delivery. Check the recipient address is complete and accurate."
  );
}
