-- Name-only shipment lines (typed before a catalog SKU existed) did not store a barcode,
-- so the SKU backfill in 015 could not match them. Copy the catalog SKU when the
-- typed product name matches exactly one product, ignoring case and spacing.

with unique_names as (
  select
    regexp_replace(lower(btrim(clean_name)), '[^a-z0-9]+', ' ', 'g') as name_key,
    min(sku) as sku,
    min(barcode) as barcode
  from products
  group by 1
  having count(*) = 1
    and regexp_replace(lower(btrim(clean_name)), '[^a-z0-9]+', ' ', 'g') <> ''
)
update marketing_request_items as item
set
  sku = match.sku,
  product_barcode = coalesce(nullif(btrim(item.product_barcode), ''), match.barcode)
from unique_names as match
where item.sku is null
  and regexp_replace(lower(btrim(item.product_name)), '[^a-z0-9]+', ' ', 'g') = match.name_key;
