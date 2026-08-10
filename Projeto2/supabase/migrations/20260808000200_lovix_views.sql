-- Views com dados já filtráveis pelo front-end. As policies das tabelas-base
-- continuam sendo a fonte de autorização.

create or replace view public.feed_posts
with (security_invoker = true)
as
select
  p.id,
  p.author_id,
  p.caption,
  p.location_name,
  p.privacy,
  p.comments_enabled,
  p.likes_count,
  p.comments_count,
  p.created_at,
  p.updated_at,
  jsonb_build_object(
    'id', author.id,
    'username', author.username,
    'displayName', author.display_name,
    'avatarUrl', author.avatar_url,
    'isReal', author.is_real,
    'isPremium', author.is_premium
  ) as author,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', media.id,
        'storagePath', media.storage_path,
        'mediaType', media.media_type,
        'position', media.position,
        'altText', media.alt_text,
        'aspectRatio', media.aspect_ratio
      ) order by media.position
    ) filter (where media.id is not null),
    '[]'::jsonb
  ) as media
from public.posts p
join public.profiles author on author.id = p.author_id
left join public.post_media media on media.post_id = p.id
group by p.id, author.id;

grant select on public.feed_posts to authenticated;