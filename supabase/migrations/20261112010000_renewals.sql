-- Marking a policy as renewed moves its renewal date on by one year,
-- counted from the start date like premiums (29 Feb starts renew on 28 Feb).

create function public.mark_policy_renewed(target_policy uuid)
returns date
language plpgsql
security invoker
set search_path = ''
as $$
declare
  p record;
  k int;
  candidate date;
begin
  select id, start_date, renewal_date
    into p
    from public.policies
   where id = target_policy
     and renewal_date is not null
   for update;

  if not found then
    raise exception 'Policy not found or has no renewal date';
  end if;

  k := greatest(1, (extract(year from p.renewal_date) - extract(year from p.start_date))::int);
  loop
    candidate := (p.start_date + make_interval(years => k))::date;
    exit when candidate > p.renewal_date;
    k := k + 1;
  end loop;

  update public.policies set renewal_date = candidate where id = p.id;
  return candidate;
end;
$$;

revoke all on function public.mark_policy_renewed(uuid) from public, anon;
grant execute on function public.mark_policy_renewed(uuid) to authenticated;
