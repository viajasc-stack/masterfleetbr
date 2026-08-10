-- LOVIX — fundação do banco de dados
-- Esta migration recria o produto como uma plataforma social adulta (18+),
-- com regras de privacidade, moderação, conteúdo e assinatura preparadas.

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;

-- -------------------------------------------------------------------------
-- Funções de infraestrutura
-- -------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext not null,
  display_name text not null default '',
  bio text not null default '' check (char_length(bio) <= 500),
  avatar_url text,
  cover_url text,
  profile_type text not null default 'single'
    check (profile_type in ('single', 'couple')),
  identity_label text not null default '',
  city text,
  state text,
  interests text[] not null default '{}',
  birth_date date,
  is_profile_complete boolean not null default false,
  is_private boolean not null default false,
  search_visible boolean not null default true,
  show_city boolean not null default true,
  show_online_status boolean not null default true,
  allow_messages_from text not null default 'premium'
    check (allow_messages_from in ('everyone', 'premium', 'followers', 'none')),
  invisible_mode boolean not null default false,
  is_online boolean not null default false,
  last_seen_at timestamptz,
  is_real boolean not null default false,
  is_verified boolean not null default false,
  is_premium boolean not null default false,
  premium_until timestamptz,
  subscription_status text not null default 'free'
    check (subscription_status in ('free', 'pending', 'active', 'expired', 'cancelled')),
  is_admin boolean not null default false,
  accepted_terms_at timestamptz,
  age_confirmed_at timestamptz,
  accepted_terms_version text,
  moderation_status text not null default 'active'
    check (moderation_status in ('active', 'review', 'suspended', 'banned')),
  banned_at timestamptz,
  ban_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_length check (char_length(username::text) between 3 and 30),
  constraint profiles_username_format check (username::text ~ '^[a-zA-Z0-9_]+$')
);

create unique index profiles_username_key on public.profiles (lower(username::text));
create index profiles_discovery_idx on public.profiles (search_visible, moderation_status, is_premium desc, last_seen_at desc);
create index profiles_city_idx on public.profiles (state, city);
create index profiles_interests_idx on public.profiles using gin (interests);
create index profiles_username_trgm_idx on public.profiles using gin ((username::text) gin_trgm_ops);

-- Isolamos verificações privilegiadas em funções security definer para evitar
-- dependência circular das policies da própria tabela profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_premium_user(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select is_premium
      and (premium_until is null or premium_until > timezone('utc', now()))
    from public.profiles
    where id = user_id
  ), false);
$$;

-- -------------------------------------------------------------------------
-- Social graph and content
-- -------------------------------------------------------------------------

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on public.follows (following_id, created_at desc);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 2200),
  location_name text,
  privacy text not null default 'public'
    check (privacy in ('public', 'followers', 'private')),
  comments_enabled boolean not null default true,
  likes_count integer not null default 0 check (likes_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  moderation_status text not null default 'active'
    check (moderation_status in ('active', 'review', 'hidden', 'removed')),
  hidden_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index posts_feed_idx on public.posts (created_at desc) where moderation_status = 'active';
create index posts_author_idx on public.posts (author_id, created_at desc);

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_path text not null,
  media_type text not null check (media_type in ('image', 'video')),
  position smallint not null default 0 check (position >= 0 and position < 10),
  alt_text text not null default '' check (char_length(alt_text) <= 250),
  aspect_ratio numeric(6, 3),
  created_at timestamptz not null default timezone('utc', now()),
  unique (post_id, position)
);
create index post_media_post_idx on public.post_media (post_id, position);

create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, post_id)
);
create index likes_post_idx on public.likes (post_id, created_at desc);

create table public.saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, post_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  moderation_status text not null default 'active'
    check (moderation_status in ('active', 'hidden', 'removed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index comments_post_idx on public.comments (post_id, created_at asc);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  privacy text not null default 'public' check (privacy in ('public', 'followers')),
  duration_seconds smallint,
  moderation_status text not null default 'active'
    check (moderation_status in ('active', 'review', 'hidden', 'removed')),
  expires_at timestamptz not null default timezone('utc', now()) + interval '24 hours',
  created_at timestamptz not null default timezone('utc', now())
);
create index stories_active_idx on public.stories (expires_at desc) where moderation_status = 'active';

create table public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (story_id, viewer_id)
);

