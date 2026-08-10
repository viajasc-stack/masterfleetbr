-- LOVIX — verificação manual privada e auditável

alter table public.profiles
  add column if not exists age_verified_at timestamptz,
  add column if not exists identity_verified_at timestamptz;

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('real_profile', 'identity', 'age_18')),
  status text not null default 'pending' check (status in ('pending', 'in_review', 'approved', 'rejected', 'expired')),
  evidence_path text,
  evidence_mime_type text check (evidence_mime_type is null or evidence_mime_type in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4')),
  evidence_expires_at timestamptz not null default timezone('utc', now()) + interval '7 days',
  review_notes_private text,
  rejection_reason_public text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint verification_evidence_user_folder check (evidence_path is null or split_part(evidence_path, '/', 1) = user_id::text)
);

create index if not exists verification_requests_user_idx on public.verification_requests (user_id, created_at desc);
create index if not exists verification_requests_status_idx on public.verification_requests (status, created_at desc);

drop trigger if exists verification_requests_set_updated_at on public.verification_requests;
create trigger verification_requests_set_updated_at before update on public.verification_requests
  for each row execute procedure public.set_updated_at();

alter table public.verification_requests enable row level security;

drop policy if exists "users read their verification requests" on public.verification_requests;
create policy "users read their verification requests"
  on public.verification_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "users create their verification requests" on public.verification_requests;
create policy "users create their verification requests"
  on public.verification_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "admins update verification requests" on public.verification_requests;
create policy "admins update verification requests"
  on public.verification_requests for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-evidence', 'verification-evidence', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users upload verification evidence" on storage.objects;
create policy "users upload verification evidence"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "admins read verification evidence" on storage.objects;
create policy "admins read verification evidence"
  on storage.objects for select to authenticated
  using (bucket_id = 'verification-evidence' and public.is_admin());

drop policy if exists "admins delete verification evidence" on storage.objects;
create policy "admins delete verification evidence"
  on storage.objects for delete to authenticated
  using (bucket_id = 'verification-evidence' and public.is_admin());

create or replace function public.create_verification_request(p_type text, p_evidence_path text, p_evidence_mime_type text)
returns public.verification_requests
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  new_request public.verification_requests;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Autenticação obrigatória'; end if;
  if p_type not in ('real_profile', 'identity', 'age_18') then raise exception 'Tipo de verificação inválido'; end if;
  if p_evidence_path is null or trim(p_evidence_path) = '' then raise exception 'Evidência obrigatória'; end if;
  if split_part(p_evidence_path, '/', 1) <> current_user_id::text then raise exception 'Caminho da evidência inválido'; end if;
  if p_evidence_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4') then raise exception 'Formato de evidência inválido'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'verification-evidence' and name = p_evidence_path) then
    raise exception 'Arquivo de evidência não encontrado';
  end if;
  if exists (
    select 1 from public.verification_requests
    where user_id = current_user_id and type = p_type and status in ('pending', 'in_review')
  ) then
    raise exception 'Você já possui uma solicitação desse tipo em análise';
  end if;

  insert into public.verification_requests (user_id, type, evidence_path, evidence_mime_type)
  values (current_user_id, p_type, p_evidence_path, p_evidence_mime_type)
  returning * into new_request;

  return new_request;
end;
$$;

