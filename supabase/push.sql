-- S'ovo Chat: push notification support.
-- Run once in Supabase Dashboard, SQL Editor, New query, Run. Safe to re-run.

create table if not exists public.device_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);

create index if not exists device_tokens_user_idx on public.device_tokens (user_id);

-- No policies on purpose: the app never reads or writes this table directly.
-- It uses the two functions below, and the send-push Edge Function reads it
-- with the service role key.
alter table public.device_tokens enable row level security;

-- Saves this device's token for the signed-in user. If someone else was
-- signed in on the same device before, the token moves to the new user.
create or replace function public.register_device_token(p_token text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_token is null or length(p_token) < 20 then
    raise exception 'invalid token';
  end if;

  insert into public.device_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), coalesce(p_platform, 'android'), now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();
end;
$$;

revoke all on function public.register_device_token(text, text) from public;
grant execute on function public.register_device_token(text, text) to authenticated;

-- Removes a token. Callable after sign-out (no session), which is why anon may
-- run it: a device token is a long random value that only the device knows.
create or replace function public.unregister_device_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.device_tokens where token = p_token;
end;
$$;

revoke all on function public.unregister_device_token(text) from public;
grant execute on function public.unregister_device_token(text) to anon, authenticated;