-- -------------------------------------------------------------------------
-- Messaging, safety and notifications
-- -------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  member_low_id uuid not null references public.profiles(id) on delete cascade,
  member_high_id uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (member_low_id, member_high_id),
  check (member_low_id < member_high_id)
);
create index conversations_recent_idx on public.conversations (last_message_at desc nulls last);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  attachment_path text,
  attachment_type text check (attachment_type in ('image', 'audio')),
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check (char_length(body) > 0 or attachment_path is not null)
);
create index direct_messages_conversation_idx on public.direct_messages (conversation_id, created_at asc);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function public.is_following(target_user_id uuid, viewer_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.follows
    where follower_id = viewer_user_id and following_id = target_user_id
  );
$$;

create or replace function public.are_blocked_between(first_user_id uuid, second_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = first_user_id and blocked_id = second_user_id)
       or (blocker_id = second_user_id and blocked_id = first_user_id)
  );
$$;

-- Atualização do perfil é feita exclusivamente por esta RPC. Isso impede que
-- clientes alterem campos privilegiados como is_admin, is_premium, selo REAL
-- ou status de moderação usando um update genérico da tabela profiles.
create or replace function public.update_my_profile(
  p_username text default null,
  p_display_name text default null,
  p_bio text default null,
  p_avatar_url text default null,
  p_cover_url text default null,
  p_profile_type text default null,
  p_identity_label text default null,
  p_city text default null,
  p_state text default null,
  p_interests text[] default null,
  p_birth_date date default null,
  p_is_private boolean default null,
  p_search_visible boolean default null,
  p_show_city boolean default null,
  p_show_online_status boolean default null,
  p_allow_messages_from text default null,
  p_invisible_mode boolean default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória';
  end if;

  if p_profile_type is not null and p_profile_type not in ('single', 'couple') then
    raise exception 'Tipo de perfil inválido';
  end if;
  if p_allow_messages_from is not null and p_allow_messages_from not in ('everyone', 'premium', 'followers', 'none') then
    raise exception 'Preferência de mensagens inválida';
  end if;
  if p_birth_date is not null and p_birth_date > current_date - interval '18 years' then
    raise exception 'O LOVIX é exclusivo para maiores de 18 anos';
  end if;

  update public.profiles
  set username = coalesce(nullif(trim(p_username), ''), username),
      display_name = coalesce(trim(p_display_name), display_name),
      bio = coalesce(p_bio, bio),
      avatar_url = coalesce(nullif(trim(p_avatar_url), ''), avatar_url),
      cover_url = coalesce(nullif(trim(p_cover_url), ''), cover_url),
      profile_type = coalesce(p_profile_type, profile_type),
      identity_label = coalesce(trim(p_identity_label), identity_label),
      city = coalesce(nullif(trim(p_city), ''), city),
      state = coalesce(nullif(trim(p_state), ''), state),
      interests = coalesce(p_interests, interests),
      birth_date = coalesce(p_birth_date, birth_date),
      is_private = coalesce(p_is_private, is_private),
      search_visible = coalesce(p_search_visible, search_visible),
      show_city = coalesce(p_show_city, show_city),
      show_online_status = coalesce(p_show_online_status, show_online_status),
      allow_messages_from = coalesce(p_allow_messages_from, allow_messages_from),
      invisible_mode = coalesce(p_invisible_mode, invisible_mode),
      is_profile_complete = case
        when coalesce(nullif(trim(p_username), ''), username) <> ''
         and coalesce(trim(p_display_name), display_name) <> ''
         and coalesce(p_birth_date, birth_date) is not null
         and coalesce(p_birth_date, birth_date) <= current_date - interval '18 years'
         and coalesce(p_profile_type, profile_type) in ('single', 'couple')
         and coalesce(trim(p_identity_label), identity_label) <> ''
        then true else is_profile_complete
      end
  where id = auth.uid()
  returning * into updated_profile;

  return updated_profile;
end;
$$;

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  reason text not null check (reason in ('fake_profile', 'abuse', 'underage', 'spam', 'illegal_content', 'non_consensual', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check (reported_user_id is not null or post_id is not null)
);
create index reports_status_idx on public.user_reports (status, created_at asc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('follow', 'like', 'comment', 'message', 'system')),
  post_id uuid references public.posts(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);
create index notifications_recipient_idx on public.notifications (recipient_id, is_read, created_at desc);

-- -------------------------------------------------------------------------
-- Premium, administration and audit
-- -------------------------------------------------------------------------

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  duration_days integer not null check (duration_days > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  provider text not null default 'mercado_pago',
  external_payment_id text unique,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled', 'expired', 'refunded')),
  pix_copy_paste text,
  pix_qr_code_base64 text,
  expires_at timestamptz,
  approved_at timestamptz,
  provider_payload jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index payments_user_idx on public.payments (user_id, created_at desc);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  payment_id uuid unique references public.payments(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  starts_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (expires_at > starts_at)
);
create index subscriptions_user_idx on public.subscriptions (user_id, status, expires_at desc);

create table public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  reason text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create index admin_audit_logs_recent_idx on public.admin_audit_logs (created_at desc);

-- -------------------------------------------------------------------------
-- Triggers de domínio
-- -------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_username text;
begin
  safe_username := 'user_' || replace(substring(new.id::text from 1 for 8), '-', '');

  insert into public.profiles (
    id,
    username,
    display_name,
    accepted_terms_at,
    age_confirmed_at,
    accepted_terms_version
  ) values (
    new.id,
    safe_username,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), ''),
    nullif(new.raw_user_meta_data ->> 'accepted_terms_at', '')::timestamptz,
    nullif(new.raw_user_meta_data ->> 'age_confirmed_at', '')::timestamptz,
    nullif(new.raw_user_meta_data ->> 'accepted_terms_version', '')
  ) on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.refresh_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set likes_count = (select count(*) from public.likes where post_id = coalesce(new.post_id, old.post_id))
  where id = coalesce(new.post_id, old.post_id);
  return coalesce(new, old);
end;
$$;

create or replace function public.refresh_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set comments_count = (select count(*) from public.comments where post_id = coalesce(new.post_id, old.post_id) and moderation_status = 'active')
  where id = coalesce(new.post_id, old.post_id);
  return coalesce(new, old);
end;
$$;

create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at,
      updated_at = timezone('utc', now())
  where id = new.conversation_id;
  return new;
end;
$$;

create or replace function public.activate_premium_from_payment(payment_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.payments%rowtype;
  plan_row public.subscription_plans%rowtype;
  starts_at_value timestamptz := timezone('utc', now());
  expires_at_value timestamptz;
begin
  select * into payment_row from public.payments where id = payment_uuid;
  if not found or payment_row.status <> 'approved' then
    raise exception 'Pagamento aprovado não encontrado';
  end if;

  select * into plan_row from public.subscription_plans where id = payment_row.plan_id;
  if not found then raise exception 'Plano não encontrado'; end if;

  expires_at_value := starts_at_value + make_interval(days => plan_row.duration_days);

  insert into public.subscriptions (user_id, plan_id, payment_id, starts_at, expires_at)
  values (payment_row.user_id, payment_row.plan_id, payment_row.id, starts_at_value, expires_at_value)
  on conflict (payment_id) do nothing;

  update public.profiles
  set is_premium = true,
      premium_until = greatest(coalesce(premium_until, starts_at_value), expires_at_value),
      subscription_status = 'active',
      updated_at = timezone('utc', now())
  where id = payment_row.user_id;
end;
$$;

create trigger likes_refresh_post_count
  after insert or delete on public.likes
  for each row execute procedure public.refresh_post_like_count();
create trigger comments_refresh_post_count
  after insert or delete or update of moderation_status on public.comments
  for each row execute procedure public.refresh_post_comment_count();
create trigger messages_touch_conversation
  after insert on public.direct_messages
  for each row execute procedure public.touch_conversation();

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger posts_set_updated_at before update on public.posts
  for each row execute procedure public.set_updated_at();
create trigger comments_set_updated_at before update on public.comments
  for each row execute procedure public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations
  for each row execute procedure public.set_updated_at();
create trigger subscription_plans_set_updated_at before update on public.subscription_plans
  for each row execute procedure public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
  for each row execute procedure public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute procedure public.set_updated_at();

-- -------------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.comments enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.conversations enable row level security;
alter table public.direct_messages enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.payments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.platform_settings enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "profiles readable by authenticated people"
  on public.profiles for select to authenticated
  using ((moderation_status = 'active' and banned_at is null) or id = auth.uid() or public.is_admin());
create policy "profiles update themselves"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "follows readable by authenticated people"
  on public.follows for select to authenticated using (true);
create policy "users follow themselves only"
  on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and not public.are_blocked_between(follower_id, following_id));
create policy "users remove their own follows"
  on public.follows for delete to authenticated using (follower_id = auth.uid());

create policy "visible posts are readable"
  on public.posts for select to authenticated
  using (
    moderation_status = 'active'
    and (privacy = 'public' or author_id = auth.uid() or (privacy = 'followers' and public.is_following(author_id)))
    or public.is_admin()
  );
create policy "authors create posts"
  on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy "authors update own posts"
  on public.posts for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());
