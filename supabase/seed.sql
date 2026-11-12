-- Demo data: the made-up clients from the Figma mockups.
-- Never put real client data in this file or anywhere in the repo.
--
-- Usage (SQL editor, after creating your user):
--   select public.seed_demo_data(
--     (select agency_id from public.agency_members
--      where user_id = (select id from auth.users where email = 'you@example.com'))
--   );
--
-- Dates are relative to today, so the dashboard always has something to show.

create or replace function public.seed_demo_data(target_agency uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Colombo')::date;
  lanka_life uuid; ceylon_general uuid; union_care uuid;
  nimal uuid; kumari uuid; ruwan uuid; dilani uuid; chaminda uuid; sanduni uuid; tharindu uuid;
begin
  insert into public.insurers (agency_id, name, branch) values
    (target_agency, 'Lanka Life Assurance', 'Kandy') returning id into lanka_life;
  insert into public.insurers (agency_id, name, branch) values
    (target_agency, 'Ceylon General Insurance', 'Kandy') returning id into ceylon_general;
  insert into public.insurers (agency_id, name, branch) values
    (target_agency, 'Union Care Health', 'Peradeniya') returning id into union_care;

  insert into public.clients (agency_id, full_name, mobile, nic, date_of_birth, address)
    values (target_agency, 'Nimal Perera', '077 123 4567', '791234123V', '1979-03-14', '12 Temple Road, Kandy')
    returning id into nimal;
  insert into public.clients (agency_id, full_name, mobile, date_of_birth, address)
    values (target_agency, 'Kumari Silva', '071 234 5678', '1985-07-02', '45 Lake View, Kandy')
    returning id into kumari;
  insert into public.clients (agency_id, full_name, mobile, date_of_birth)
    values (target_agency, 'Ruwan Fernando', '076 345 6789', '1990-11-30')
    returning id into ruwan;
  insert into public.clients (agency_id, full_name, mobile, date_of_birth)
    values (target_agency, 'Dilani Jayasinghe', '070 456 7890',
            (today - interval '42 years')::date)        -- birthday today
    returning id into dilani;
  insert into public.clients (agency_id, full_name, mobile)
    values (target_agency, 'Chaminda Bandara', '072 567 8901')
    returning id into chaminda;
  insert into public.clients (agency_id, full_name, mobile, whatsapp)
    values (target_agency, 'Sanduni Wickramasinghe', '075 678 9012', '075 000 1122')
    returning id into sanduni;
  insert into public.clients (agency_id, full_name, mobile, date_of_birth)
    values (target_agency, 'Tharindu Gunasekara', '078 789 0123', '1994-02-18')
    returning id into tharindu;

  insert into public.family_members (agency_id, client_id, full_name, relationship, date_of_birth) values
    (target_agency, nimal, 'Malini Perera', 'wife', '1982-06-03'),
    (target_agency, nimal, 'Kasun Perera', 'son', '2007-01-21'),
    (target_agency, nimal, 'Nethmi Perera', 'daughter', '2012-09-09');

  -- Start dates are counted back from the due and renewal dates, so the
  -- demo follows the same rule as real policies: payments fall on the
  -- start date's day of the month.
  insert into public.policies
    (agency_id, client_id, insurer_id, policy_number, type, sum_assured, premium, frequency, start_date, next_due_date, renewal_date, status)
  values
    (target_agency, nimal,    lanka_life,     'LL-2024-08812', 'life',     1500000, 4500,  'monthly',   (today + 2 - interval '32 months')::date,  today + 2,  null,       'active'),
    (target_agency, nimal,    ceylon_general, 'CG-M-55120',    'motor',    null,    38400, 'yearly',    (today + 22 - interval '3 years')::date,   null,       today + 22, 'active'),
    (target_agency, kumari,   lanka_life,     'LL-2022-03144', 'life',     1000000, 4500,  'monthly',   (today + 2 - interval '54 months')::date,  today + 2,  null,       'active'),
    (target_agency, ruwan,    ceylon_general, 'CG-M-60218',    'motor',    null,    12800, 'quarterly', (today - 5 - interval '21 months')::date,  today - 5,  (today - 5 - interval '21 months' + interval '2 years')::date, 'active'),
    (target_agency, dilani,   lanka_life,     'LL-2021-11902', 'life',     2000000, 6200,  'monthly',   (today + 10 - interval '63 months')::date, today + 10, null,       'active'),
    (target_agency, dilani,   union_care,     'UC-H-7731',     'health',   500000,  21000, 'yearly',    (today + 66 - interval '2 years')::date,   null,       today + 66, 'active'),
    (target_agency, chaminda, ceylon_general, 'CG-P-1290',     'property', 8000000, 15500, 'yearly',    (today + 203 - interval '1 year')::date,   null,       today + 203,'active'),
    (target_agency, sanduni,  ceylon_general, 'CG-M-48810',    'motor',    null,    29900, 'yearly',    '2022-04-10',                              null,       null,       'lapsed'),
    (target_agency, tharindu, union_care,     'UC-H-8120',     'health',   750000,  18500, 'yearly',    (today + 18 - interval '2 years')::date,   null,       today + 18, 'active');

  insert into public.follow_ups (agency_id, client_id, due_date, note) values
    (target_agency, chaminda, today, 'Call back about home insurance quote'),
    (target_agency, nimal, today + 6, 'Send health plan quote for Kasun before university');

  insert into public.client_notes (agency_id, client_id, body, created_at) values
    (target_agency, nimal, 'Prefers WhatsApp messages after 6 pm on weekdays.', now() - interval '87 days'),
    (target_agency, nimal, 'Paid the motor premium in cash at the branch. Receipt is in Documents.', now() - interval '39 days'),
    (target_agency, nimal, 'Asked about a health plan for Kasun before university. Send a quote next week.', now());
end;
$$;

-- Only runnable from the SQL editor, never from the app.
revoke all on function public.seed_demo_data(uuid) from public, anon, authenticated;
