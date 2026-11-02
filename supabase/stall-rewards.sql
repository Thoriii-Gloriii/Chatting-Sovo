-- S'ovo Chat — stall coupon + rewards card
-- Run in Supabase Dashboard -> SQL Editor, AFTER the main schema.sql.
-- Safe to re-run.
--
-- AFTER running, set the stall PIN once (pick your own digits):
--   update public.stall_settings
--      set pin_hash = extensions.crypt('1234', extensions.gen_salt('bf'))
--    where id = 1;
-- To change the PIN later, run the same line with new digits.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.stall_settings (
  id int primary key default 1 check (id = 1),
  stall_name text not null default 'Stall',
  pin_hash text,
  stamps_per_reward int not null default 5
);
insert into public.stall_settings (id) values (1) on conflict (id) do nothing;
alter table public.stall_settings enable row level security;

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_cents int not null check (price_cents >= 0),
  is_available boolean not null default true,
  sort_order int not null default 0
);
alter table public.menu_items enable row level security;

drop policy if exists "menu is readable by signed-in users" on public.menu_items;
create policy "menu is readable by signed-in users"
  on public.menu_items for select to authenticated using (true);

create table if not exists public.coupons (
  code text primary key,
  name text not null,
  discount_cents int not null,
  max_redemptions int not null,
  redeemed_count int not null default 0,
  active boolean not null default true
);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_code text not null references public.coupons(code),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid,
  created_at timestamptz not null default now(),
  unique (coupon_code, user_id)
);

insert into public.coupons (code, name, discount_cents, max_redemptions)
values ('WELCOME', 'Welcome to S''ovo Chat Coupon', 200, 200)
on conflict (code) do nothing;

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

drop policy if exists "coupons are readable by signed-in users" on public.coupons;
create policy "coupons are readable by signed-in users"
  on public.coupons for select to authenticated using (true);

drop policy if exists "users can read their own redemptions" on public.coupon_redemptions;
create policy "users can read their own redemptions"
  on public.coupon_redemptions for select to authenticated
  using (user_id = auth.uid());

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null,
  subtotal_cents int not null,
  discount_cents int not null default 0,
  total_cents int not null,
  coupon_code text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
alter table public.orders enable row level security;

drop policy if exists "users can read their own orders" on public.orders;
create policy "users can read their own orders"
  on public.orders for select to authenticated using (user_id = auth.uid());

create table if not exists public.loyalty_cards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stamps_total int not null default 0,
  rewards_earned int not null default 0,
  rewards_redeemed int not null default 0
);
alter table public.loyalty_cards enable row level security;

drop policy if exists "users can read their own card" on public.loyalty_cards;
create policy "users can read their own card"
  on public.loyalty_cards for select to authenticated using (user_id = auth.uid());

create table if not exists public.pin_failures (
  id bigserial primary key,
  user_id uuid not null,
  at timestamptz not null default now()
);
alter table public.pin_failures enable row level security;

