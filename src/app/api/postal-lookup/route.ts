import { NextResponse } from "next/server";

type ZippopotamResponse = {
  "post code": string;
  places?: Array<{
    "place name": string;
    state?: string;
    "state abbreviation"?: string;
  }>;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country")?.trim().toUpperCase();
  const postal = searchParams.get("postal")?.trim();

  if (!country || !postal) {
    return NextResponse.json({ error: "Country and postal code are required." }, { status: 400 });
  }

  const response = await fetch(
    `https://api.zippopotam.us/${encodeURIComponent(country)}/${encodeURIComponent(postal)}`,
    { next: { revalidate: 86400 } }
  );

  if (!response.ok) {
    return NextResponse.json({ error: "Postal code not found for this country." }, { status: 404 });
  }

  const data = (await response.json()) as ZippopotamResponse;
  const place = data.places?.[0];

  if (!place) {
    return NextResponse.json({ error: "Postal code not found for this country." }, { status: 404 });
  }

  return NextResponse.json({
    city: place["place name"],
    state: place.state || place["state abbreviation"] || "",
    postalCode: data["post code"] ?? postal,
  });
}
