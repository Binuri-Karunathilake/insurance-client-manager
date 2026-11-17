-- Excel import.
--
-- The app checks every row first and shows a preview; this function then
-- adds the new insurers, clients and policies in one transaction, so an
-- import either goes in completely or not at all. security invoker: the
-- agent's own row-level security decides what may be inserted.

create function public.import_clients(
  target_agency uuid,
  new_insurers jsonb,
  new_clients jsonb,
  new_policies jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.insurers (id, agency_id, name)
  select x.id, target_agency, x.name
    from jsonb_to_recordset(new_insurers) as x(id uuid, name text);

  insert into public.clients (id, agency_id, full_name, mobile, whatsapp, nic, date_of_birth, address, preferred_language)
  select x.id, target_agency, x.full_name, x.mobile, x.whatsapp, x.nic, x.date_of_birth, x.address, x.preferred_language
    from jsonb_to_recordset(new_clients) as x(
      id uuid, full_name text, mobile text, whatsapp text, nic text,
      date_of_birth date, address text, preferred_language text);

  insert into public.policies
    (agency_id, client_id, insurer_id, policy_number, type, sum_assured, premium, frequency,
     start_date, next_due_date, renewal_date, status)
  select target_agency, x.client_id, x.insurer_id, x.policy_number, x.type, x.sum_assured, x.premium, x.frequency,
         x.start_date, x.next_due_date, x.renewal_date, x.status
    from jsonb_to_recordset(new_policies) as x(
      client_id uuid, insurer_id uuid, policy_number text, type public.policy_type,
      sum_assured numeric, premium numeric, frequency public.payment_frequency,
      start_date date, next_due_date date, renewal_date date, status public.policy_status);

  return jsonb_build_object(
    'insurers', jsonb_array_length(new_insurers),
    'clients', jsonb_array_length(new_clients),
    'policies', jsonb_array_length(new_policies));
end;
$$;

revoke all on function public.import_clients(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.import_clients(uuid, jsonb, jsonb, jsonb) to authenticated;
