# Setup de Chat, Áudio, Imagens e Chamadas

Este arquivo documenta os passos necessários no Supabase para as áreas novas do LOVIX funcionarem em produção.

## 1. Storage buckets

Crie estes buckets em **Supabase > Storage**:

| Bucket | Público | Uso |
| --- | --- | --- |
| `chat-images` | Sim | Imagens enviadas no chat |
| `chat-audio` | Sim | Mensagens de áudio `.webm` |
| `call-recordings` | Opcional | Futuras gravações de chamadas |

## 2. Políticas sugeridas de Storage

Use políticas equivalentes a:

```sql
create policy "authenticated upload chat images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'chat-images');

create policy "public read chat images"
on storage.objects for select
to public
using (bucket_id = 'chat-images');

create policy "authenticated upload chat audio"
on storage.objects for insert
to authenticated
with check (bucket_id = 'chat-audio');

create policy "public read chat audio"
on storage.objects for select
to public
using (bucket_id = 'chat-audio');
```

## 3. Realtime

Habilite Realtime para a tabela:

- `direct_messages`

Usos atuais:

- novas mensagens em tempo real;
- atualização de `is_read`;
- eventos broadcast de digitando;
- eventos broadcast de chamada recebida/recusada;
- sinalização WebRTC (`offer`, `answer`, `ice-candidate`, `ready`, `end-call`).

## 4. Chamadas de voz/vídeo

Chamadas só aparecem quando existe confirmação REAL mútua:

- usuário A confirmou B em `real_confirmations`;
- usuário B confirmou A em `real_confirmations`.

## 5. Observações importantes

- WebRTC funciona melhor em HTTPS ou localhost.
- Em produção, para redes restritas, pode ser necessário configurar TURN server além do STUN público.
- O navegador precisa permitir microfone/câmera.