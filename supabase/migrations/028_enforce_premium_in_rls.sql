-- Enforce premium limits at the database level (previously client-side only).
-- Applied to production 2026-10-28.

-- P9A records are premium-only (free plan: p9aGenerator / p9aPersonal = false).
drop policy if exists p9a_records_insert on public.p9a_records;
create policy p9a_records_insert on public.p9a_records
  for insert to public
  with check (auth.uid() = user_id and public.check_premium_active(auth.uid()));

drop policy if exists p9a_records_update on public.p9a_records;
create policy p9a_records_update on public.p9a_records
  for update to public
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.check_premium_active(auth.uid()));

-- Employees: free plan limited to 2; premium unlimited.
-- Count goes through a SECURITY DEFINER helper: counting inside the policy
-- itself raises "infinite recursion detected in policy".
create or replace function public.employer_employee_count(p_employer_id uuid)
returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.employees where employer_id = p_employer_id;
$$;
revoke all on function public.employer_employee_count(uuid) from public, anon;
grant execute on function public.employer_employee_count(uuid) to authenticated, service_role;

drop policy if exists employees_insert_owner on public.employees;
create policy employees_insert_owner on public.employees
  for insert to authenticated
  with check (
    (select auth.uid()) = employer_id
    and (
      public.check_premium_active((select auth.uid()))
      or public.employer_employee_count((select auth.uid())) < 2
    )
  );
