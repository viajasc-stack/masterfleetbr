-- LOVIX — massa de teste idempotente para validar as interfaces.
-- Contas: demo.lovix.*@example.test. Não usar em produção pública.
-- As solicitações não incluem arquivo privado; isso evita links de evidência inválidos no painel.

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  format('demo.lovix.%s@example.test', lpad(n::text, 2, '0')),
  crypt('LovixDemoOnly!2026', gen_salt('bf')),
  timezone('utc', now()),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', 'Demo LOVIX ' || n, 'email_verified', true),
  timezone('utc', now()) - make_interval(days => 40 - n),
  timezone('utc', now())
from generate_series(1, 36) n
where not exists (
  select 1
  from auth.users u
  where lower(u.email) = lower(format('demo.lovix.%s@example.test', lpad(n::text, 2, '0')))
);

with demo_profiles as (
  select p.id, row_number() over (order by u.email)::int as n
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email like 'demo.lovix.%@example.test'
)
update public.profiles p
set
  username = format('demo_lovix_%s', lpad(d.n::text, 2, '0')),
  display_name = (array['Alex', 'Bia', 'Caio', 'Duda', 'Enzo', 'Fabi', 'Gui', 'Helena', 'Igor', 'Jade', 'Kai', 'Lia'])[((d.n - 1) % 12) + 1] || ' ' || d.n,
  bio = (array['Perfil demonstrativo para validar descoberta e cards.', 'Amante de viagens, música e boas conversas.', 'Conta de teste com informações completas para a LOVIX.', 'Conhecendo novas pessoas com respeito e leveza.'])[((d.n - 1) % 4) + 1],
  city = (array['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Salvador', 'Recife'])[((d.n - 1) % 6) + 1],
  state = (array['SP', 'RJ', 'MG', 'PR', 'BA', 'PE'])[((d.n - 1) % 6) + 1],
  interests = case ((d.n - 1) % 4)
    when 0 then array['viagens', 'música', 'gastronomia']
    when 1 then array['cinema', 'dança', 'praia']
    when 2 then array['arte', 'cafés', 'fotografia']
    else array['esportes', 'trilhas', 'livros']
  end,
  profile_type = case when d.n % 7 = 0 then 'couple' else 'single' end,
  identity_label = case when d.n % 7 = 0 then 'Casal' else 'Membro LOVIX' end,
  is_profile_complete = true,
  search_visible = d.n % 11 <> 0,
  show_city = d.n % 5 <> 0,
  is_real = d.n % 3 = 0,
  is_verified = d.n % 8 = 0,
  is_premium = d.n % 4 = 0,
  premium_until = case when d.n % 4 = 0 then timezone('utc', now()) + interval '30 days' else null end,
  subscription_status = case when d.n % 4 = 0 then 'active' else 'free' end,
  moderation_status = case when d.n % 17 = 0 then 'suspended' when d.n % 13 = 0 then 'review' else 'active' end,
  created_at = timezone('utc', now()) - make_interval(days => 40 - d.n),
  updated_at = timezone('utc', now())
from demo_profiles d
where p.id = d.id;

with demo_profiles as (
  select p.id, row_number() over (order by u.email)::int as n
  from public.profiles p join auth.users u on u.id = p.id
  where u.email like 'demo.lovix.%@example.test'
), pairs as (
  select a.id as follower_id, b.id as following_id
  from demo_profiles a join demo_profiles b on a.n <> b.n
  where (a.n * 7 + b.n * 3) % 11 = 0
  limit 120
)
insert into public.follows (follower_id, following_id)
select follower_id, following_id from pairs
on conflict do nothing;

with demo_profiles as (
  select p.id, row_number() over (order by u.email)::int as n
  from public.profiles p join auth.users u on u.id = p.id
  where u.email like 'demo.lovix.%@example.test'
)
insert into public.posts (author_id, caption, location_name, privacy, moderation_status, created_at)
select
  d.id,
  'Publicação de demonstração #' || d.n || ' para validar feed, perfis e moderação.',
  (array['São Paulo, SP', 'Rio de Janeiro, RJ', 'Curitiba, PR', null])[((d.n - 1) % 4) + 1],
  (array['public','followers','following','private'])[((d.n - 1) % 4) + 1],
  case when d.n % 14 = 0 then 'review' when d.n % 19 = 0 then 'hidden' else 'active' end,
  timezone('utc', now()) - make_interval(hours => d.n * 3)
from demo_profiles d
where not exists (select 1 from public.posts p where p.author_id = d.id and p.caption like 'Publicação de demonstração #%' );

with demo_profiles as (
  select p.id, row_number() over (order by u.email)::int as n
  from public.profiles p join auth.users u on u.id = p.id
  where u.email like 'demo.lovix.%@example.test'
), demo_posts as (
  select p.id, p.author_id, row_number() over (order by p.created_at)::int as n
  from public.posts p join demo_profiles d on d.id = p.author_id
  where p.caption like 'Publicação de demonstração #%'
)
insert into public.user_reports (reporter_id, reported_user_id, post_id, reason, details, status, created_at)
select
  d.id,
  dp.author_id,
  dp.id,
  (array['spam','abuse','fake_profile','other'])[((dp.n - 1) % 4) + 1],
  'Denúncia demonstrativa para validar fila administrativa.',
  (array['open','reviewing','resolved','dismissed'])[((dp.n - 1) % 4) + 1],
  timezone('utc', now()) - make_interval(hours => dp.n * 2)
from demo_posts dp
join demo_profiles d on d.n = ((dp.n % 36) + 1)
where d.id <> dp.author_id
  and not exists (select 1 from public.user_reports r where r.post_id = dp.id and r.details = 'Denúncia demonstrativa para validar fila administrativa.');

with demo_profiles as (
  select p.id, row_number() over (order by u.email)::int as n
  from public.profiles p join auth.users u on u.id = p.id
  where u.email like 'demo.lovix.%@example.test'
)
insert into public.verification_requests (user_id, type, status, evidence_path, evidence_mime_type, evidence_expires_at, rejection_reason_public, created_at, reviewed_at)
select
  d.id,
  (array['real_profile','identity','age_18'])[((d.n - 1) % 3) + 1],
  (array['pending','in_review','approved','rejected','expired'])[((d.n - 1) % 5) + 1],
  null,
  null,
  timezone('utc', now()) + make_interval(days => case when d.n % 5 = 0 then -1 else 7 end),
  case when d.n % 5 = 4 then 'Evidência demonstrativa insuficiente para aprovação.' else null end,
  timezone('utc', now()) - make_interval(days => d.n),
  case when d.n % 5 in (3,4) then timezone('utc', now()) - make_interval(hours => d.n) else null end
from demo_profiles d
where d.n <= 24
  and not exists (select 1 from public.verification_requests v where v.user_id = d.id and v.created_at::date = (timezone('utc', now()) - make_interval(days => d.n))::date);