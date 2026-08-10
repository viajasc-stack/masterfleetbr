-- Promove o usuário existente informado para administrador LOVIX.
-- Execute no Supabase SQL Editor do projeto correto.
-- Não contém segredos.

do $$
declare
  target_user_id uuid := 'e9349e20-fdb6-4bbe-b58f-50c29205b64b';
  expected_email text := 'viajasc@gmail.com';
  target_email text;
  target_username text;
begin
  select email into target_email
  from auth.users
  where id = target_user_id;

  if target_email is null then
    raise exception 'Usuário % não encontrado em auth.users', target_user_id;
  end if;

  if lower(target_email) <> lower(expected_email) then
    raise exception 'Email divergente para %. Esperado %, encontrado %', target_user_id, expected_email, target_email;
  end if;

  select username into target_username
  from public.profiles
  where id = target_user_id;

  if target_username is null then
    target_username := 'administrador';

    if exists (select 1 from public.profiles where lower(username::text) = lower(target_username)) then
      target_username := 'admin_' || replace(left(target_user_id::text, 8), '-', '');
    end if;
  end if;

  insert into public.profiles (
    id,
    username,
    display_name,
    bio,
    profile_type,
    identity_label,
    birth_date,
    is_profile_complete,
    is_private,
    search_visible,
    show_city,
    show_online_status,
    allow_messages_from,
    invisible_mode,
    is_admin,
    moderation_status,
    accepted_terms_at,
    age_confirmed_at,
    accepted_terms_version
  ) values (
    target_user_id,
    target_username,
    'Administrador',
    'Perfil administrativo da plataforma LOVIX.',
    'single',
    'Administrador',
    date '1990-01-01',
    true,
    true,
    false,
    false,
    false,
    'none',
    true,
    true,
    'active',
    timezone('utc', now()),
    timezone('utc', now()),
    '2026-08'
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    bio = excluded.bio,
    profile_type = excluded.profile_type,
    identity_label = excluded.identity_label,
    birth_date = excluded.birth_date,
    is_profile_complete = true,
    is_private = true,
    search_visible = false,
    show_city = false,
    show_online_status = false,
    allow_messages_from = 'none',
    invisible_mode = true,
    is_admin = true,
    moderation_status = 'active',
    accepted_terms_at = coalesce(public.profiles.accepted_terms_at, excluded.accepted_terms_at),
    age_confirmed_at = coalesce(public.profiles.age_confirmed_at, excluded.age_confirmed_at),
    accepted_terms_version = coalesce(public.profiles.accepted_terms_version, excluded.accepted_terms_version),
    updated_at = timezone('utc', now());
end $$;

select
  u.email,
  p.id,
  p.username,
  p.display_name,
  p.is_admin,
  p.is_profile_complete,
  p.search_visible
from public.profiles p
join auth.users u on u.id = p.id
where p.id = 'e9349e20-fdb6-4bbe-b58f-50c29205b64b';