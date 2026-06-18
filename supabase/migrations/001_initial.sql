-- Summit Energy: initial schema
-- Enable RLS on all tables; Sales Reps can only access their own rows.

create extension if not exists "uuid-ossp";

-- ─── profiles ────────────────────────────────────────────────────────────────
create table profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  full_name text        not null,
  role      text        not null check (role in ('admin', 'sales_rep')),
  created_at timestamptz default now()
);
alter table profiles enable row level security;

create policy "user reads own profile"
  on profiles for select using (auth.uid() = id);

create policy "admin reads all profiles"
  on profiles for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "user updates own profile"
  on profiles for update using (auth.uid() = id);

-- ─── assumptions ─────────────────────────────────────────────────────────────
-- Single row; only admins may write it.
-- MAINTENANCE: TNB RP4 rates effective 1 Jul 2025 – 31 Dec 2027.
-- Update via the Admin Settings screen before RP5 is gazetted.
create table assumptions (
  id                          uuid primary key default uuid_generate_v4(),
  yield_factor                numeric not null default 110,
  energy_rate_low             numeric not null default 0.2703,
  energy_rate_high            numeric not null default 0.3703,
  energy_tier_threshold       numeric not null default 1500,
  capacity_rate               numeric not null default 0.0455,
  network_rate                numeric not null default 0.1285,
  retail_flat                 numeric not null default 10,
  retail_threshold            numeric not null default 600,
  kwtbb_rate                  numeric not null default 0.016,
  kwtbb_threshold             numeric not null default 300,
  service_tax_rate            numeric not null default 0.08,
  service_tax_threshold       numeric not null default 600,
  sun_hours_maq               numeric not null default 5,
  dc_ac_oversize_ratio        numeric not null default 1.5,
  oversize_clipping_loss_pct  numeric not null default 0.08,
  cost_per_kwp                numeric not null default 2100,
  markup_pct                  numeric not null default 0.22,
  hybrid_inverter_cost        numeric not null default 4100,
  battery_cost_per_kwh        numeric not null default 1100,
  battery_dod                 numeric not null default 0.9,
  battery_round_trip_eff      numeric not null default 0.95,
  panel_wattage               numeric not null default 630,
  area_per_panel              numeric not null default 3.0,
  -- Add-ons & EPP (terms pending; left null until admin populates them)
  addon_price                 numeric,
  addon_insurance_years       numeric,
  addon_om_visits             numeric,
  addon_workmanship_years     numeric,
  epp_bank_1                  text,
  epp_bank_1_months           numeric,
  epp_bank_2                  text,
  epp_bank_2_months           numeric,
  epp_bank_3                  text,
  epp_bank_3_months           numeric,
  updated_at  timestamptz default now(),
  updated_by  uuid references profiles(id)
);
alter table assumptions enable row level security;

create policy "authenticated users read assumptions"
  on assumptions for select using (auth.uid() is not null);

create policy "admin writes assumptions"
  on assumptions for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Seed the single default row
insert into assumptions (id) values (uuid_generate_v4());

-- ─── customers ────────────────────────────────────────────────────────────────
create table customers (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  address    text,
  phone      text,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now()
);
alter table customers enable row level security;

create policy "rep sees own customers, admin sees all"
  on customers for select using (
    created_by = auth.uid() or
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "rep inserts own customers"
  on customers for insert with check (created_by = auth.uid());

create policy "rep updates own customers, admin updates all"
  on customers for update using (
    created_by = auth.uid() or
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ─── proposals ────────────────────────────────────────────────────────────────
create table proposals (
  id                uuid primary key default uuid_generate_v4(),
  customer_id       uuid not null references customers(id),
  created_by        uuid not null references profiles(id),
  created_at        timestamptz default now(),
  status            text not null default 'draft'
                      check (status in ('draft', 'sent', 'accepted', 'rejected')),
  inputs            jsonb not null default '{}',
  computed_snapshot jsonb
);
alter table proposals enable row level security;

create policy "rep sees own proposals, admin sees all"
  on proposals for select using (
    created_by = auth.uid() or
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "rep inserts own proposals"
  on proposals for insert with check (created_by = auth.uid());

create policy "rep updates own proposals, admin updates all"
  on proposals for update using (
    created_by = auth.uid() or
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ─── proposal_files ───────────────────────────────────────────────────────────
create table proposal_files (
  id           uuid primary key default uuid_generate_v4(),
  proposal_id  uuid not null references proposals(id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz default now()
);
alter table proposal_files enable row level security;

create policy "read own proposal files"
  on proposal_files for select using (
    exists (
      select 1 from proposals pr
      where pr.id = proposal_id
        and (pr.created_by = auth.uid() or
             exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  );

create policy "insert own proposal files"
  on proposal_files for insert with check (
    exists (
      select 1 from proposals pr
      where pr.id = proposal_id and pr.created_by = auth.uid()
    )
  );
