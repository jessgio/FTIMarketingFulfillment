import assert from "node:assert/strict";
import { buildMarketingHistoryExportCsv } from "../src/lib/marketingExport.ts";
import {
  MARKETING_IMPORT_HEADERS,
  MARKETING_IMPORT_TEMPLATE_ROWS,
  parseMarketingImportCsv,
  buildMarketingImportTemplateCsv,
} from "../src/lib/marketingImport.ts";
import { fillMissingSkuFromCatalog, resolveRequestLine } from "../src/lib/productSku.ts";

const catalog = [
  { barcode: "8801234567890", sku: "LIP-ROSE", clean_name: "Lip Gloss Rose" },
  { barcode: "8801234567891", sku: "SERUM-30", clean_name: "Face Serum 30ml" },
];

const bySku = resolveRequestLine(catalog, {
  product_name: "Rose gloss",
  sku: "LIP-ROSE",
  qty: 2,
});
assert.equal(bySku.product_name, "Rose gloss");
assert.equal(bySku.sku, "LIP-ROSE");
assert.equal(bySku.product_barcode, "8801234567890");

const typedSku = resolveRequestLine(catalog, {
  product_name: "serum-30",
  qty: 1,
});
assert.equal(typedSku.product_name, "Face Serum 30ml");
assert.equal(typedSku.sku, "SERUM-30");

const byName = resolveRequestLine(catalog, {
  product_name: "lip gloss rose",
  qty: 1,
});
assert.equal(byName.product_name, "Lip Gloss Rose");
assert.equal(byName.sku, "LIP-ROSE");

const freeText = resolveRequestLine(catalog, {
  product_name: "Body Lotion",
  qty: 1,
});
assert.equal(freeText.product_name, "Body Lotion");
assert.equal(freeText.sku, null);
assert.equal(freeText.product_barcode, null);

assert.throws(
  () =>
    resolveRequestLine(catalog, {
      product_name: "Mystery",
      sku: "NO-SUCH-SKU",
      qty: 1,
    }),
  /SKU "NO-SUCH-SKU" does not exist in the product catalog/
);

assert.throws(
  () =>
    resolveRequestLine(catalog, {
      product_name: "Lip Gloss Rose",
      sku: "LIP-ROSE",
      product_barcode: "8801234567891",
      qty: 1,
    }),
  /does not match barcode/
);

const csv = buildMarketingHistoryExportCsv([
  {
    id: "1",
    barcode: "MK000000000001",
    status: "pending",
    requested_by_email: "marketing@fromthisisland.com",
    requested_by_name: "Marketing Team",
    requested_by_division: "Marketing",
    recipient_name: "Jane Doe",
    recipient_phone: "+6591234567",
    due_date: "2026-06-15",
    preferred_courier: "Regular",
    address_line1: "123 Orchard Road",
    address_line2: null,
    city: "Singapore",
    state: "Central Region",
    postal_code: "238858",
    country: "Singapore",
    notes: null,
    request_purpose: "Launch",
    packed_by: null,
    packed_at: null,
    shipped_by: null,
    shipped_at: null,
    actual_shipping_label: null,
    actual_shipping_label_at: null,
    actual_shipping_label_by: null,
    biteship_order_id: null,
    biteship_status: null,
    biteship_courier_company: null,
    biteship_courier_type: null,
    biteship_booked_at: null,
    biteship_booked_by: null,
    biteship_status_updated_at: null,
    biteship_routing_code: null,
    biteship_package_weight_grams: null,
    biteship_package_length_cm: null,
    biteship_package_width_cm: null,
    biteship_package_height_cm: null,
    biteship_package_value_idr: null,
    created_at: "2026-06-01T00:00:00.000Z",
    items: [
      {
        product_name: "Lip Gloss Rose",
        product_barcode: "8801234567890",
        sku: "LIP-ROSE",
        qty: 2,
      },
    ],
  },
]);

const [header, row] = csv.split("\r\n");
assert.ok(header.includes("product_name,sku,product_barcode,qty"));
assert.ok(row.includes("Lip Gloss Rose,LIP-ROSE,8801234567890,2"));
assert.equal(row.includes("LIP-ROSE"), true);

for (const templateRow of MARKETING_IMPORT_TEMPLATE_ROWS) {
  assert.equal(templateRow.length, MARKETING_IMPORT_HEADERS.length);
}

const parsed = parseMarketingImportCsv(buildMarketingImportTemplateCsv());
assert.deepEqual(parsed.errors, []);
assert.equal(parsed.packages[0].items[0].sku, "LIP-ROSE");
assert.equal(parsed.packages[0].items[0].product_name, "Lip Gloss Rose");
assert.equal(parsed.packages[1].items[0].sku, undefined);
assert.equal(parsed.packages[1].items[0].product_barcode, undefined);

const typedBeforeCatalog = fillMissingSkuFromCatalog(
  {
    product_name: "ILLIPE BUTTER BALM - RUBY ROUGE",
    product_barcode: null,
    sku: null,
    qty: 4,
  },
  [{ barcode: "8801111111111", sku: "ILLIPE-RUBY", clean_name: "Illipe Butter Balm - Ruby Rouge" }]
);
assert.equal(typedBeforeCatalog.product_name, "ILLIPE BUTTER BALM - RUBY ROUGE");
assert.equal(typedBeforeCatalog.sku, "ILLIPE-RUBY");
assert.equal(typedBeforeCatalog.product_barcode, "8801111111111");

const alreadySet = fillMissingSkuFromCatalog(
  {
    product_name: "Illipe Butter Balm - Ruby Rouge",
    product_barcode: "8801111111111",
    sku: "KEEP-ME",
    qty: 1,
  },
  [{ barcode: "8801111111111", sku: "ILLIPE-RUBY", clean_name: "Illipe Butter Balm - Ruby Rouge" }]
);
assert.equal(alreadySet.sku, "KEEP-ME");

console.log("product sku tests passed");
