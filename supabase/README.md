# FTI Marketing Fulfillment — Supabase setup

Run migrations in order against a **new** Supabase project (separate from Aeris / OfflineSalesPacking).

## Migrations

1. `001_products.sql` — product catalog for item search
2. `002_marketing_requests.sql` — users, requests, line items
3. `003_marketing_delivery_fields.sql` — phone, due date, courier
4. `004_marketing_request_chat.sql` — roles, chat messages, admin user
5. `005_marketing_shipped_tracking.sql` — shipped audit fields
6. `006_marketing_request_purpose.sql` — event/purpose dropdown
7. `007_marketing_chat_reads.sql` — unread badges
8. `008_marketing_actual_shipping_label.sql` — tracking for Regular/Kargo
9. `009_marketing_admin_request_views.sql` — new-order badges for admins

Apply via Supabase SQL Editor (paste each file in order) or `supabase db push` if linked locally.

## Seed users (change PINs before go-live)

| Email | Role | Default PIN |
|-------|------|-------------|
| `marketing@fromthisisland.com` | marketing | 4821 |
| `pr@fromthisisland.com` | marketing | 7392 |
| `fulfillment@fromthisisland.com` | admin | 5910 |

**Chat:** mention users with `@email-handle` (part before @), e.g. `@marketing`, `@fulfillment`.

## Products

Load your FTI product catalog into `products` (`barcode`, `clean_name`). Marketing request forms use this for autocomplete.

```sql
insert into products (barcode, clean_name) values
  ('1234567890123', 'Example Product Name')
on conflict (barcode) do update set clean_name = excluded.clean_name;
```
