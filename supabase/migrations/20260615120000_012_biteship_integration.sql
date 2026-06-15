-- Biteship order tracking for warehouse shipment booking

alter table marketing_requests
  add column if not exists biteship_order_id text,
  add column if not exists biteship_status text,
  add column if not exists biteship_courier_company text,
  add column if not exists biteship_courier_type text,
  add column if not exists biteship_booked_at timestamptz,
  add column if not exists biteship_booked_by text,
  add column if not exists biteship_status_updated_at timestamptz;

comment on column marketing_requests.biteship_order_id is
  'Biteship order ID after warehouse books shipment via API.';
comment on column marketing_requests.biteship_status is
  'Latest Biteship order status (confirmed, picking_up, in_transit, delivered, etc.).';
comment on column marketing_requests.biteship_courier_company is
  'Biteship courier company code selected at booking (e.g. jne, sicepat).';
comment on column marketing_requests.biteship_courier_type is
  'Biteship courier service type selected at booking (e.g. reg, instant).';

create index if not exists marketing_requests_biteship_order_id_idx
  on marketing_requests (biteship_order_id)
  where biteship_order_id is not null;
