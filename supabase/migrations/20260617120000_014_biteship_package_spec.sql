-- Package dimensions used when booking via Biteship (for accurate labels and rate history)

alter table marketing_requests
  add column if not exists biteship_package_weight_grams integer,
  add column if not exists biteship_package_length_cm numeric(6, 2),
  add column if not exists biteship_package_width_cm numeric(6, 2),
  add column if not exists biteship_package_height_cm numeric(6, 2),
  add column if not exists biteship_package_value_idr integer;

comment on column marketing_requests.biteship_package_weight_grams is
  'Total package weight in grams declared at Biteship booking.';
comment on column marketing_requests.biteship_package_length_cm is
  'Package length in cm declared at Biteship booking.';
comment on column marketing_requests.biteship_package_width_cm is
  'Package width in cm declared at Biteship booking.';
comment on column marketing_requests.biteship_package_height_cm is
  'Package height in cm declared at Biteship booking.';
comment on column marketing_requests.biteship_package_value_idr is
  'Declared package value in IDR at Biteship booking.';
