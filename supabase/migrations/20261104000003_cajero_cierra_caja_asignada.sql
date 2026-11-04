begin;

revoke update on table public.cash_sessions from authenticated;
grant update (status, closed_at, closed_by, closed_by_name, closed_arqueo_id, updated_at)
  on table public.cash_sessions to authenticated;

drop policy if exists "dueños cierran sesiones de caja" on public.cash_sessions;
drop policy if exists "dueños o cajero asignado cierran sesiones" on public.cash_sessions;
create policy "dueños o cajero asignado cierran sesiones"
  on public.cash_sessions for update to authenticated
  using (
    exists (
      select 1
        from public.profiles p
       where p.id = auth.uid()
         and p.business_id = cash_sessions.business_id
         and (p.status is null or p.status = 'active')
         and (p.role = 'owner' or auth.uid() = public.admin_uid())
    )
    or (
      cash_sessions.status = 'open'
      and cash_sessions.cashier_id = auth.uid()
      and exists (
        select 1
          from public.profiles p
         where p.id = auth.uid()
           and p.business_id = cash_sessions.business_id
           and p.role = 'cashier'
           and (p.status is null or p.status = 'active')
      )
    )
  )
  with check (
    exists (
      select 1
        from public.profiles p
       where p.id = auth.uid()
         and p.business_id = cash_sessions.business_id
         and (p.status is null or p.status = 'active')
         and (p.role = 'owner' or auth.uid() = public.admin_uid())
    )
    or (
      cash_sessions.status = 'closed'
      and cash_sessions.cashier_id = auth.uid()
      and cash_sessions.closed_by = auth.uid()
      and exists (
        select 1
          from public.profiles p
         where p.id = auth.uid()
           and p.business_id = cash_sessions.business_id
           and p.role = 'cashier'
           and (p.status is null or p.status = 'active')
      )
    )
  );

drop policy if exists "dueños registran arqueos" on public.cash_arqueos;
drop policy if exists "dueños o cajero asignado registran arqueos" on public.cash_arqueos;
create policy "dueños o cajero asignado registran arqueos"
  on public.cash_arqueos for insert to authenticated
  with check (
    closed_by = auth.uid()
    and (
      exists (
        select 1
          from public.profiles p
         where p.id = auth.uid()
           and p.business_id = cash_arqueos.business_id
           and (p.status is null or p.status = 'active')
           and (p.role = 'owner' or auth.uid() = public.admin_uid())
      )
      or exists (
        select 1
          from public.cash_sessions session
          join public.profiles p on p.id = auth.uid()
         where session.id = cash_arqueos.cash_session_id
           and session.business_id = cash_arqueos.business_id
           and session.branch_id = cash_arqueos.branch_id
           and session.cashier_id = auth.uid()
           and session.status = 'open'
           and cash_arqueos.cashier_id = auth.uid()
           and p.business_id = cash_arqueos.business_id
           and p.role = 'cashier'
           and (p.status is null or p.status = 'active')
      )
    )
    and (
      cashier_id is null
      or exists (
        select 1
          from public.profiles cashier
         where cashier.id = cash_arqueos.cashier_id
           and cashier.business_id = cash_arqueos.business_id
           and cashier.role = 'cashier'
      )
    )
  );

commit;
