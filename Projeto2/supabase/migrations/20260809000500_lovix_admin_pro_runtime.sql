-- LOVIX — Admin Pro runtime: permissões granulares, settings públicos e limpeza de evidências

create or replace function public.admin_has_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.is_admin and (
      r.role = 'owner'
      or coalesce((r.permissions ->> 'all')::boolean, false)
      or coalesce((r.permissions ->> permission_key)::boolean, false)
    )
    from public.profiles p
    left join public.admin_roles r on r.user_id = p.id
    where p.id = auth.uid()
  ), false);
$$;

create or replace function public.admin_assert_permission(permission_key text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.admin_has_permission(permission_key) then
    raise exception 'Permissão administrativa insuficiente: %', permission_key;
  end if;
end;
$$;

create or replace function public.get_runtime_settings(p_keys text[] default array['content', 'premium', 'verification', 'registration'])
returns table (key text, value jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  return query
    select s.key, s.value
    from public.platform_settings s
    where s.key = any(p_keys)
      and s.key in ('content', 'premium', 'verification', 'registration');
end;
$$;

create or replace function public.admin_cleanup_expired_verification_evidence(reason_text text default 'Limpeza de evidências expiradas')
returns int
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  cleaned_count int := 0;
  request_row record;
begin
  perform public.admin_assert_permission('manageVerification');
  for request_row in
    select id, user_id, evidence_path
    from public.verification_requests
    where evidence_path is not null
      and evidence_expires_at < timezone('utc', now())
  loop
    delete from storage.objects where bucket_id = 'verification-evidence' and name = request_row.evidence_path;
    update public.verification_requests
      set evidence_path = null,
          status = case when status in ('pending', 'in_review') then 'expired' else status end,
          review_notes_private = concat_ws(E'\n', nullif(review_notes_private, ''), 'Evidência expirada removida em ' || timezone('utc', now())::text)
      where id = request_row.id;
    cleaned_count := cleaned_count + 1;
  end loop;

  perform public.admin_audit('verification_evidence_cleanup', 'verification_request', 'expired', reason_text, jsonb_build_object('cleanedCount', cleaned_count));
  return cleaned_count;
end;
$$;

create or replace function public.admin_saas_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert_permission('viewMetrics');
  return jsonb_build_object(
    'users7d', (select count(*) from public.profiles where created_at >= timezone('utc', now()) - interval '7 days'),
    'users30d', (select count(*) from public.profiles where created_at >= timezone('utc', now()) - interval '30 days'),
    'posts7d', (select count(*) from public.posts where created_at >= timezone('utc', now()) - interval '7 days'),
    'premiumConversionPct', coalesce(round(100.0 * (select count(*) from public.profiles where is_premium = true and (premium_until is null or premium_until > timezone('utc', now()))) / nullif((select count(*) from public.profiles), 0), 2), 0),
    'approvedVerificationRatePct', coalesce(round(100.0 * (select count(*) from public.verification_requests where status = 'approved') / nullif((select count(*) from public.verification_requests), 0), 2), 0),
    'avgVerificationHours', coalesce(round((select avg(extract(epoch from (reviewed_at - created_at))) / 3600 from public.verification_requests where reviewed_at is not null)::numeric, 1), 0),
    'estimatedMrrCents', coalesce((select count(*) * 1990 from public.profiles where is_premium = true and (premium_until is null or premium_until > timezone('utc', now()))), 0),
    'reportReasons', coalesce((select jsonb_object_agg(reason, total) from (select reason, count(*) as total from public.user_reports group by reason order by total desc) r), '{}'::jsonb)
  );
end;
$$;

create or replace function public.admin_update_setting(setting_key text, setting_value jsonb, reason_text text default '')
returns public.platform_settings
language plpgsql
security definer
set search_path = public
as $$
declare updated_setting public.platform_settings;
begin
  perform public.admin_assert_permission('manageSettings');
  if setting_key not in ('registration', 'content', 'premium', 'verification', 'moderation', 'trust_safety') then
    raise exception 'Configuração não permitida';
  end if;
  if setting_value is null or jsonb_typeof(setting_value) <> 'object' then
    raise exception 'Valor de configuração inválido';
  end if;
  insert into public.platform_settings (key, value, updated_by, updated_at)
  values (setting_key, setting_value, auth.uid(), timezone('utc', now()))
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at
  returning * into updated_setting;
  perform public.admin_audit('platform_setting_update', 'platform_setting', setting_key, reason_text, jsonb_build_object('value', setting_value));
  return updated_setting;
end;
$$;

create or replace function public.admin_set_role(target_user_id uuid, next_role text, permissions_value jsonb default '{}'::jsonb, reason_text text default '')
returns public.admin_roles
language plpgsql
security definer
set search_path = public
as $$
declare updated_role public.admin_roles;
begin
  perform public.admin_assert_permission('manageRoles');
  if next_role not in ('owner', 'admin', 'moderator', 'support') then raise exception 'Role administrativa inválida'; end if;
  if target_user_id = auth.uid() and next_role <> 'owner' and exists (select 1 from public.admin_roles where user_id = auth.uid() and role = 'owner') then
    raise exception 'Owner não pode reduzir a própria permissão';
  end if;
  update public.profiles set is_admin = true, updated_at = timezone('utc', now()) where id = target_user_id;
  if not found then raise exception 'Perfil não encontrado'; end if;
  insert into public.admin_roles (user_id, role, permissions, assigned_by)
  values (target_user_id, next_role, coalesce(permissions_value, '{}'::jsonb), auth.uid())
  on conflict (user_id) do update set role = excluded.role, permissions = excluded.permissions, assigned_by = excluded.assigned_by, updated_at = timezone('utc', now())
  returning * into updated_role;
  perform public.admin_audit('admin_role_set', 'profile', target_user_id::text, reason_text, jsonb_build_object('role', next_role, 'permissions', permissions_value));
  return updated_role;
end;
$$;

update public.admin_roles
set permissions = '{"all": true, "viewMetrics": true, "manageSettings": true, "manageRoles": true, "manageVerification": true, "moderateContent": true, "manageUsers": true, "viewSensitiveDetails": true}'::jsonb
where role = 'owner';

grant execute on function public.admin_has_permission(text) to authenticated;
grant execute on function public.admin_assert_permission(text) to authenticated;
grant execute on function public.get_runtime_settings(text[]) to authenticated;
grant execute on function public.admin_cleanup_expired_verification_evidence(text) to authenticated;
grant execute on function public.admin_saas_metrics() to authenticated;

revoke all on function public.admin_has_permission(text) from public, anon;
revoke all on function public.admin_assert_permission(text) from public, anon;
revoke all on function public.get_runtime_settings(text[]) from public, anon;
revoke all on function public.admin_cleanup_expired_verification_evidence(text) from public, anon;
revoke all on function public.admin_saas_metrics() from public, anon;