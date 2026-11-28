create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  first_name text not null default '',
  last_name text not null default '',
  address text not null default '',
  city text not null default '',
  state text not null default '',
  country text not null default '',
  pincode text not null default '',
  balance_paise bigint not null default 0 check (balance_paise >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_orders (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_paise bigint not null check (amount_paise >= 1000),
  status text not null default 'created' check (status in ('created', 'captured')),
  payment_id text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('topup', 'usage', 'refund')),
  amount_paise bigint not null check (amount_paise <> 0),
  service text,
  pages integer,
  payment_id text unique,
  operation_id uuid,
  created_at timestamptz not null default now(),
  unique (operation_id, entry_type)
);

create index if not exists credit_ledger_user_created_idx
  on public.credit_ledger(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.payment_orders enable row level security;
alter table public.credit_ledger enable row level security;

-- The backend uses the service_role key, which bypasses RLS but still needs
-- table-level grants. Supabase projects created/altered outside the default
-- SQL editor privileges can otherwise fail with "permission denied".
grant usage on schema public to service_role;
grant all on public.profiles, public.payment_orders, public.credit_ledger to service_role;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can read their payment orders" on public.payment_orders;
create policy "Users can read their payment orders" on public.payment_orders
  for select using (auth.uid() = user_id);

drop policy if exists "Users can read their credit ledger" on public.credit_ledger;
create policy "Users can read their credit ledger" on public.credit_ledger
  for select using (auth.uid() = user_id);

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone, first_name, last_name)
  values (
    new.id,
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    phone = excluded.phone,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email, phone on auth.users
  for each row execute function public.create_profile_for_auth_user();

create or replace function public.consume_credits(
  p_user_id uuid,
  p_operation_id uuid,
  p_service text,
  p_pages integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost bigint;
  v_balance bigint;
  v_existing public.credit_ledger%rowtype;
begin
  if p_service = 'watermark' then
    if p_pages < 1 then raise exception 'invalid_pages'; end if;
    v_cost := case when p_pages <= 3 then 1000 when p_pages <= 15 then 1500 else 2000 end;
  elsif p_service = 'pdf_editor' and p_pages = 1 then
    v_cost := 1000;
  else
    raise exception 'invalid_service';
  end if;

  select * into v_existing from public.credit_ledger
    where operation_id = p_operation_id and entry_type = 'usage';
  if found then
    if v_existing.user_id <> p_user_id or v_existing.service <> p_service or v_existing.pages <> p_pages then
      raise exception 'operation_id_conflict';
    end if;
    select balance_paise into v_balance from public.profiles where id = p_user_id;
    return jsonb_build_object('charged_paise', -v_existing.amount_paise, 'balance_paise', v_balance);
  end if;

  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'profile_required'; end if;
  if exists (
    select 1 from public.profiles
    where id = p_user_id and (
      first_name = '' or last_name = '' or address = '' or city = '' or state = '' or country = '' or pincode = ''
    )
  ) then raise exception 'profile_required'; end if;

  select balance_paise into v_balance from public.profiles where id = p_user_id;
  if v_balance < v_cost then raise exception 'insufficient_credits'; end if;

  insert into public.credit_ledger(user_id, entry_type, amount_paise, service, pages, operation_id)
    values (p_user_id, 'usage', -v_cost, p_service, p_pages, p_operation_id);
  update public.profiles set balance_paise = balance_paise - v_cost, updated_at = now() where id = p_user_id
    returning balance_paise into v_balance;
  return jsonb_build_object('charged_paise', v_cost, 'balance_paise', v_balance);
end;
$$;

create or replace function public.refund_credits(p_user_id uuid, p_operation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage public.credit_ledger%rowtype;
  v_balance bigint;
  v_refunded boolean := false;
begin
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'profile_required'; end if;
  select * into v_usage from public.credit_ledger
    where user_id = p_user_id and operation_id = p_operation_id and entry_type = 'usage';
  if not found then raise exception 'usage_not_found'; end if;

  if not exists (
    select 1 from public.credit_ledger
    where user_id = p_user_id and operation_id = p_operation_id and entry_type = 'refund'
  ) then
    insert into public.credit_ledger(user_id, entry_type, amount_paise, service, pages, operation_id)
      values (p_user_id, 'refund', -v_usage.amount_paise, v_usage.service, v_usage.pages, p_operation_id);
    update public.profiles set balance_paise = balance_paise - v_usage.amount_paise, updated_at = now()
      where id = p_user_id;
    v_refunded := true;
  end if;
  select balance_paise into v_balance from public.profiles where id = p_user_id;
  return jsonb_build_object('refunded', v_refunded, 'balance_paise', v_balance);
end;
$$;

create or replace function public.credit_payment(
  p_user_id uuid,
  p_payment_id text,
  p_amount_paise bigint
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
  v_order public.payment_orders%rowtype;
begin
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'profile_required'; end if;

  select * into v_order from public.payment_orders
    where payment_id = p_payment_id and user_id = p_user_id and status = 'captured';
  if not found or v_order.amount_paise <> p_amount_paise then raise exception 'payment_order_mismatch'; end if;

  if not exists (select 1 from public.credit_ledger where payment_id = p_payment_id) then
    insert into public.credit_ledger(user_id, entry_type, amount_paise, payment_id)
      values (p_user_id, 'topup', p_amount_paise, p_payment_id);
    update public.profiles set balance_paise = balance_paise + p_amount_paise, updated_at = now()
      where id = p_user_id;
  end if;
  select balance_paise into v_balance from public.profiles where id = p_user_id;
  return v_balance;
end;
$$;

create or replace function public.admin_adjust_credits(
  p_user_id uuid,
  p_amount bigint,
  p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  if p_amount = 0 or abs(p_amount) > 10000000 then raise exception 'invalid_amount'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'invalid_reason'; end if;

  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'profile_required'; end if;

  select balance_paise into v_balance from public.profiles where id = p_user_id;
  if v_balance + p_amount < 0 then raise exception 'insufficient_credits'; end if;

  insert into public.credit_ledger(user_id, entry_type, amount_paise, service)
    values (p_user_id, case when p_amount > 0 then 'topup' else 'usage' end, p_amount, 'admin_adjust:' || trim(p_reason));

  update public.profiles set balance_paise = balance_paise + p_amount, updated_at = now()
    where id = p_user_id returning balance_paise into v_balance;
  return v_balance;
end;
$$;

revoke all on function public.consume_credits(uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.refund_credits(uuid, uuid) from public, anon, authenticated;
revoke all on function public.credit_payment(uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.admin_adjust_credits(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.consume_credits(uuid, uuid, text, integer) to service_role;
grant execute on function public.refund_credits(uuid, uuid) to service_role;
grant execute on function public.credit_payment(uuid, text, bigint) to service_role;
grant execute on function public.admin_adjust_credits(uuid, bigint, text) to service_role;
