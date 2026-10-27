export interface CatalogProduct {
  barcode: string;
  sku: string;
  clean_name: string;
}

export interface RequestLineInput {
  product_name: string;
  product_barcode?: string | null;
  sku?: string | null;
  qty: number;
}

export interface ResolvedRequestLine {
  product_name: string;
  product_barcode: string | null;
  sku: string | null;
  qty: number;
}

function uniqueProducts(products: CatalogProduct[]): CatalogProduct[] {
  const seen = new Set<string>();
  const unique: CatalogProduct[] = [];
  for (const product of products) {
    if (seen.has(product.barcode)) continue;
    seen.add(product.barcode);
    unique.push(product);
  }
  return unique;
}

function findByCode(products: CatalogProduct[], code: string): CatalogProduct | "ambiguous" | undefined {
  const exact = uniqueProducts(
    products.filter((product) => product.sku === code || product.barcode === code)
  );
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return "ambiguous";

  const lower = code.toLowerCase();
  const loose = uniqueProducts(
    products.filter(
      (product) => product.sku.toLowerCase() === lower || product.barcode.toLowerCase() === lower
    )
  );
  if (loose.length === 1) return loose[0];
  if (loose.length > 1) return "ambiguous";
  return undefined;
}

function findByName(products: CatalogProduct[], name: string): CatalogProduct | "ambiguous" | undefined {
  const exact = uniqueProducts(products.filter((product) => product.clean_name === name));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return "ambiguous";

  const lower = name.toLowerCase();
  const loose = uniqueProducts(
    products.filter((product) => product.clean_name.toLowerCase() === lower)
  );
  if (loose.length === 1) return loose[0];
  if (loose.length > 1) return "ambiguous";
  return undefined;
}

function catalogDisplayName(enteredName: string, explicitCode: string, product: CatalogProduct): string {
  const name = enteredName.trim();
  if (!name) return product.clean_name;

  const comparable = name.toLowerCase();
  const typedCode =
    comparable === explicitCode.trim().toLowerCase() ||
    comparable === product.sku.toLowerCase() ||
    comparable === product.barcode.toLowerCase();

  return typedCode ? product.clean_name : name;
}

/** True when the catalog rows already identify this code, including an ambiguous match. */
export function catalogCodeResolved(products: CatalogProduct[], code: string): boolean {
  return findByCode(products, code) !== undefined;
}

export function catalogNameResolved(products: CatalogProduct[], name: string): boolean {
  return findByName(products, name) !== undefined;
}

export function resolveRequestLine(products: CatalogProduct[], item: RequestLineInput): ResolvedRequestLine {
  const enteredSku = item.sku?.trim() ?? "";
  const enteredBarcode = item.product_barcode?.trim() ?? "";
  const enteredName = item.product_name.trim();

  if (enteredSku || enteredBarcode) {
    const skuMatch = enteredSku ? findByCode(products, enteredSku) : undefined;
    const barcodeMatch = enteredBarcode ? findByCode(products, enteredBarcode) : undefined;

    if (enteredSku && skuMatch === "ambiguous") {
      throw new Error(`SKU "${enteredSku}" matches more than one product.`);
    }
    if (enteredSku && !skuMatch) {
      throw new Error(`SKU "${enteredSku}" does not exist in the product catalog.`);
    }
    if (enteredBarcode && barcodeMatch === "ambiguous") {
      throw new Error(`SKU "${enteredBarcode}" matches more than one product.`);
    }
    if (enteredBarcode && !barcodeMatch) {
      throw new Error(`SKU "${enteredBarcode}" does not exist in the product catalog.`);
    }

    const product =
      (skuMatch && skuMatch !== "ambiguous" ? skuMatch : null) ??
      (barcodeMatch && barcodeMatch !== "ambiguous" ? barcodeMatch : null);

    if (
      skuMatch &&
      skuMatch !== "ambiguous" &&
      barcodeMatch &&
      barcodeMatch !== "ambiguous" &&
      skuMatch.barcode !== barcodeMatch.barcode
    ) {
      throw new Error(`SKU "${enteredSku}" does not match barcode "${enteredBarcode}".`);
    }

    if (!product) {
      throw new Error("SKU does not exist in the product catalog.");
    }

    return {
      product_name: catalogDisplayName(enteredName, enteredSku || enteredBarcode, product),
      product_barcode: product.barcode,
      sku: product.sku,
      qty: item.qty,
    };
  }

  if (enteredName) {
    const asCode = findByCode(products, enteredName);
    if (asCode === "ambiguous") {
      throw new Error(`SKU "${enteredName}" matches more than one product.`);
    }
    if (asCode) {
      return {
        product_name: asCode.clean_name,
        product_barcode: asCode.barcode,
        sku: asCode.sku,
        qty: item.qty,
      };
    }

    const asName = findByName(products, enteredName);
    if (asName && asName !== "ambiguous") {
      return {
        product_name: asName.clean_name,
        product_barcode: asName.barcode,
        sku: asName.sku,
        qty: item.qty,
      };
    }
  }

  return {
    product_name: enteredName,
    product_barcode: null,
    sku: null,
    qty: item.qty,
  };
}

export function collectCatalogSkuErrors(products: CatalogProduct[], items: RequestLineInput[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    try {
      resolveRequestLine(products, item);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid SKU.";
      if (!seen.has(message)) {
        seen.add(message);
        errors.push(message);
      }
    }
  }

  return errors;
}
