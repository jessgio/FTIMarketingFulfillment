-- Map each catalog product to an SKU. Request lines store that SKU for export.
-- Requesters keep seeing clean_name. A line may omit SKU for a free-text product name,
-- but any SKU that is stored must exist in products.

alter table products add column if not exists sku text;

update products
set sku = barcode
where sku is null or btrim(sku) = '';

alter table products alter column sku set not null;

alter table products
  add constraint products_sku_key unique (sku);

alter table products
  add constraint products_sku_not_blank
  check (char_length(btrim(sku)) > 0);

comment on column products.sku is
  'Catalog SKU for this product. Defaults to the barcode when a product is saved without one.';

comment on table products is
  'FTI product master. clean_name is what people see; sku is included in shipment exports.';

-- Barcode-only catalog imports still get an SKU (the barcode) until a distinct SKU is set.
create or replace function public.products_default_sku()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.sku is null or btrim(new.sku) = '' then
    new.sku := new.barcode;
  else
    new.sku := btrim(new.sku);
  end if;
  return new;
end;
$$;

drop trigger if exists products_default_sku on products;

create trigger products_default_sku
  before insert or update on products
  for each row
  execute function public.products_default_sku();

revoke all on function public.products_default_sku() from public, anon, authenticated;

alter table marketing_request_items add column if not exists sku text;

update marketing_request_items as item
set sku = product.sku
from products as product
where item.sku is null
  and nullif(btrim(item.product_barcode), '') is not null
  and (
    btrim(item.product_barcode) = product.sku
    or btrim(item.product_barcode) = product.barcode
  );

alter table marketing_request_items
  add constraint marketing_request_items_sku_fkey
  foreign key (sku) references products (sku)
  on update cascade
  on delete restrict;

create index if not exists marketing_request_items_sku_idx
  on marketing_request_items (sku);

comment on column marketing_request_items.sku is
  'Catalog SKU copied from products. Null for a free-text product name. Rejects SKUs that are not in products.';
