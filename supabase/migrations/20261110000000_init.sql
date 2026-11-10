-- Insurance Client Manager: initial schema
--
-- Every row belongs to an agency. A user can see and change a row only if
-- they are a member of that row's agency (row-level security below). Today
-- the agency has one member, the agent; an assistant later is just one more
-- row in agency_members.


-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'assistant');
create type public.policy_type as enum ('life', 'motor', 'health', 'property', 'other');
create type public.payment_frequency as enum ('monthly', 'quarterly', 'half_yearly', 'yearly', 'single');
create type public.policy_status as enum ('active', 'pending', 'lapsed', 'matured', 'cancelled');
create type public.document_label as enum ('nic', 'proposal', 'policy', 'vehicle', 'medical', 'receipt', 'other');

-- ---------------------------------------------------------------------------
-- Agencies and membership
-- ---------------------------------------------------------------------------
create table public.agencies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table public.agency_members (
  agency_id   uuid not null references public.agencies (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.member_role not null default 'owner',
  created_at  timestamptz not null default now(),
  primary key (agency_id, user_id)
);
create index agency_members_user_idx on public.agency_members (user_id);

-- Runs as the table owner so the policies below can look up membership
-- without recursing into agency_members' own policy.
create function public.is_agency_member(target_agency uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.agency_members m
    where m.agency_id = target_agency
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_agency_member(uuid) from public;
grant execute on function public.is_agency_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Insurers (he works as a broker, so this is a list, not a fixed value)
-- ---------------------------------------------------------------------------
create table public.insurers (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies (id) on delete cascade,
  name        text not null,
  branch      text,
  phone       text,
  created_at  timestamptz not null default now(),
  unique (agency_id, id),
  unique (agency_id, name)
);

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create table public.clients (
  id                 uuid primary key default gen_random_uuid(),
  agency_id          uuid not null references public.agencies (id) on delete cascade,
  full_name          text not null check (length(trim(full_name)) > 0),
  mobile             text not null,
  whatsapp           text,            -- null means "same as mobile"
  nic                text,
  date_of_birth      date,
  address            text,
  preferred_language text not null default 'si' check (preferred_language in ('si', 'en')),
  created_by         uuid references auth.users (id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (agency_id, id)
);
create index clients_agency_name_idx on public.clients (agency_id, lower(full_name));
create index clients_agency_mobile_idx on public.clients (agency_id, mobile);
create unique index clients_agency_nic_key on public.clients (agency_id, upper(nic)) where nic is not null;

create table public.family_members (
  id             uuid primary key default gen_random_uuid(),
  agency_id      uuid not null,
  client_id      uuid not null,
  full_name      text not null,
  relationship   text not null,       -- wife, son, daughter, ...
  date_of_birth  date,
  created_at     timestamptz not null default now(),
  foreign key (agency_id, client_id) references public.clients (agency_id, id) on delete cascade
);
create index family_members_client_idx on public.family_members (client_id);

create table public.client_notes (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null,
  client_id   uuid not null,
  body        text not null check (length(trim(body)) > 0),
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  foreign key (agency_id, client_id) references public.clients (agency_id, id) on delete cascade
);
create index client_notes_client_idx on public.client_notes (client_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
create table public.policies (
  id             uuid primary key default gen_random_uuid(),
  agency_id      uuid not null,
  client_id      uuid not null,
  insurer_id     uuid,
  policy_number  text not null,
  type           public.policy_type not null,
  sum_assured    numeric(14, 2) check (sum_assured >= 0),
  premium        numeric(12, 2) not null check (premium >= 0),
  frequency      public.payment_frequency not null,
  start_date     date not null,
  next_due_date  date,               -- null once fully paid / single premium
  renewal_date   date,               -- motor, property and health renew yearly
  status         public.policy_status not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (agency_id, id),
  unique (agency_id, policy_number),
  foreign key (agency_id, client_id) references public.clients (agency_id, id) on delete cascade,
  foreign key (agency_id, insurer_id) references public.insurers (agency_id, id)
);
create index policies_client_idx on public.policies (client_id);
create index policies_due_idx on public.policies (agency_id, next_due_date) where status = 'active';
create index policies_renewal_idx on public.policies (agency_id, renewal_date) where status = 'active';

-- ---------------------------------------------------------------------------
-- Follow-ups he adds himself ("call back about the motor quote").
-- Premium, renewal and birthday reminders are not stored: they are worked
-- out from policy and client dates in the due_items view, so he never types
-- them twice and they can't go stale.
-- ---------------------------------------------------------------------------
create table public.follow_ups (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null,
  client_id   uuid not null,
  policy_id   uuid,
  due_date    date not null,
  note        text not null check (length(trim(note)) > 0),
  done_at     timestamptz,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  foreign key (agency_id, client_id) references public.clients (agency_id, id) on delete cascade,
  foreign key (agency_id, policy_id) references public.policies (agency_id, id) on delete set null (policy_id)
);
create index follow_ups_open_idx on public.follow_ups (agency_id, due_date) where done_at is null;

-- ---------------------------------------------------------------------------
-- Documents (files live in the private "documents" storage bucket under
-- <agency_id>/<client_id>/<file>)
-- ---------------------------------------------------------------------------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null,
  client_id     uuid not null,
  policy_id     uuid,
  label         public.document_label not null,
  title         text not null,
  storage_path  text not null unique,
  mime_type     text not null,
  size_bytes    integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_by    uuid references auth.users (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  check (storage_path like agency_id::text || '/' || client_id::text || '/%'),
  foreign key (agency_id, client_id) references public.clients (agency_id, id) on delete cascade,
  foreign key (agency_id, policy_id) references public.policies (agency_id, id) on delete set null (policy_id)
);
create index documents_client_idx on public.documents (client_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();
create trigger policies_touch before update on public.policies
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- New users get their own agency. Sign-ups are switched off in Supabase
-- (see README), so the only users are the ones created in the dashboard.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_agency uuid;
begin
  insert into public.agencies (name)
  values (coalesce(new.raw_user_meta_data ->> 'agency_name', 'My agency'))
  returning id into new_agency;

  insert into public.agency_members (agency_id, user_id, role)
  values (new_agency, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Marking a premium as paid rolls next_due_date forward by one period.
-- security invoker: row-level security still decides who may do this.
-- ---------------------------------------------------------------------------
create function public.mark_premium_paid(target_policy uuid)
returns date
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_date date;
begin
  update public.policies p
  set next_due_date = case p.frequency
      when 'monthly'     then (p.next_due_date + interval '1 month')::date
      when 'quarterly'   then (p.next_due_date + interval '3 months')::date
      when 'half_yearly' then (p.next_due_date + interval '6 months')::date
      when 'yearly'      then (p.next_due_date + interval '1 year')::date
      when 'single'      then null
    end
  where p.id = target_policy
    and p.next_due_date is not null
  returning p.next_due_date into next_date;

  if not found then
    raise exception 'Policy not found or has no due date';
  end if;

  return next_date;
end;
$$;

revoke all on function public.mark_premium_paid(uuid) from public;
grant execute on function public.mark_premium_paid(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- What needs attention: premiums due in the next 7 days, renewals in the
-- next 30, client and family birthdays in the next 7, open follow-ups, and
-- anything overdue. Dates are Sri Lanka time. security_invoker makes the
-- view obey the row-level security of the tables underneath.
-- ---------------------------------------------------------------------------
create view public.due_items
with (security_invoker = true)
as
with today as (
  select (now() at time zone 'Asia/Colombo')::date as d
),
people as (
  select c.agency_id, c.id as client_id, null::uuid as family_member_id, c.full_name, c.date_of_birth
  from public.clients c
  where c.date_of_birth is not null
  union all
  select f.agency_id, f.client_id, f.id, f.full_name, f.date_of_birth
  from public.family_members f
  where f.date_of_birth is not null
),
birthdays as (
  select p.*,
    case
      when this_year.b >= t.d then this_year.b
      else (p.date_of_birth + make_interval(years => (extract(year from t.d)::int + 1) - extract(year from p.date_of_birth)::int))::date
    end as next_birthday
  from people p
  cross join today t
  cross join lateral (
    select (p.date_of_birth + make_interval(years => extract(year from t.d)::int - extract(year from p.date_of_birth)::int))::date as b
  ) this_year
)
select
  'premium'::text            as kind,
  p.agency_id,
  p.client_id,
  p.id                       as policy_id,
  null::uuid                 as family_member_id,
  null::uuid                 as follow_up_id,
  p.next_due_date            as due_on,
  p.next_due_date - t.d      as days_left,
  p.premium                  as amount,
  p.type::text               as detail
from public.policies p
cross join today t
where p.status = 'active'
  and p.next_due_date is not null
  and p.next_due_date <= t.d + 7

union all
select 'renewal', p.agency_id, p.client_id, p.id, null, null,
       p.renewal_date, p.renewal_date - t.d, p.premium, p.type::text
from public.policies p
cross join today t
where p.status = 'active'
  and p.renewal_date is not null
  and p.renewal_date <= t.d + 30

union all
select 'birthday', b.agency_id, b.client_id, null, b.family_member_id, null,
       b.next_birthday, b.next_birthday - t.d, null,
       (extract(year from b.next_birthday)::int - extract(year from b.date_of_birth)::int)::text
from birthdays b
cross join today t
where b.next_birthday <= t.d + 7

union all
select 'follow_up', f.agency_id, f.client_id, f.policy_id, null, f.id,
       f.due_date, f.due_date - t.d, null, f.note
from public.follow_ups f
cross join today t
where f.done_at is null
  and f.due_date <= t.d + 7;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.agencies       enable row level security;
alter table public.agency_members enable row level security;
alter table public.insurers       enable row level security;
alter table public.clients        enable row level security;
alter table public.family_members enable row level security;
alter table public.client_notes   enable row level security;
alter table public.policies       enable row level security;
alter table public.follow_ups     enable row level security;
alter table public.documents      enable row level security;

create policy "members read their agency" on public.agencies
  for select to authenticated using (public.is_agency_member(id));
create policy "owners rename their agency" on public.agencies
  for update to authenticated
  using (exists (select 1 from public.agency_members m
                 where m.agency_id = agencies.id and m.user_id = (select auth.uid()) and m.role = 'owner'));

create policy "members see who is in their agency" on public.agency_members
  for select to authenticated using (public.is_agency_member(agency_id));

-- Same rule for every record table: members of the row's agency can read
-- and write it, nobody else can.
do $$
declare
  t text;
begin
  foreach t in array array['insurers', 'clients', 'family_members', 'client_notes', 'policies', 'follow_ups', 'documents']
  loop
    execute format(
      'create policy "agency members manage %1$s" on public.%1$I
         for all to authenticated
         using (public.is_agency_member(agency_id))
         with check (public.is_agency_member(agency_id))', t);
  end loop;
end;
$$;

-- No access at all for signed-out visitors.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;

-- ---------------------------------------------------------------------------
-- Private storage for document photos. Files are only reachable through
-- signed URLs created for a signed-in member of the agency in the path.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

create policy "agency members read their documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents'
         and public.is_agency_member(((storage.foldername(name))[1])::uuid));

create policy "agency members upload documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents'
              and public.is_agency_member(((storage.foldername(name))[1])::uuid));

create policy "agency members delete documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents'
         and public.is_agency_member(((storage.foldername(name))[1])::uuid));
