# Summit Energy — Solar Proposal Tool

Sales rep tool for sizing residential solar systems and generating branded customer proposals.

## Setup

### 1. Clone and install

```bash
npm install
```

### 2. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migration: paste `supabase/migrations/001_initial.sql` into the Supabase SQL editor.
3. Create a Storage bucket named `proposal-pdfs` (private, not public).
4. Copy `.env.local.example` to `.env.local` and fill in your Supabase URL and keys.

### 3. Proposal template

Copy your `summit-energy-proposal-template.html` to `public/proposal-template.html`.
The PDF generator reads it from that path.

### 4. Run locally

```bash
npm run dev
```

### 5. Run tests

```bash
npm test
```

## Deployment (Vercel)

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
in Vercel's environment variables.

PDF generation uses `@sparticuz/chromium` which works within Vercel's serverless function
limits (~50 MB compressed). Cold starts take 3–5 s on the first request; subsequent warm
invocations are fast. If cold starts are unacceptable in production, the PDF route can be
extracted to a standalone service.

## Roles

- **Admin** — full access including the Assumptions settings screen (`/admin/settings`).
  To promote a user to admin, run: `UPDATE profiles SET role = 'admin' WHERE id = '<user-id>';`
- **Sales Rep** — can create and manage their own customers and proposals.

## PDPA note

This app stores customer name, address, phone, and TNB bill data. A formal PDPA compliance
review covering data retention, access logs, and customer consent should be completed before
go-live. The RLS policies in the migration are a starting point, not a complete compliance solution.

## Tariff schedule

Current rates reflect TNB Regulatory Period 4 (RP4), effective 1 Jul 2025 – 31 Dec 2027.
Update via Admin Settings before RP5 rates are gazetted — no code change needed.
