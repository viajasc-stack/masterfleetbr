-- LOVIX — painel administrativo e privacidade "apenas quem eu sigo"

alter table public.posts drop constraint if exists posts_privacy_check;
alter table public.posts add constraint posts_privacy_check
  check (privacy in ('public', 'followers', 'following', 'private'));

drop policy if exists "visible posts are readable" on public.posts;
create policy "visible posts are readable"
  on public.posts for select to authenticated
  using (
    public.is_admin()
    or (
      moderation_status = 'active'
      and (
        privacy = 'public'
        or author_id = auth.uid()
        or (privacy = 'followers' and public.is_following(author_id))
        or (privacy = 'following' and public.is_following(auth.uid(), author_id))
      )
    )
  );

create or replace function public.admin_assert()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo obrigatório';
  end if;
end;
$$;

create or replace function public.admin_audit(action_name text, target_type_name text, target_identifier text, reason_text text default '', metadata_value jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  insert into public.admin_audit_logs (admin_id, action, target_type, target_id, reason, metadata)
  values (auth.uid(), action_name, target_type_name, target_identifier, coalesce(reason_text, ''), coalesce(metadata_value, '{}'::jsonb));
end;
$$;

create or replace function public.admin_dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return jsonb_build_object(
    'usersTotal', (select count(*) from public.profiles),
    'usersActive', (select count(*) from public.profiles where moderation_status = 'active'),
    'usersSuspended', (select count(*) from public.profiles where moderation_status = 'suspended'),
    'usersBanned', (select count(*) from public.profiles where moderation_status = 'banned'),
    'premiumActive', (select count(*) from public.profiles where is_premium = true and (premium_until is null or premium_until > timezone('utc', now()))),
    'postsTotal', (select count(*) from public.posts),
    'postsReview', (select count(*) from public.posts where moderation_status = 'review'),
    'postsRemoved', (select count(*) from public.posts where moderation_status = 'removed'),
    'reportsOpen', (select count(*) from public.user_reports where status in ('open', 'reviewing'))
  );
end;
$$;

create or replace function public.admin_list_profiles(p_query text default '', p_limit int default 60)
returns table (
  id uuid,
  username citext,
  display_name text,
  avatar_url text,
  city text,
  state text,
  is_admin boolean,
  is_real boolean,
  is_verified boolean,
  is_premium boolean,
  premium_until timestamptz,
  subscription_status text,
  moderation_status text,
  banned_at timestamptz,
  ban_reason text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return query
    select p.id, p.username, p.display_name, p.avatar_url, p.city, p.state, p.is_admin, p.is_real, p.is_verified, p.is_premium, p.premium_until, p.subscription_status, p.moderation_status, p.banned_at, p.ban_reason, p.created_at
    from public.profiles p
    where coalesce(trim(p_query), '') = ''
       or p.username::text ilike '%' || trim(p_query) || '%'
       or p.display_name ilike '%' || trim(p_query) || '%'
       or p.city ilike '%' || trim(p_query) || '%'
    order by p.created_at desc
    limit least(greatest(coalesce(p_limit, 60), 1), 200);
end;
$$;

create or replace function public.admin_set_user_status(target_user_id uuid, next_status text, reason_text text default '')
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  perform public.admin_assert();
  if next_status not in ('active', 'review', 'suspended', 'banned') then
    raise exception 'Status inválido';
  end if;
  if target_user_id = auth.uid() and next_status in ('suspended', 'banned') then
    raise exception 'Um administrador não pode suspender/banir a si mesmo';
  end if;

  update public.profiles
  set moderation_status = next_status,
      banned_at = case when next_status = 'banned' then timezone('utc', now()) else null end,
      ban_reason = case when next_status in ('suspended', 'banned') then coalesce(reason_text, '') else null end,
      updated_at = timezone('utc', now())
  where id = target_user_id
  returning * into updated_profile;

  if updated_profile.id is null then raise exception 'Perfil não encontrado'; end if;
  perform public.admin_audit('user_status_' || next_status, 'profile', target_user_id::text, reason_text, jsonb_build_object('status', next_status));
  return updated_profile;
end;
$$;

create or replace function public.admin_set_profile_flags(target_user_id uuid, p_is_real boolean default null, p_is_verified boolean default null)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare updated_profile public.profiles;
begin
  perform public.admin_assert();
  update public.profiles
  set is_real = coalesce(p_is_real, is_real),
      is_verified = coalesce(p_is_verified, is_verified),
      updated_at = timezone('utc', now())
  where id = target_user_id
  returning * into updated_profile;
  if updated_profile.id is null then raise exception 'Perfil não encontrado'; end if;
  perform public.admin_audit('profile_flags_update', 'profile', target_user_id::text, '', jsonb_build_object('isReal', updated_profile.is_real, 'isVerified', updated_profile.is_verified));
  return updated_profile;
end;
$$;

create or replace function public.admin_grant_premium(target_user_id uuid, days_count int, reason_text text default '')
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare updated_profile public.profiles;
begin
  perform public.admin_assert();
  if days_count not in (30, 60, 90) then raise exception 'Prazo Premium inválido'; end if;
  update public.profiles
  set is_premium = true,
      premium_until = timezone('utc', now()) + make_interval(days => days_count),
      subscription_status = 'active',
      updated_at = timezone('utc', now())
  where id = target_user_id
  returning * into updated_profile;
  if updated_profile.id is null then raise exception 'Perfil não encontrado'; end if;
  perform public.admin_audit('premium_grant', 'profile', target_user_id::text, reason_text, jsonb_build_object('days', days_count, 'premiumUntil', updated_profile.premium_until));
  return updated_profile;
end;
$$;

create or replace function public.admin_revoke_premium(target_user_id uuid, reason_text text default '')
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare updated_profile public.profiles;
begin
  perform public.admin_assert();
  update public.profiles
  set is_premium = false,
      premium_until = null,
      subscription_status = 'cancelled',
      updated_at = timezone('utc', now())
  where id = target_user_id
  returning * into updated_profile;
  if updated_profile.id is null then raise exception 'Perfil não encontrado'; end if;
  perform public.admin_audit('premium_revoke', 'profile', target_user_id::text, reason_text, '{}'::jsonb);
  return updated_profile;
end;
$$;

create or replace function public.admin_list_reports(p_status text default null, p_limit int default 80)
returns table (
  id uuid,
  reporter_id uuid,
  reporter_username citext,
  reported_user_id uuid,
  reported_username citext,
  post_id uuid,
  reason text,
  details text,
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return query
    select r.id, r.reporter_id, reporter.username, r.reported_user_id, reported.username, r.post_id, r.reason, r.details, r.status, r.created_at
    from public.user_reports r
    left join public.profiles reporter on reporter.id = r.reporter_id
    left join public.profiles reported on reported.id = r.reported_user_id
    where p_status is null or r.status = p_status
    order by r.created_at desc
    limit least(greatest(coalesce(p_limit, 80), 1), 200);
end;
$$;

create or replace function public.admin_resolve_report(report_uuid uuid, next_status text, reason_text text default '')
returns public.user_reports
language plpgsql
security definer
set search_path = public
as $$
declare updated_report public.user_reports;
begin
  perform public.admin_assert();
  if next_status not in ('open', 'reviewing', 'resolved', 'dismissed') then raise exception 'Status de denúncia inválido'; end if;
  update public.user_reports
  set status = next_status,
      resolved_by = case when next_status in ('resolved', 'dismissed') then auth.uid() else resolved_by end,
      resolved_at = case when next_status in ('resolved', 'dismissed') then timezone('utc', now()) else null end
  where id = report_uuid
  returning * into updated_report;
  if updated_report.id is null then raise exception 'Denúncia não encontrada'; end if;
  perform public.admin_audit('report_' || next_status, 'report', report_uuid::text, reason_text, jsonb_build_object('status', next_status));
  return updated_report;
end;
$$;

create or replace function public.admin_list_posts(p_status text default null, p_privacy text default null, p_limit int default 80)
returns table (
  id uuid,
  author_id uuid,
  author_username citext,
  author_display_name text,
  caption text,
  privacy text,
  moderation_status text,
  likes_count integer,
  comments_count integer,
  media_count bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return query
    select p.id, p.author_id, author.username, author.display_name, p.caption, p.privacy, p.moderation_status, p.likes_count, p.comments_count, count(media.id), p.created_at
    from public.posts p
    join public.profiles author on author.id = p.author_id
    left join public.post_media media on media.post_id = p.id
    where (p_status is null or p.moderation_status = p_status)
      and (p_privacy is null or p.privacy = p_privacy)
    group by p.id, author.username, author.display_name
    order by p.created_at desc
    limit least(greatest(coalesce(p_limit, 80), 1), 200);
end;
$$;

create or replace function public.admin_set_post_moderation(post_uuid uuid, next_status text, reason_text text default '')
returns public.posts
language plpgsql
security definer
set search_path = public
as $$
declare updated_post public.posts;
begin
  perform public.admin_assert();
  if next_status not in ('active', 'review', 'hidden', 'removed') then raise exception 'Status de publicação inválido'; end if;
  update public.posts
  set moderation_status = next_status,
      hidden_reason = case when next_status in ('hidden', 'removed', 'review') then coalesce(reason_text, '') else null end,
      updated_at = timezone('utc', now())
  where id = post_uuid
  returning * into updated_post;
  if updated_post.id is null then raise exception 'Publicação não encontrada'; end if;
  perform public.admin_audit('post_' || next_status, 'post', post_uuid::text, reason_text, jsonb_build_object('status', next_status));
  return updated_post;
end;
$$;

create or replace function public.admin_list_audit_logs(p_limit int default 100)
returns table (
  id uuid,
  admin_id uuid,
  admin_username citext,
  action text,
  target_type text,
  target_id text,
  reason text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return query
    select l.id, l.admin_id, admin.username, l.action, l.target_type, l.target_id, l.reason, l.metadata, l.created_at
    from public.admin_audit_logs l
    left join public.profiles admin on admin.id = l.admin_id
    order by l.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 300);
end;
$$;

grant execute on function public.admin_assert() to authenticated;
grant execute on function public.admin_dashboard_metrics() to authenticated;
grant execute on function public.admin_list_profiles(text, int) to authenticated;
grant execute on function public.admin_set_user_status(uuid, text, text) to authenticated;
grant execute on function public.admin_set_profile_flags(uuid, boolean, boolean) to authenticated;
grant execute on function public.admin_grant_premium(uuid, int, text) to authenticated;
grant execute on function public.admin_revoke_premium(uuid, text) to authenticated;
grant execute on function public.admin_list_reports(text, int) to authenticated;
grant execute on function public.admin_resolve_report(uuid, text, text) to authenticated;
grant execute on function public.admin_list_posts(text, text, int) to authenticated;
grant execute on function public.admin_set_post_moderation(uuid, text, text) to authenticated;
grant execute on function public.admin_list_audit_logs(int) to authenticated;

revoke all on function public.admin_assert() from public, anon;
revoke all on function public.admin_audit(text, text, text, text, jsonb) from public, anon;
revoke all on function public.admin_dashboard_metrics() from public, anon;
revoke all on function public.admin_list_profiles(text, int) from public, anon;
revoke all on function public.admin_set_user_status(uuid, text, text) from public, anon;
revoke all on function public.admin_set_profile_flags(uuid, boolean, boolean) from public, anon;
revoke all on function public.admin_grant_premium(uuid, int, text) from public, anon;
revoke all on function public.admin_revoke_premium(uuid, text) from public, anon;
revoke all on function public.admin_list_reports(text, int) from public, anon;
revoke all on function public.admin_resolve_report(uuid, text, text) from public, anon;
revoke all on function public.admin_list_posts(text, text, int) from public, anon;
revoke all on function public.admin_set_post_moderation(uuid, text, text) from public, anon;
revoke all on function public.admin_list_audit_logs(int) from public, anon;