create policy "authors delete own posts"
  on public.posts for delete to authenticated using (author_id = auth.uid() or public.is_admin());

create policy "post media follows post access"
  on public.post_media for select to authenticated
  using (exists (select 1 from public.posts where posts.id = post_id));
create policy "authors manage post media"
  on public.post_media for all to authenticated
  using (exists (select 1 from public.posts where posts.id = post_id and (posts.author_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.posts where posts.id = post_id and (posts.author_id = auth.uid() or public.is_admin())));

create policy "likes are readable"
  on public.likes for select to authenticated using (true);
create policy "users like as themselves"
  on public.likes for insert to authenticated with check (user_id = auth.uid());
create policy "users remove their own likes"
  on public.likes for delete to authenticated using (user_id = auth.uid());

create policy "saves are private"
  on public.saves for select to authenticated using (user_id = auth.uid());
create policy "users manage their saves"
  on public.saves for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "visible comments are readable"
  on public.comments for select to authenticated using (moderation_status = 'active' or author_id = auth.uid() or public.is_admin());
create policy "users create their comments"
  on public.comments for insert to authenticated with check (author_id = auth.uid());
create policy "authors manage comments"
  on public.comments for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());
create policy "authors delete comments"
  on public.comments for delete to authenticated using (author_id = auth.uid() or public.is_admin());

