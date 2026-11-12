-- Follow-ups booked further ahead seemed to vanish: due_items only listed
-- those in the next 7 days. Show open follow-ups up to 30 days ahead, the
-- same window as renewals. Everything else is unchanged.

create or replace view public.due_items
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
  and f.due_date <= t.d + 30;
