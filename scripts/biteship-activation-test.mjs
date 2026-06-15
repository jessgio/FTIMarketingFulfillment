#!/usr/bin/env node
/**
 * Creates two Biteship sandbox orders for API activation.
 *
 * Usage:
 *   npm run biteship:test-orders
 *
 * Requires in .env.local:
 *   BITESHIP_API_KEY (biteship_test.*)
 *   BITESHIP_ORIGIN_CONTACT_NAME, BITESHIP_ORIGIN_CONTACT_PHONE,
 *   BITESHIP_ORIGIN_ADDRESS, BITESHIP_ORIGIN_POSTAL_CODE
 *
 * Optional overrides:
 *   BITESHIP_TEST_DESTINATION_POSTAL_CODE=12440
 *   BITESHIP_TEST_COURIER_COMPANY=jne
 *   BITESHIP_TEST_COURIER_TYPE=reg
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const API_BASE = "https://api.biteship.com/v1";

function loadEnvLocal() {
  const envPath = resolve(ROOT, ".env.local");
  if (!existsSync(envPath)) return;

  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} in .env.local`);
  }
  return value;
}

async function biteshipRequest(path, body) {
  const apiKey = requireEnv("BITESHIP_API_KEY");
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: apiKey,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    const detail = payload.error || payload.message || JSON.stringify(payload);
    throw new Error(`Biteship ${path} failed (${response.status}): ${detail}`);
  }
  return payload;
}

function pickRate(pricing, preferredCompany, preferredType) {
  const normalized = pricing.map((raw) => ({
    courier_company: raw.company ?? raw.courier_code ?? raw.courier_company,
    courier_type: raw.type ?? raw.courier_service_code ?? raw.courier_type,
    courier_name: raw.courier_name,
    courier_service_name: raw.courier_service_name,
    price: raw.price ?? raw.shipping_fee ?? 0,
  }));

  if (normalized.length === 0) {
    throw new Error("No courier rates returned. Check origin/destination postal codes.");
  }

  const exact = normalized.find(
    (rate) =>
      rate.courier_company === preferredCompany && rate.courier_type === preferredType
  );
  if (exact) return exact;

  const sameCompany = normalized.find((rate) => rate.courier_company === preferredCompany);
  if (sameCompany) return sameCompany;

  return normalized.sort((a, b) => a.price - b.price)[0];
}

function buildOrderPayload({
  origin,
  destinationPostalCode,
  courierCompany,
  courierType,
  referenceId,
  label,
}) {
  return {
    shipper_contact_name: origin.contactName,
    shipper_contact_phone: origin.contactPhone,
    shipper_organization: origin.organization,
    origin_contact_name: origin.contactName,
    origin_contact_phone: origin.contactPhone,
    origin_address: origin.address,
    origin_note: origin.note,
    origin_postal_code: origin.postalCode,
    destination_contact_name: "FTI Test Recipient",
    destination_contact_phone: "081234567890",
    destination_address: "Plaza Senayan, Jalan Asia Afrika, Jakarta Selatan",
    destination_note: "Biteship API activation test — not a real delivery",
    destination_postal_code: destinationPostalCode,
    courier_company: courierCompany,
    courier_type: courierType,
    delivery_type: "now",
    reference_id: referenceId,
    order_note: `FTI Marketing Fulfillment activation test ${label}`,
    metadata: {
      source: "fti-marketing-fulfillment",
      activation_test: true,
      label,
    },
    items: [
      {
        name: `FTI activation test ${label}`,
        category: "fashion",
        value: 150000,
        quantity: 1,
        weight: 400,
        length: 25,
        width: 20,
        height: 10,
      },
    ],
  };
}

async function createTestOrder({ origin, destinationPostalCode, courierCompany, courierType, label }) {
  const referenceId = randomUUID();
  const payload = buildOrderPayload({
    origin,
    destinationPostalCode,
    courierCompany,
    courierType,
    referenceId,
    label,
  });

  const result = await biteshipRequest("/orders", payload);
  return {
    label,
    orderId: result.id,
    waybillId: result.courier?.waybill_id ?? null,
    status: result.status,
    courierCompany: result.courier?.company ?? courierCompany,
    courierType: result.courier?.type ?? courierType,
    price: result.price ?? null,
    referenceId,
  };
}

async function main() {
  loadEnvLocal();

  const origin = {
    contactName: requireEnv("BITESHIP_ORIGIN_CONTACT_NAME"),
    contactPhone: requireEnv("BITESHIP_ORIGIN_CONTACT_PHONE"),
    address: requireEnv("BITESHIP_ORIGIN_ADDRESS"),
    postalCode: Number(requireEnv("BITESHIP_ORIGIN_POSTAL_CODE")),
    note: process.env.BITESHIP_ORIGIN_NOTE?.trim() || "FTI warehouse pickup",
    organization: process.env.BITESHIP_ORIGIN_ORGANIZATION?.trim() || "From This Island",
  };

  if (!Number.isFinite(origin.postalCode)) {
    throw new Error("BITESHIP_ORIGIN_POSTAL_CODE must be a number");
  }

  const destinationPostalCode = Number(
    process.env.BITESHIP_TEST_DESTINATION_POSTAL_CODE?.trim() || "12440"
  );
  const preferredCompany = process.env.BITESHIP_TEST_COURIER_COMPANY?.trim() || "jne";
  const preferredType = process.env.BITESHIP_TEST_COURIER_TYPE?.trim() || "reg";

  const apiKey = requireEnv("BITESHIP_API_KEY");
  if (!apiKey.startsWith("biteship_test.")) {
    console.warn(
      "Warning: BITESHIP_API_KEY does not look like a test key (expected biteship_test.*)."
    );
  }

  console.log("Fetching Biteship rates…");
  console.log(`  Origin postal:      ${origin.postalCode}`);
  console.log(`  Destination postal: ${destinationPostalCode}`);

  const ratesResult = await biteshipRequest("/rates/couriers", {
    origin_postal_code: origin.postalCode,
    destination_postal_code: destinationPostalCode,
    couriers: "jne,sicepat,anteraja,tiki,idexpress",
    items: [
      {
        name: "FTI activation test package",
        value: 150000,
        quantity: 1,
        weight: 400,
        length: 25,
        width: 20,
        height: 10,
      },
    ],
  });

  const selectedRate = pickRate(ratesResult.pricing, preferredCompany, preferredType);
  console.log(
    `Using courier: ${selectedRate.courier_name} ${selectedRate.courier_service_name} (${selectedRate.courier_company}/${selectedRate.courier_type}) — IDR ${selectedRate.price}`
  );

  console.log("\nCreating 2 sandbox orders…\n");

  const orders = [];
  for (const label of ["#1", "#2"]) {
    const order = await createTestOrder({
      origin,
      destinationPostalCode,
      courierCompany: selectedRate.courier_company,
      courierType: selectedRate.courier_type,
      label,
    });
    orders.push(order);
    console.log(`  ${label} Order ID:  ${order.orderId}`);
    console.log(`      AWB:         ${order.waybillId ?? "(pending)"}`);
    console.log(`      Status:      ${order.status}`);
    console.log("");
  }

  console.log("═".repeat(60));
  console.log("Copy these Order IDs into Biteship → Integrations → Aktivasi Order API:\n");
  for (const order of orders) {
    console.log(`  ${order.orderId}`);
  }
  console.log("\nDashboard: https://dashboard.biteship.com/integrations");
  console.log("═".repeat(60));
}

main().catch((err) => {
  console.error("\nFailed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
