import type { MarketingRequest } from "../types/marketing";

export interface BiteshipPackageSpec {
  weight: number;
  length: number;
  width: number;
  height: number;
  value: number;
}

export const BITESHIP_PACKAGE_DEFAULTS = {
  perItemWeightGrams: 400,
  lengthCm: 25,
  widthCm: 20,
  heightCm: 10,
  itemValueIdr: 150_000,
} as const;

export function computeDefaultPackageSpec(itemCount: number): BiteshipPackageSpec {
  const count = Math.max(1, itemCount);
  return {
    weight: Math.max(200, BITESHIP_PACKAGE_DEFAULTS.perItemWeightGrams * count),
    length: BITESHIP_PACKAGE_DEFAULTS.lengthCm,
    width: BITESHIP_PACKAGE_DEFAULTS.widthCm,
    height: BITESHIP_PACKAGE_DEFAULTS.heightCm,
    value: BITESHIP_PACKAGE_DEFAULTS.itemValueIdr,
  };
}

export function getDefaultPackageSpec(itemCount: number): BiteshipPackageSpec {
  const perItemWeight = Number(
    process.env.BITESHIP_DEFAULT_ITEM_WEIGHT_GRAMS ??
      String(BITESHIP_PACKAGE_DEFAULTS.perItemWeightGrams)
  );
  const weight = Math.max(200, perItemWeight * Math.max(1, itemCount));
  return {
    weight,
    length: Number(process.env.BITESHIP_DEFAULT_LENGTH_CM ?? String(BITESHIP_PACKAGE_DEFAULTS.lengthCm)),
    width: Number(process.env.BITESHIP_DEFAULT_WIDTH_CM ?? String(BITESHIP_PACKAGE_DEFAULTS.widthCm)),
    height: Number(process.env.BITESHIP_DEFAULT_HEIGHT_CM ?? String(BITESHIP_PACKAGE_DEFAULTS.heightCm)),
    value: Number(process.env.BITESHIP_DEFAULT_ITEM_VALUE ?? String(BITESHIP_PACKAGE_DEFAULTS.itemValueIdr)),
  };
}

export function resolvePackageSpec(
  request: MarketingRequest,
  override?: Partial<BiteshipPackageSpec> | null
): BiteshipPackageSpec {
  const stored = packageSpecFromRequest(request);
  const base = stored ?? getDefaultPackageSpec(request.items?.length ?? 1);
  if (!override) return base;

  return {
    weight: override.weight ?? base.weight,
    length: override.length ?? base.length,
    width: override.width ?? base.width,
    height: override.height ?? base.height,
    value: override.value ?? base.value,
  };
}

export function packageSpecFromRequest(request: MarketingRequest): BiteshipPackageSpec | null {
  const { biteship_package_weight_grams: weight, biteship_package_length_cm: length, biteship_package_width_cm: width, biteship_package_height_cm: height, biteship_package_value_idr: value } = request;
  if (
    weight == null ||
    length == null ||
    width == null ||
    height == null ||
    value == null
  ) {
    return null;
  }
  return { weight, length, width, height, value };
}

export function parsePackageSpecInput(
  input: unknown,
  itemCount: number
): { spec: BiteshipPackageSpec } | { error: string } {
  if (!input || typeof input !== "object") {
    return { spec: getDefaultPackageSpec(itemCount) };
  }

  const raw = input as Record<string, unknown>;
  const defaults = getDefaultPackageSpec(itemCount);

  const weight = parsePositiveInt(raw.weight, "Weight", 100, 50_000) ?? defaults.weight;
  const length = parsePositiveNumber(raw.length, "Length", 1, 200) ?? defaults.length;
  const width = parsePositiveNumber(raw.width, "Width", 1, 200) ?? defaults.width;
  const height = parsePositiveNumber(raw.height, "Height", 1, 200) ?? defaults.height;
  const value = parsePositiveInt(raw.value, "Declared value", 1_000, 100_000_000) ?? defaults.value;

  if (typeof weight === "string") return { error: weight };
  if (typeof length === "string") return { error: length };
  if (typeof width === "string") return { error: width };
  if (typeof height === "string") return { error: height };
  if (typeof value === "string") return { error: value };

  return { spec: { weight, length, width, height, value } };
}

function parsePositiveInt(
  value: unknown,
  label: string,
  min: number,
  max: number
): number | string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return `${label} must be a whole number.`;
  }
  if (parsed < min || parsed > max) {
    return `${label} must be between ${min.toLocaleString("en-US")} and ${max.toLocaleString("en-US")}.`;
  }
  return parsed;
}

function parsePositiveNumber(
  value: unknown,
  label: string,
  min: number,
  max: number
): number | string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return `${label} must be a number.`;
  }
  if (parsed < min || parsed > max) {
    return `${label} must be between ${min} and ${max}.`;
  }
  return parsed;
}

export function buildBiteshipLineItems(
  request: MarketingRequest,
  packageSpec: BiteshipPackageSpec
) {
  const itemCount = Math.max(1, request.items?.length ?? 1);
  const perLineWeight = Math.max(100, Math.round(packageSpec.weight / itemCount));

  const lineItems = (request.items ?? []).map((item) => ({
    name: item.product_name.slice(0, 255),
    description: item.product_barcode ? `SKU ${item.product_barcode}` : undefined,
    category: "fashion" as const,
    sku: item.product_barcode ?? undefined,
    value: packageSpec.value,
    quantity: item.qty,
    weight: perLineWeight,
    length: packageSpec.length,
    width: packageSpec.width,
    height: packageSpec.height,
  }));

  if (lineItems.length === 0) {
    lineItems.push({
      name: `Marketing shipment ${request.barcode}`,
      description: undefined,
      category: "fashion" as const,
      sku: request.barcode,
      value: packageSpec.value,
      quantity: 1,
      weight: packageSpec.weight,
      length: packageSpec.length,
      width: packageSpec.width,
      height: packageSpec.height,
    });
  }

  return lineItems;
}