create or replace function public.my_verification_requests(p_limit int default 20)
returns table (
  id uuid,
  user_id uuid,
  type text,
  status text,
  evidence_mime_type text,
  evidence_expires_at timestamptz,
  rejection_reason_public text,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  return query
    select r.id, r.user_id, r.type, r.status, r.evidence_mime_type, r.evidence_expires_at, r.rejection_reason_public, r.reviewed_at, r.created_at, r.updated_at
    from public.verification_requests r
    where r.user_id = auth.uid()
    order by r.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

create or replace function public.admin_list_verification_requests(p_status text default null, p_limit int default 80)
returns table (
  id uuid,
  user_id uuid,
  username citext,
  display_name text,
  avatar_url text,
  type text,
  status text,
  evidence_path text,
  evidence_mime_type text,
  evidence_expires_at timestamptz,
  review_notes_private text,
  rejection_reason_public text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  if p_status is not null and p_status not in ('pending', 'in_review', 'approved', 'rejected', 'expired') then raise exception 'Status de verificação inválido'; end if;
  return query
    select r.id, r.user_id, p.username, p.display_name, p.avatar_url, r.type, r.status, r.evidence_path, r.evidence_mime_type, r.evidence_expires_at, r.review_notes_private, r.rejection_reason_public, r.reviewed_by, r.reviewed_at, r.created_at
    from public.verification_requests r
    join public.profiles p on p.id = r.user_id
    where p_status is null or r.status = p_status
    order by r.created_at desc
    limit least(greatest(coalesce(p_limit, 80), 1), 200);
end;
$$;

create or replace function public.admin_get_verification_evidence_access(request_uuid uuid)
returns table (evidence_path text, expires_in_seconds int)
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.verification_requests;
begin
  perform public.admin_assert();
  select * into request_row from public.verification_requests where id = request_uuid;
  if not found then raise exception 'Solicitação não encontrada'; end if;
  if request_row.evidence_path is null then raise exception 'Evidência indisponível'; end if;
  if request_row.evidence_expires_at < timezone('utc', now()) then raise exception 'Evidência expirada'; end if;

  perform public.admin_audit('verification_evidence_access', 'verification_request', request_uuid::text, 'Acesso à evidência privada', jsonb_build_object('userId', request_row.user_id, 'type', request_row.type));
  return query select request_row.evidence_path, 120::int;
end;
$$;

create or replace function public.admin_review_verification(request_uuid uuid, next_status text, reason_text text default '', private_notes text default '')
returns public.verification_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.verification_requests;
begin
  perform public.admin_assert();
  if next_status not in ('in_review', 'approved', 'rejected', 'expired') then raise exception 'Status de verificação inválido'; end if;

  update public.verification_requests
  set status = next_status,
      reviewed_by = case when next_status in ('approved', 'rejected', 'expired') then auth.uid() else reviewed_by end,
      reviewed_at = case when next_status in ('approved', 'rejected', 'expired') then timezone('utc', now()) else reviewed_at end,
      review_notes_private = nullif(private_notes, ''),
      rejection_reason_public = case when next_status = 'rejected' then nullif(reason_text, '') else null end
  where id = request_uuid
  returning * into request_row;

  if request_row.id is null then raise exception 'Solicitação não encontrada'; end if;

  if next_status = 'approved' and request_row.type = 'real_profile' then
    update public.profiles set is_real = true, updated_at = timezone('utc', now()) where id = request_row.user_id;
  elsif next_status = 'approved' and request_row.type = 'identity' then
    update public.profiles set is_verified = true, identity_verified_at = timezone('utc', now()), updated_at = timezone('utc', now()) where id = request_row.user_id;
  elsif next_status = 'approved' and request_row.type = 'age_18' then
    update public.profiles set age_verified_at = timezone('utc', now()), age_confirmed_at = coalesce(age_confirmed_at, timezone('utc', now())), updated_at = timezone('utc', now()) where id = request_row.user_id;
  end if;

  perform public.admin_audit('verification_' || next_status, 'verification_request', request_uuid::text, reason_text, jsonb_build_object('userId', request_row.user_id, 'type', request_row.type));
  return request_row;
end;
$$;

create or replace function public.admin_delete_verification_evidence(request_uuid uuid, reason_text text default '')
returns public.verification_requests
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  request_row public.verification_requests;
  old_path text;
begin
  perform public.admin_assert();
  select * into request_row from public.verification_requests where id = request_uuid;
  if not found then raise exception 'Solicitação não encontrada'; end if;
  if request_row.evidence_path is null then return request_row; end if;

  old_path := request_row.evidence_path;
  delete from storage.objects where bucket_id = 'verification-evidence' and name = old_path;

  update public.verification_requests
  set evidence_path = null,
      review_notes_private = concat_ws(E'\n', nullif(review_notes_private, ''), 'Evidência apagada por admin em ' || timezone('utc', now())::text)
  where id = request_uuid
  returning * into request_row;

  perform public.admin_audit('verification_evidence_deleted', 'verification_request', request_uuid::text, reason_text, jsonb_build_object('path', old_path, 'userId', request_row.user_id));
  return request_row;
end;
$$;

grant select, insert, update on public.verification_requests to authenticated;
grant execute on function public.create_verification_request(text, text, text) to authenticated;
grant execute on function public.my_verification_requests(int) to authenticated;
grant execute on function public.admin_list_verification_requests(text, int) to authenticated;
grant execute on function public.admin_get_verification_evidence_access(uuid) to authenticated;
grant execute on function public.admin_review_verification(uuid, text, text, text) to authenticated;
grant execute on function public.admin_delete_verification_evidence(uuid, text) to authenticated;

revoke all on public.verification_requests from public, anon;
revoke all on function public.create_verification_request(text, text, text) from public, anon;
revoke all on function public.my_verification_requests(int) from public, anon;
revoke all on function public.admin_list_verification_requests(text, int) from public, anon;
revoke all on function public.admin_get_verification_evidence_access(uuid) from public, anon;
revoke all on function public.admin_review_verification(uuid, text, text, text) from public, anon;
revoke all on function public.admin_delete_verification_evidence(uuid, text) from public, anon;