create or replace function public._check_stall_pin(p_user uuid, p_pin text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.stall_settings%rowtype;
  v_fail int;
begin
  select * into s from public.stall_settings where id = 1;
  if s.pin_hash is null then
    return 'pin_not_set';
  end if;

  select count(*) into v_fail from public.pin_failures
   where user_id = p_user and at > now() - interval '15 minutes';
  if v_fail >= 5 then
    return 'too_many_attempts';
  end if;

  if s.pin_hash <> crypt(coalesce(p_pin, ''), s.pin_hash) then
    insert into public.pin_failures (user_id) values (p_user);
    return 'bad_pin';
  end if;

  delete from public.pin_failures where user_id = p_user;
  return null;
end;
$$;

revoke all on function public._check_stall_pin(uuid, text) from public, anon, authenticated;

create or replace function public.place_order(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me uuid := auth.uid();
  v_items jsonb;
  v_subtotal int;
  v_discount int := 0;
  v_code text := null;
  v_coupon public.coupons%rowtype;
  v_order_id uuid;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select jsonb_agg(jsonb_build_object(
           'item_id', m.id, 'name', m.name, 'qty', q.qty, 'price_cents', m.price_cents)),
         sum(m.price_cents * q.qty)::int
    into v_items, v_subtotal
    from jsonb_to_recordset(p_items) as q(item_id uuid, qty int)
    join public.menu_items m on m.id = q.item_id and m.is_available
   where q.qty between 1 and 20;

  if v_items is null then
    return jsonb_build_object('ok', false, 'error', 'empty_order');
  end if;

  select * into v_coupon from public.coupons
   where code = 'WELCOME' and active and redeemed_count < max_redemptions;
  if found and not exists (
    select 1 from public.coupon_redemptions r
     where r.coupon_code = v_coupon.code and r.user_id = me
  ) then
    v_discount := least(v_coupon.discount_cents, v_subtotal);
    v_code := v_coupon.code;
  end if;

  update public.orders set status = 'cancelled'
   where user_id = me and status = 'pending';

  insert into public.orders (user_id, items, subtotal_cents, discount_cents, total_cents, coupon_code)
  values (me, v_items, v_subtotal, v_discount, v_subtotal - v_discount, v_code)
  returning id into v_order_id;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'subtotal_cents', v_subtotal,
    'discount_cents', v_discount,
    'total_cents', v_subtotal - v_discount,
    'coupon_code', v_code
  );
end;
$$;

grant execute on function public.place_order(jsonb) to authenticated;

create or replace function public.confirm_order(p_order_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me uuid := auth.uid();
  err text;
  o public.orders%rowtype;
  s public.stall_settings%rowtype;
  v_cfg int;
  v_discount int := 0;
  v_code text := null;
  v_total int;
  v_stamps int;
  v_reward boolean := false;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  err := public._check_stall_pin(me, p_pin);
  if err is not null then
    return jsonb_build_object('ok', false, 'error', err);
  end if;

  select * into o from public.orders where id = p_order_id and user_id = me for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;
  if o.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'order_not_pending');
  end if;

  select * into s from public.stall_settings where id = 1;

  begin
    insert into public.coupon_redemptions (coupon_code, user_id, order_id)
    values ('WELCOME', me, o.id);

    update public.coupons set redeemed_count = redeemed_count + 1
     where code = 'WELCOME' and active and redeemed_count < max_redemptions
     returning discount_cents into v_cfg;

    if v_cfg is null then
      raise exception 'coupon_sold_out';
    end if;

    v_discount := least(v_cfg, o.subtotal_cents);
    v_code := 'WELCOME';
  exception when unique_violation or raise_exception then
    v_discount := 0;
    v_code := null;
  end;

  v_total := o.subtotal_cents - v_discount;

  update public.orders
     set status = 'paid', discount_cents = v_discount, coupon_code = v_code,
         total_cents = v_total, confirmed_at = now()
   where id = o.id;

  insert into public.loyalty_cards (user_id, stamps_total)
  values (me, 1)
  on conflict (user_id) do update
    set stamps_total = public.loyalty_cards.stamps_total + 1
  returning stamps_total into v_stamps;

  if v_stamps % s.stamps_per_reward = 0 then
    update public.loyalty_cards set rewards_earned = rewards_earned + 1 where user_id = me;
    v_reward := true;
  end if;

  return jsonb_build_object(
    'ok', true,
    'total_cents', v_total,
    'discount_cents', v_discount,
    'stamps_total', v_stamps,
    'stamps_on_card', v_stamps % s.stamps_per_reward,
    'free_spiral_earned', v_reward
  );
end;
$$;

grant execute on function public.confirm_order(uuid, text) to authenticated;

create or replace function public.redeem_spiral(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me uuid := auth.uid();
  err text;
  v_left int;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  err := public._check_stall_pin(me, p_pin);
  if err is not null then
    return jsonb_build_object('ok', false, 'error', err);
  end if;

  update public.loyalty_cards
     set rewards_redeemed = rewards_redeemed + 1
   where user_id = me and rewards_redeemed < rewards_earned
   returning rewards_earned - rewards_redeemed into v_left;

  if v_left is null then
    return jsonb_build_object('ok', false, 'error', 'no_reward_available');
  end if;

  return jsonb_build_object('ok', true, 'rewards_left', v_left);
end;
$$;

grant execute on function public.redeem_spiral(text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.coupons;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.loyalty_cards;
exception when duplicate_object then null;
end $$;