create policy "active stories are readable"
  on public.stories for select to authenticated
  using ((moderation_status = 'active' and expires_at > timezone('utc', now()) and (privacy = 'public' or author_id = auth.uid() or public.is_following(author_id))) or public.is_admin());
create policy "authors create stories"
  on public.stories for insert to authenticated with check (author_id = auth.uid());
create policy "authors manage stories"
  on public.stories for all to authenticated
  using (author_id = auth.uid() or public.is_admin()) with check (author_id = auth.uid() or public.is_admin());
create policy "views are private to story author"
  on public.story_views for select to authenticated
  using (viewer_id = auth.uid() or exists (select 1 from public.stories where stories.id = story_id and stories.author_id = auth.uid()));
create policy "users create their story views"
  on public.story_views for insert to authenticated with check (viewer_id = auth.uid());

create policy "members read their conversations"
  on public.conversations for select to authenticated using (auth.uid() in (member_low_id, member_high_id));
create policy "members create conversations"
  on public.conversations for insert to authenticated
  with check (auth.uid() in (member_low_id, member_high_id) and public.is_premium_user());
create policy "members update conversations"
  on public.conversations for update to authenticated using (auth.uid() in (member_low_id, member_high_id));
create policy "members read messages"
  on public.direct_messages for select to authenticated
  using (exists (select 1 from public.conversations where conversations.id = conversation_id and auth.uid() in (member_low_id, member_high_id)));
create policy "premium members send messages"
  on public.direct_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_premium_user()
    and exists (select 1 from public.conversations where conversations.id = conversation_id and auth.uid() in (member_low_id, member_high_id))
  );
