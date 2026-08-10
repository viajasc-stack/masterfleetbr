-- LOVIX — reforço de segurança de dados
-- Esta migration reduz exposição de colunas sensíveis, centraliza leitura do
-- próprio perfil em RPC segura e aplica preferências de mensagens no banco.

create or replace function public.get_my_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

create or replace function public.can_message(target_user_id uuid, sender_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      sender_user_id is not null
      and target.id <> sender_user_id
      and target.moderation_status = 'active'
      and target.banned_at is null
      and not public.are_blocked_between(target.id, sender_user_id)
      and case target.allow_messages_from
        when 'everyone' then true
        when 'premium' then public.is_premium_user(sender_user_id)
        when 'followers' then public.is_following(target.id, sender_user_id) or public.is_following(sender_user_id, target.id)
        else false
      end
    from public.profiles target
    where target.id = target_user_id
  ), false);
$$;

drop policy if exists "profiles readable by authenticated people" on public.profiles;
create policy "profiles readable by allowed authenticated people"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or (
      moderation_status = 'active'
      and banned_at is null
      and (is_private = false or public.is_following(id, auth.uid()))
    )
  );

drop policy if exists "members create conversations" on public.conversations;
create policy "members create conversations"
  on public.conversations for insert to authenticated
  with check (
    auth.uid() in (member_low_id, member_high_id)
    and public.is_premium_user()
    and not public.are_blocked_between(member_low_id, member_high_id)
    and public.can_message(case when auth.uid() = member_low_id then member_high_id else member_low_id end)
  );

drop policy if exists "premium members send messages" on public.direct_messages;
create policy "premium members send messages"
  on public.direct_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_premium_user()
    and exists (
      select 1
      from public.conversations conversation
      where conversation.id = conversation_id
        and auth.uid() in (conversation.member_low_id, conversation.member_high_id)
        and public.can_message(case when auth.uid() = conversation.member_low_id then conversation.member_high_id else conversation.member_low_id end)
    )
  );

-- Reduzimos privilégios de coluna: consultas públicas autenticadas só recebem
-- dados necessários para descoberta/perfil. O próprio usuário obtém o perfil
-- completo por public.get_my_profile().
revoke select on public.profiles from authenticated;
grant select (
  id,
  username,
  display_name,
  bio,
  avatar_url,
  cover_url,
  profile_type,
  identity_label,
  city,
  state,
  interests,
  is_private,
  search_visible,
  show_city,
  show_online_status,
  is_real,
  is_verified,
  is_premium,
  moderation_status,
  created_at,
  updated_at
) on public.profiles to authenticated;

grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.can_message(uuid, uuid) to authenticated;
grant update (is_read) on public.notifications to authenticated;
grant update (read_at) on public.direct_messages to authenticated;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_premium_user(uuid) from public, anon;
revoke all on function public.is_following(uuid, uuid) from public, anon;
revoke all on function public.are_blocked_between(uuid, uuid) from public, anon;
revoke all on function public.update_my_profile(text, text, text, text, text, text, text, text, text, text[], date, boolean, boolean, boolean, boolean, text, boolean) from public, anon;
revoke all on function public.get_my_profile() from public, anon;
revoke all on function public.can_message(uuid, uuid) from public, anon;