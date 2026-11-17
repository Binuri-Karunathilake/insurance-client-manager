-- Morning notifications.
--
-- push_subscriptions: one row per phone or tablet that has turned on
-- notifications (the browser's push endpoint and keys).
-- notification_settings: per user, whether to send push and email, and in
-- which language.
--
-- Each user can only see and change their own rows. The morning job reads
-- them with the service key on the server, never from the browser.

create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  device        text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notification_settings (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  push_enabled   boolean not null default true,
  email_enabled  boolean not null default true,
  language       text not null default 'si' check (language in ('si', 'en')),
  last_sent_on   date,
  updated_at     timestamptz not null default now()
);

create trigger notification_settings_touch before update on public.notification_settings
  for each row execute function public.touch_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.notification_settings enable row level security;

create policy "users manage their own devices" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "users manage their own notification settings" on public.notification_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.push_subscriptions, public.notification_settings from anon;
