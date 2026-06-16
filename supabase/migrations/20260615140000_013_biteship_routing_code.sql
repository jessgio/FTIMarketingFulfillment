-- Optional routing code returned by Biteship couriers (shown on shipping labels)

alter table marketing_requests
  add column if not exists biteship_routing_code text;

comment on column marketing_requests.biteship_routing_code is
  'Courier routing/sort code from Biteship order response for label printing.';
