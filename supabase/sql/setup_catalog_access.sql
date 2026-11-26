create extension if not exists pgcrypto;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_plan_access (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  active boolean not null default true,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (customer_user_id, plan_id)
);

alter table public.plans enable row level security;
alter table public.customer_plan_access enable row level security;

drop policy if exists "plans_no_direct_access" on public.plans;
create policy "plans_no_direct_access"
on public.plans
for all
to authenticated
using (false)
with check (false);

drop policy if exists "access_rows_no_direct_access" on public.customer_plan_access;
create policy "access_rows_no_direct_access"
on public.customer_plan_access
for all
to authenticated
using (false)
with check (false);

create index if not exists idx_customer_plan_access_user_plan
on public.customer_plan_access(customer_user_id, plan_id);

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.plans to service_role;
grant select, insert, update, delete on table public.customer_plan_access to service_role;

-- Example:
-- insert into public.plans (name, storage_path)
-- values ('Shed Plan A', 'catalog/shed-plan-a.glb');
