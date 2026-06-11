-- Product catalog for marketing request item search

create table if not exists products (
  barcode text primary key,
  clean_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_clean_name_idx on products (clean_name);

comment on table products is
  'FTI product master — barcode and display name for marketing shipment line items.';

alter table products disable row level security;
