-- Mark-as-paid moved the due date on by one period from the last due date,
-- so a policy started on 31 January drifted to the 28th for good after
-- February. Count from the start date instead: the next due date is always
-- start_date + k periods (month ends clamp, e.g. 31 Jan -> 28 Feb -> 31 Mar).

create or replace function public.mark_premium_paid(target_policy uuid)
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
  select id, start_date, next_due_date, frequency
    into p
    from public.policies
   where id = target_policy
     and next_due_date is not null
   for update;

  if not found then
    raise exception 'Policy not found or has no due date';
  end if;

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

  -- Start a little before the current due date, then walk forward.
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

revoke all on function public.mark_premium_paid(uuid) from public, anon;
grant execute on function public.mark_premium_paid(uuid) to authenticated;
