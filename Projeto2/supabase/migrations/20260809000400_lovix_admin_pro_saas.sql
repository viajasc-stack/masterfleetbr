-- LOVIX — Admin Pro SaaS: configurações, roles e detalhes operacionais

create table if not exists public.admin_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin', 'moderator', 'support')),
  permissions jsonb not null default '{}'::jsonb,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists admin_roles_set_updated_at on public.admin_roles;
create trigger admin_roles_set_updated_at before update on public.admin_roles
  for each row execute procedure public.set_updated_at();

alter table public.admin_roles enable row level security;

drop policy if exists "admins read roles" on public.admin_roles;
create policy "admins read roles" on public.admin_roles for select to authenticated using (public.is_admin());

drop policy if exists "owners manage roles" on public.admin_roles;
create policy "owners manage roles" on public.admin_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.admin_roles (user_id, role, permissions)
select id, 'owner', '{"all": true}'::jsonb from public.profiles where is_admin = true
on conflict (user_id) do nothing;

insert into public.platform_settings (key, value)
values
  ('verification', '{"enabled": true, "evidenceRetentionDays": 7, "maxEvidenceMb": 10, "allowVideoEvidence": true}'::jsonb),
  ('moderation', '{"autoHideReportedThreshold": 5, "requireReasonForActions": true, "queuePriorityHours": 24}'::jsonb),
  ('trust_safety', '{"manualReviewRequiredForVerification": true, "auditEvidenceAccess": true, "privateEvidenceOnly": true}'::jsonb)
on conflict (key) do nothing;

create or replace function public.admin_list_settings()
returns table (
  key text,
  value jsonb,
  updated_by uuid,
  updated_by_username citext,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return query
    select s.key, s.value, s.updated_by, p.username, s.updated_at
    from public.platform_settings s
    left join public.profiles p on p.id = s.updated_by
    order by s.key asc;
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
  perform public.admin_assert();
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

create or replace function public.admin_list_roles()
returns table (
  user_id uuid,
  username citext,
  display_name text,
  avatar_url text,
  role text,
  permissions jsonb,
  assigned_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return query
    select r.user_id, p.username, p.display_name, p.avatar_url, r.role, r.permissions, r.assigned_by, r.created_at, r.updated_at
    from public.admin_roles r
    join public.profiles p on p.id = r.user_id
    order by case r.role when 'owner' then 1 when 'admin' then 2 when 'moderator' then 3 else 4 end, p.username asc;
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
  perform public.admin_assert();
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

create or replace function public.admin_get_user_detail(target_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return jsonb_build_object(
    'profile', (select to_jsonb(p) - 'birth_date' from public.profiles p where p.id = target_user_id),
    'counts', jsonb_build_object(
      'posts', (select count(*) from public.posts where author_id = target_user_id),
      'reportsReceived', (select count(*) from public.user_reports where reported_user_id = target_user_id),
      'reportsSubmitted', (select count(*) from public.user_reports where reporter_id = target_user_id),
      'verificationRequests', (select count(*) from public.verification_requests where user_id = target_user_id),
      'payments', (select count(*) from public.payments where user_id = target_user_id)
    ),
    'recentVerifications', coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from (select id, type, status, evidence_expires_at, reviewed_at, created_at from public.verification_requests where user_id = target_user_id order by created_at desc limit 5) v), '[]'::jsonb),
    'recentReports', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (select id, reason, status, post_id, created_at from public.user_reports where reported_user_id = target_user_id or reporter_id = target_user_id order by created_at desc limit 5) r), '[]'::jsonb),
    'subscriptions', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc) from (select id, status, starts_at, expires_at, created_at from public.subscriptions where user_id = target_user_id order by created_at desc limit 3) s), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_get_post_detail(post_uuid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return jsonb_build_object(
    'post', (select to_jsonb(p) from public.posts p where p.id = post_uuid),
    'author', (select to_jsonb(a) - 'birth_date' from public.profiles a join public.posts p on p.author_id = a.id where p.id = post_uuid),
    'media', coalesce((select jsonb_agg(to_jsonb(m) order by m.position) from public.post_media m where m.post_id = post_uuid), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (select id, reporter_id, reason, details, status, created_at from public.user_reports where post_id = post_uuid order by created_at desc limit 10) r), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_get_verification_detail(request_uuid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return jsonb_build_object(
    'request', (select to_jsonb(v) from public.verification_requests v where v.id = request_uuid),
    'profile', (select to_jsonb(p) - 'birth_date' from public.profiles p join public.verification_requests v on v.user_id = p.id where v.id = request_uuid),
    'audit', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from (select id, admin_id, action, reason, created_at from public.admin_audit_logs where target_type = 'verification_request' and target_id = request_uuid::text order by created_at desc limit 10) l), '[]'::jsonb)
  );
end;
$$;

grant select, insert, update, delete on public.admin_roles to authenticated;
grant execute on function public.admin_list_settings() to authenticated;
grant execute on function public.admin_update_setting(text, jsonb, text) to authenticated;
grant execute on function public.admin_list_roles() to authenticated;
grant execute on function public.admin_set_role(uuid, text, jsonb, text) to authenticated;
grant execute on function public.admin_get_user_detail(uuid) to authenticated;
grant execute on function public.admin_get_post_detail(uuid) to authenticated;
grant execute on function public.admin_get_verification_detail(uuid) to authenticated;

revoke all on public.admin_roles from public, anon;
revoke all on function public.admin_list_settings() from public, anon;
revoke all on function public.admin_update_setting(text, jsonb, text) from public, anon;
revoke all on function public.admin_list_roles() from public, anon;
revoke all on function public.admin_set_role(uuid, text, jsonb, text) from public, anon;
revoke all on function public.admin_get_user_detail(uuid) from public, anon;
revoke all on function public.admin_get_post_detail(uuid) from public, anon;
revoke all on function public.admin_get_verification_detail(uuid) from public, anon;