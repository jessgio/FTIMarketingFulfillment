# FTI Marketing Fulfillment

Marketing shipment requests and warehouse packing for **From This Island**. Forked from the Aeris OfflineSalesPacking marketing module — retail PO packing and consignment flows are not included.

## Portals

| Route | Audience | Purpose |
|-------|----------|---------|
| `/` | Everyone | Hub — links to both portals |
| `/marketing` | Marketing / PR | Create requests, CSV import, chat, analytics |
| `/marketing/fulfill` | Warehouse admins | Scan `MK…` barcodes, pack, print labels, ship |
| `/marketing/labels/[id]` | Warehouse | Single shipping label |
| `/marketing/labels/batch` | Warehouse | Batch labels |
| `/marketing/manifest/batch` | Warehouse | Batch pack manifest |

## Local development

```bash
cp .env.example .env.local
# Fill in Supabase + optional Resend keys
npm install
npm run dev
```

## New Supabase project

1. Create a project at [supabase.com](https://supabase.com) for FTI.
2. Run all SQL migrations in `supabase/migrations/` in order (see `supabase/README.md`).
3. Import products into the `products` table.
4. Copy **Project URL** and **anon public** key into `.env.local`.

## Vercel deployment

1. Import this repo as a new Vercel project (separate from Aeris OfflineSalesPacking).
2. Set environment variables from `.env.example`.
3. Verify `fromthisisland.com` (or your sender domain) in Resend for chat emails.
4. Deploy.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `NEXT_PUBLIC_SITE_URL` | For emails / Lark | Public app URL in notification links |
| `RESEND_API_KEY` | For chat emails | Resend API key |
| `LARK_WEBHOOK_URL` | For Lark | Custom bot webhook for chat mentions (`@handle`) |
| `LARK_ALERTS_WEBHOOK_URL` | Optional | Separate webhook for shipped alerts; falls back to `LARK_WEBHOOK_URL` |
| `LARK_WEBHOOK_SECRET` | Optional | HMAC signature for Lark webhooks |

## Biteship integration

Warehouse staff can book **Instant**, **Same Day**, **Regular**, and **Kargo** shipments to Indonesia directly from `/marketing/fulfill`. AWB populates in **Actual shipping label** when Biteship confirms the order; webhooks keep status and AWB in sync.

### Setup

1. Run migration `20260615120000_012_biteship_integration.sql` in Supabase.
2. Add Biteship env vars from `.env.example` (API key + warehouse origin address).
3. In [Biteship Integrations → Webhook](https://dashboard.biteship.com/integrations), add:
   - **URL:** `https://<your-domain>/api/biteship/webhook`
   - **Events:** `order.status`, `order.waybill_id`
   - **Headers (optional):** set `x-webhook-secret` (or your chosen header name) to match `BITESHIP_WEBHOOK_SECRET`.
4. Deploy with env vars on Vercel.

International couriers (Rayspeed, UPS, DHL, FedEx) continue to use manual AWB entry in the shipment registry.
