-- Search clients by phone number however it was typed ("077 123 4567",
-- "0771234567", "+94 77 123 4567" all match "0771234567").

alter table public.clients
  add column mobile_digits text generated always as (regexp_replace(mobile, '\D', '', 'g')) stored;

create index clients_agency_mobile_digits_idx on public.clients (agency_id, mobile_digits);
create index policies_agency_number_idx on public.policies (agency_id, lower(policy_number));