create policy "recipients mark messages read"
  on public.direct_messages for update to authenticated
  using (
    read_at is null
    and sender_id <> auth.uid()
    and exists (select 1 from public.conversations where conversations.id = conversation_id and auth.uid() in (member_low_id, member_high_id))
  )
  with check (
    read_at is not null
    and sender_id <> auth.uid()
    and exists (select 1 from public.conversations where conversations.id = conversation_id and auth.uid() in (member_low_id, member_high_id))
  );

create policy "users manage their blocks"
  on public.user_blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "users submit reports"
  on public.user_reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "reporter or admin reads reports"
  on public.user_reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy "admins resolve reports"
  on public.user_reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "users read their notifications"
  on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy "users mark their notifications read"
  on public.notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create policy "plans are public to signed in users"
  on public.subscription_plans for select to authenticated using (is_active or public.is_admin());
create policy "admins manage plans"
  on public.subscription_plans for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users read their own payments"
  on public.payments for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "users read their own subscriptions"
  on public.subscriptions for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admins manage settings"
  on public.platform_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read audit logs"
  on public.admin_audit_logs for select to authenticated using (public.is_admin());
create policy "admins add audit logs"
  on public.admin_audit_logs for insert to authenticated with check (public.is_admin());

-- -------------------------------------------------------------------------
-- Storage
-- -------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('covers', 'covers', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('posts', 'posts', true, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('stories', 'stories', true, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('messages', 'messages', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public media is readable"
  on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'covers', 'posts', 'stories'));
create policy "users upload into their media folder"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'covers', 'posts', 'stories') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update their public media"
  on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'covers', 'posts', 'stories') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete their public media"
  on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'covers', 'posts', 'stories') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "conversation members read private attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'messages'
    and exists (
      select 1
      from public.direct_messages message
      join public.conversations conversation on conversation.id = message.conversation_id
      where message.attachment_path = storage.objects.name
        and auth.uid() in (conversation.member_low_id, conversation.member_high_id)
    )
  );
create policy "users upload their private attachments"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'messages' and (storage.foldername(name))[1] = auth.uid()::text);

-- Dados de configuração que não contêm qualquer credencial.
insert into public.subscription_plans (code, name, description, price_cents, duration_days)
values ('premium-monthly', 'Premium mensal', 'Mensagens privadas, filtros avançados e mais privacidade.', 1990, 30);

insert into public.platform_settings (key, value)
values
  ('registration', '{"enabled": true, "minimumAge": 18}'::jsonb),
  ('content', '{"storiesExpireHours": 24, "requireRealToPost": false}'::jsonb),
  ('premium', '{"messagesRequirePremium": true}'::jsonb)
on conflict (key) do nothing;

-- Grants de tabela não substituem RLS: apenas permitem que as policies acima
-- sejam avaliadas. A função de ativação Premium fica exclusiva do backend.
grant usage on schema public to authenticated;
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.posts, public.post_media, public.likes, public.comments, public.stories, public.story_views, public.conversations, public.direct_messages, public.user_blocks, public.user_reports, public.notifications, public.subscription_plans, public.payments, public.subscriptions to authenticated;
grant insert, delete on public.follows, public.likes, public.saves, public.comments, public.stories, public.story_views, public.user_blocks to authenticated;
grant insert, delete on public.posts, public.post_media to authenticated;
grant insert on public.conversations, public.direct_messages, public.user_reports to authenticated;
grant update on public.profiles, public.posts, public.post_media, public.comments, public.stories, public.user_reports, public.platform_settings, public.admin_audit_logs to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_premium_user(uuid) to authenticated;
grant execute on function public.is_following(uuid, uuid) to authenticated;
grant execute on function public.are_blocked_between(uuid, uuid) to authenticated;
grant execute on function public.update_my_profile(text, text, text, text, text, text, text, text, text, text[], date, boolean, boolean, boolean, boolean, text, boolean) to authenticated;
revoke all on function public.activate_premium_from_payment(uuid) from public, anon, authenticated;
grant execute on function public.activate_premium_from_payment(uuid) to service_role;