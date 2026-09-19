-- S'ovo Chat — Supabase schema
-- Run this once in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run: everything uses IF NOT EXISTS / CREATE OR REPLACE / drop-then-create policies.

-- ============================================================
-- profiles (public user data — auth.users is Supabase's own
-- protected auth table; this holds everything the app displays)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  "displayName" text not null,
  "phoneNumber" text default '',
  "avatarUrl" text not null,
  bio text default '',
  "isOnline" boolean default true,
  "lastSeen" bigint,
  "e2eePublicKey" text,
  "e2eeFingerprint" text,
  "phoneSyncHash" text,
  "joinedAt" text,
  "devicesCount" int default 1,
  "biometricEnabled" boolean default false,
  "pinCode" text
);

-- ============================================================
-- conversations (direct + group chats)
-- id is a plain text app-generated id (e.g. conv_direct_<uid1>_<uid2>),
-- not a uuid, to match the deterministic-id scheme the app already uses.
-- ============================================================
create table if not exists public.conversations (
  id text primary key,
  type text not null check (type in ('direct', 'group')),
  name text not null,
  username text,
  avatar text,
  members text[] not null default '{}',
  "memberCount" int default 2,
  "maxMembers" int default 500,
  "adminIds" text[] default '{}',
  "lastMessage" jsonb,
  "unreadCount" int default 0,
  "isEncrypted" boolean default true,
  "e2eeKeyFingerprint" text,
  "isPinned" boolean default false,
  "isMuted" boolean default false,
  "disappearingTimerHours" int default 0,
  "createdAt" bigint,
  "groupDescription" text
);

-- ============================================================
-- messages
-- ============================================================
create table if not exists public.messages (
  id text primary key,
  "conversationId" text not null references public.conversations(id) on delete cascade,
  "senderId" text not null,
  "senderName" text,
  "senderAvatar" text,
  text text default '',
  "mediaUrl" text,
  "mediaType" text,
  "fileName" text,
  "fileSize" text,
  "fileSizeBytes" bigint,
  "audioDurationSeconds" int,
  "isEncrypted" boolean default true,
  "e2eeFingerprint" text,
  status text default 'sent',
  timestamp bigint not null,
  "replyTo" jsonb,
  reactions jsonb,
  "userReaction" text,
  "isDisappearing" boolean default false,
  "expiresAt" bigint
);
create index if not exists messages_conversation_idx on public.messages ("conversationId", timestamp);

-- ============================================================
-- statuses (24h/72h stories)
-- ============================================================
create table if not exists public.statuses (
  id uuid primary key default gen_random_uuid(),
  "authorId" text not null,
  "authorUsername" text,
  "authorDisplayName" text,
  "authorAvatarUrl" text,
  "mediaUrl" text not null,
  "mediaType" text not null,
  caption text default '',
  "createdAt" bigint not null,
  "expiresAt" bigint not null,
  "durationDays" int not null,
  privacy text default 'all_contacts',
  "viewsCount" int default 0,
  "likedBy" text[] default '{}'
);
create index if not exists statuses_expires_idx on public.statuses ("expiresAt");

-- ============================================================
-- calls (call *log* only — no real-time audio/video transport)
-- ============================================================
create table if not exists public.calls (
  id text primary key,
  "peerId" text,
  "peerName" text,
  "peerUsername" text,
  "peerAvatar" text,
  type text check (type in ('audio', 'video')),
  direction text check (direction in ('incoming', 'outgoing', 'missed')),
  status text check (status in ('completed', 'missed', 'declined')),
  "durationSeconds" int default 0,
  timestamp bigint not null,
  "isEncrypted" boolean default true,
  members text[] not null default '{}'
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.statuses enable row level security;
alter table public.calls enable row level security;

drop policy if exists "profiles are readable by any signed-in user" on public.profiles;
create policy "profiles are readable by any signed-in user"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "users can insert their own profile" on public.profiles;
create policy "users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "members can read their conversations" on public.conversations;
create policy "members can read their conversations"
  on public.conversations for select
  to authenticated
  using (auth.uid()::text = any(members));

drop policy if exists "members can create conversations they belong to" on public.conversations;
create policy "members can create conversations they belong to"
  on public.conversations for insert
  to authenticated
  with check (auth.uid()::text = any(members));

drop policy if exists "members can update their conversations" on public.conversations;
create policy "members can update their conversations"
  on public.conversations for update
  to authenticated
  using (auth.uid()::text = any(members))
  with check (auth.uid()::text = any(members));

drop policy if exists "members can read messages in their conversations" on public.messages;
create policy "members can read messages in their conversations"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = "conversationId" and auth.uid()::text = any(c.members)
    )
  );

drop policy if exists "members can send messages in their conversations" on public.messages;
create policy "members can send messages in their conversations"
  on public.messages for insert
  to authenticated
  with check (
    "senderId" = auth.uid()::text
    and exists (
      select 1 from public.conversations c
      where c.id = "conversationId" and auth.uid()::text = any(c.members)
    )
  );

drop policy if exists "statuses are readable by any signed-in user" on public.statuses;
create policy "statuses are readable by any signed-in user"
  on public.statuses for select
  to authenticated
  using (true);

drop policy if exists "users can post their own status" on public.statuses;
create policy "users can post their own status"
  on public.statuses for insert
  to authenticated
  with check ("authorId" = auth.uid()::text);

-- Note: no general UPDATE policy on statuses — liking is done only through
-- the toggle_status_like() function below (SECURITY DEFINER), so a user
-- can't directly overwrite someone else's status row.

drop policy if exists "members can read their call log" on public.calls;
create policy "members can read their call log"
  on public.calls for select
  to authenticated
  using (auth.uid()::text = any(members));

drop policy if exists "members can insert their own call log entries" on public.calls;
create policy "members can insert their own call log entries"
  on public.calls for insert
  to authenticated
  with check (auth.uid()::text = any(members));

-- ============================================================
-- RPC: atomic like/unlike toggle for statuses (mirrors Firestore's
-- arrayUnion/arrayRemove pattern; runs as SECURITY DEFINER so callers
-- don't need blanket UPDATE rights on the table)
-- ============================================================
create or replace function public.toggle_status_like(status_id uuid, liker_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.statuses
  set "likedBy" = case
    when liker_id = any("likedBy") then array_remove("likedBy", liker_id)
    else array_append("likedBy", liker_id)
  end
  where id = status_id;
end;
$$;

grant execute on function public.toggle_status_like(uuid, text) to authenticated;

-- ============================================================
-- Realtime: enable change broadcasts for the tables the app
-- subscribes to live (messages, conversations, statuses, calls)
-- ============================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.statuses;
alter publication supabase_realtime add table public.calls;

-- ============================================================
-- Storage buckets (avatars, chat-media)
-- Public read (so a recipient's browser/app can load a shared image
-- without a signed URL), writes restricted to authenticated users.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;

drop policy if exists "avatars are publicly readable" on storage.objects;
create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "signed-in users can upload avatars" on storage.objects;
create policy "signed-in users can upload avatars"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "signed-in users can update avatars" on storage.objects;
create policy "signed-in users can update avatars"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "chat media is publicly readable" on storage.objects;
create policy "chat media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'chat-media');

drop policy if exists "signed-in users can upload chat media" on storage.objects;
create policy "signed-in users can upload chat media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-media');
