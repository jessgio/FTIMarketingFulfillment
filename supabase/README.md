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
10. `010_user_divisions_and_roles.sql` — divisions + requester/fulfillment/admin roles

Apply via Supabase SQL Editor (paste each file in order) or `supabase db push` if linked locally.

## Users

Each user has a **role** (access) and **division** (org unit, stored on requests and exports).

| Role | Access |
|------|--------|
| `requester` | Submit and track own requests at `/marketing` |
| `fulfillment` | Pack/ship at `/marketing/fulfill`, edit registry fields |
| `admin` | Fulfillment access + delete completed shipments |

**Divisions** (examples): `Marketing`, `R&D`, `Leadership`, `Operations`, `Other`

### Seed users (change PINs before go-live)

| Email | Role | Division | Default PIN |
|-------|------|----------|-------------|
| `marketing@fromthisisland.com` | requester | Marketing | 4821 |
| `pr@fromthisisland.com` | requester | Marketing | 7392 |
| `fulfillment@fromthisisland.com` | admin | Operations | 5910 |

Add R&D or Leadership requesters in Supabase:

```sql
insert into marketing_users (email, display_name, pin, role, division) values
  ('rd@fromthisisland.com', 'R&D Team', '1234', 'requester', 'R&D'),
  ('founder@fromthisisland.com', 'Founder', '5678', 'requester', 'Leadership')
on conflict (email) do update set
  role = excluded.role,
  division = excluded.division,
  active = true;
```

**Chat:** mention users with `@email-handle` (part before @), e.g. `@marketing`, `@fulfillment`.

## Products

Load your FTI product catalog into `products` (`barcode`, `clean_name`). Request forms use this for autocomplete.

```sql
insert into products (barcode, clean_name) values
  ('1234567890123', 'Example Product Name')
on conflict (barcode) do update set clean_name = excluded.clean_name;
```
