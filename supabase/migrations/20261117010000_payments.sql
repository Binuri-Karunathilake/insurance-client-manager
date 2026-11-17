-- Payment history.
--
-- Until now "Mark as paid" only moved the next due date and kept no record.
-- Now each paid premium is a row in payments, which gives the agent a
-- history per policy, a monthly report of premiums collected, and a way to
-- undo a payment marked by mistake.

create type public.payment_method as enum ('cash', 'bank', 'online', 'cheque', 'other');

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null,
  client_id   uuid not null,
  policy_id   uuid not null,
  amount      numeric(12, 2) not null check (amount > 0),
  due_date    date not null,            -- the premium date this payment covers
  paid_on     date not null,
  method      public.payment_method not null default 'cash',
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  foreign key (agency_id, client_id) references public.clients (agency_id, id) on delete cascade,
  foreign key (agency_id, policy_id) references public.policies (agency_id, id) on delete cascade
);
create index payments_agency_paid_idx on public.payments (agency_id, paid_on);
create index payments_policy_idx on public.payments (policy_id, due_date desc, created_at desc);

alter table public.payments enable row level security;
create policy "agency members manage payments" on public.payments
  for all to authenticated
  using (public.is_agency_member(agency_id))
  with check (public.is_agency_member(agency_id));
revoke all on public.payments from anon;

-- Mark as paid now also records the payment. Amount defaults to the
-- policy's premium, method to cash, date to today in Sri Lanka.
drop function if exists public.mark_premium_paid(uuid);

create function public.mark_premium_paid(
  target_policy uuid,
  paid_amount numeric default null,
  paid_method public.payment_method default 'cash',
  paid_date date default null
)
returns date
language plpgsql
security invoker
set search_path = ''
as $$
declare
  p record;
  step int;
  k int;
  candidate date;
begin
  select id, agency_id, client_id, start_date, next_due_date, frequency, premium
    into p
    from public.policies
   where id = target_policy
     and next_due_date is not null
   for update;

  if not found then
    raise exception 'Policy not found or has no due date';
  end if;
  if paid_amount is not null and paid_amount <= 0 then
    raise exception 'Amount must be more than zero';
  end if;

  insert into public.payments (agency_id, client_id, policy_id, amount, due_date, paid_on, method)
  values (p.agency_id, p.client_id, p.id, coalesce(paid_amount, p.premium), p.next_due_date,
          coalesce(paid_date, (now() at time zone 'Asia/Colombo')::date), paid_method);

  if p.frequency = 'single' then
    update public.policies set next_due_date = null where id = p.id;
    return null;
  end if;

  step := case p.frequency
    when 'monthly' then 1
    when 'quarterly' then 3
    when 'half_yearly' then 6
    else 12
  end;

  -- Count from the start date so month ends don't drift (31 Jan -> 28 Feb -> 31 Mar).
  k := greatest(0, ((extract(year from p.next_due_date) - extract(year from p.start_date)) * 12
        + extract(month from p.next_due_date) - extract(month from p.start_date))::int / step - 1);
  loop
    candidate := (p.start_date + make_interval(months => k * step))::date;
    exit when candidate > p.next_due_date;
    k := k + 1;
  end loop;

  update public.policies set next_due_date = candidate where id = p.id;
  return candidate;
end;
$$;

-- Undo a payment marked by mistake: only the policy's latest payment, so
-- the due date always goes back to the right period.
create function public.undo_payment(target_payment uuid)
returns date
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pay record;
  latest uuid;
begin
  select id, policy_id, due_date into pay from public.payments where id = target_payment;
  if not found then
    raise exception 'Payment not found';
  end if;

  select id into latest from public.payments
   where policy_id = pay.policy_id
   order by due_date desc, created_at desc
   limit 1;
  if latest <> pay.id then
    raise exception 'Only the latest payment can be undone';
  end if;

  perform 1 from public.policies where id = pay.policy_id for update;
  update public.policies set next_due_date = pay.due_date where id = pay.policy_id;
  delete from public.payments where id = pay.id;
  return pay.due_date;
end;
$$;

revoke all on function public.mark_premium_paid(uuid, numeric, public.payment_method, date) from public, anon;
grant execute on function public.mark_premium_paid(uuid, numeric, public.payment_method, date) to authenticated;
revoke all on function public.undo_payment(uuid) from public, anon;
grant execute on function public.undo_payment(uuid) to authenticated;
