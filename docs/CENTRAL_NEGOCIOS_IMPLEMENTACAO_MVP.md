# Central de Negócios — Proposta de implementação completa (MVP)

> Produto: MasterFleetBR (SaaS multi-tenant)
> 
> Escopo: classificados internos entre empresas assinantes (sem pagamento/intermediação financeira)

---

## 1) Arquitetura funcional (visão geral)

### Objetivo do módulo
Criar um espaço interno para empresas publicarem e encontrarem oportunidades de negócio (venda, compra, permuta, parceria e prestação de serviço), com contato direto entre empresas.

### Princípios
- Sem checkout, sem carrinho, sem gateway.
- Publicação imediata.
- Moderação posterior por denúncia e painel master.
- Governança por status + confirmação periódica de disponibilidade.

---

## 2) Modelagem de banco de dados (SQL)

## 2.1 Tipos (enums)

```sql
create type public.negocio_tipo_oportunidade as enum (
  'venda',
  'compra',
  'permuta',
  'procura_parceiro',
  'prestacao_servico'
);

create type public.negocio_status_anuncio as enum (
  'rascunho',
  'ativo',
  'aguardando_confirmacao',
  'pausado',
  'inativo',
  'vendido',
  'removido'
);

create type public.negocio_canal_contato as enum ('whatsapp', 'telefone', 'email');

create type public.negocio_motivo_denuncia as enum (
  'fora_do_segmento',
  'conteudo_invalido',
  'ja_vendido',
  'spam',
  'outro'
);

create type public.negocio_resposta_confirmacao as enum ('ainda_disponivel', 'vendido', 'pausar');
```

## 2.2 Categorias e subcategorias (master)

```sql
create table if not exists public.negocio_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  descricao text,
  ativa boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.negocio_subcategorias (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.negocio_categorias(id) on delete cascade,
  nome text not null,
  slug text not null,
  ativa boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (categoria_id, slug)
);
```

## 2.3 Anúncios

```sql
create table if not exists public.negocio_anuncios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  criado_por uuid not null references auth.users(id) on delete restrict,

  tipo_oportunidade public.negocio_tipo_oportunidade not null,
  categoria_id uuid not null references public.negocio_categorias(id) on delete restrict,
  subcategoria_id uuid references public.negocio_subcategorias(id) on delete restrict,

  titulo text not null,
  descricao text not null,
  preco_centavos bigint,
  preco_a_combinar boolean not null default false,

  cidade text not null,
  estado text not null,

  status public.negocio_status_anuncio not null default 'rascunho',
  publicado_em timestamptz,

  -- lifecycle de confirmação
  proxima_confirmacao_em timestamptz,
  confirmacao_solicitada_em timestamptz,
  limite_resposta_em timestamptz,
  ultima_confirmacao_em timestamptz,

  removido_motivo text,
  removido_por uuid references auth.users(id),
  removido_em timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint negocio_preco_regra check (
    (preco_a_combinar = true and preco_centavos is null)
    or
    (preco_a_combinar = false and preco_centavos is not null and preco_centavos >= 0)
  )
);

create index if not exists idx_negocio_anuncios_listagem
  on public.negocio_anuncios (status, tipo_oportunidade, categoria_id, estado, cidade, publicado_em desc);

create index if not exists idx_negocio_anuncios_empresa
  on public.negocio_anuncios (empresa_id, status, updated_at desc);
```

## 2.4 Contatos e imagens do anúncio

```sql
create table if not exists public.negocio_anuncio_contatos (
  id uuid primary key default gen_random_uuid(),
  anuncio_id uuid not null references public.negocio_anuncios(id) on delete cascade,
  canal public.negocio_canal_contato not null,
  valor text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  unique (anuncio_id, canal)
);

create table if not exists public.negocio_anuncio_imagens (
  id uuid primary key default gen_random_uuid(),
  anuncio_id uuid not null references public.negocio_anuncios(id) on delete cascade,
  storage_path text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);
```

## 2.5 Favoritos e denúncias

```sql
create table if not exists public.negocio_favoritos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  anuncio_id uuid not null references public.negocio_anuncios(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (empresa_id, anuncio_id)
);

create table if not exists public.negocio_denuncias (
  id uuid primary key default gen_random_uuid(),
  anuncio_id uuid not null references public.negocio_anuncios(id) on delete cascade,
  denunciante_empresa_id uuid not null references public.empresas(id) on delete cascade,
  denunciante_user_id uuid not null references auth.users(id) on delete restrict,
  motivo public.negocio_motivo_denuncia not null,
  descricao text,
  status text not null default 'aberta' check (status in ('aberta','em_analise','resolvida','arquivada')),
  tratada_por uuid references auth.users(id),
  tratada_em timestamptz,
  created_at timestamptz not null default now(),
  unique (anuncio_id, denunciante_empresa_id, motivo)
);
```

## 2.6 Log de confirmações automáticas

```sql
create table if not exists public.negocio_confirmacoes_log (
  id uuid primary key default gen_random_uuid(),
  anuncio_id uuid not null references public.negocio_anuncios(id) on delete cascade,
  solicitada_em timestamptz not null,
  limite_resposta_em timestamptz not null,
  respondida_em timestamptz,
  resposta public.negocio_resposta_confirmacao,
  origem text not null default 'scheduler',
  created_at timestamptz not null default now()
);

create index if not exists idx_negocio_confirmacoes_abertas
  on public.negocio_confirmacoes_log (anuncio_id, solicitada_em desc)
  where respondida_em is null;
```

---

## 3) RLS (exemplos essenciais)

## 3.1 Regras gerais
- `empresa_id` em todas as tabelas tenant-sensitive.
- Master com bypass via função `is_master_admin()`.
- Empresas só alteram seus próprios dados.
- Listagem pública de anúncios: leitura de anúncios `status='ativo'` para autenticados.

## 3.2 Exemplo de policies

```sql
alter table public.negocio_anuncios enable row level security;

create policy negocio_anuncios_select_publico_auth
on public.negocio_anuncios
for select
to authenticated
using (
  status = 'ativo'
  or empresa_id = public.minha_empresa_id()
  or public.is_master_admin()
);

create policy negocio_anuncios_insert_own
on public.negocio_anuncios
for insert
to authenticated
with check (
  empresa_id = public.minha_empresa_id()
  and public.is_empresa_assinatura_ativa_sem_trial(empresa_id)
);

create policy negocio_anuncios_update_own_or_master
on public.negocio_anuncios
for update
to authenticated
using (empresa_id = public.minha_empresa_id() or public.is_master_admin())
with check (empresa_id = public.minha_empresa_id() or public.is_master_admin());

create policy negocio_anuncios_delete_master
on public.negocio_anuncios
for delete
to authenticated
using (public.is_master_admin());
```

> Repetir padrão para `negocio_anuncio_contatos`, `negocio_anuncio_imagens`, `negocio_favoritos`, `negocio_denuncias`.

---

## 4) RPCs principais (regras críticas)

## 4.1 Criação de anúncio

```sql
create or replace function public.negocio_criar_anuncio(
  p_tipo public.negocio_tipo_oportunidade,
  p_categoria_id uuid,
  p_subcategoria_id uuid,
  p_titulo text,
  p_descricao text,
  p_preco_centavos bigint,
  p_preco_a_combinar boolean,
  p_cidade text,
  p_estado text,
  p_contatos jsonb,
  p_imagens jsonb,
  p_publicar boolean default true
) returns uuid
language plpgsql
security definer
as $$
declare
  v_empresa_id uuid := public.minha_empresa_id();
  v_user_id uuid := auth.uid();
  v_anuncio_id uuid;
begin
  if v_empresa_id is null then
    raise exception 'empresa_not_found';
  end if;

  if p_publicar and not public.is_empresa_assinatura_ativa_sem_trial(v_empresa_id) then
    raise exception 'assinatura_nao_permite_publicacao';
  end if;

  insert into public.negocio_anuncios (
    empresa_id, criado_por, tipo_oportunidade, categoria_id, subcategoria_id,
    titulo, descricao, preco_centavos, preco_a_combinar,
    cidade, estado, status, publicado_em, proxima_confirmacao_em
  ) values (
    v_empresa_id, v_user_id, p_tipo, p_categoria_id, p_subcategoria_id,
    p_titulo, p_descricao, p_preco_centavos, p_preco_a_combinar,
    p_cidade, p_estado,
    case when p_publicar then 'ativo' else 'rascunho' end,
    case when p_publicar then now() else null end,
    case when p_publicar then now() + interval '7 days' else null end
  ) returning id into v_anuncio_id;

  -- inserir contatos/imagens parseando JSON
  -- (validar canais permitidos)

  return v_anuncio_id;
end;
$$;
```

## 4.2 Alterar status do anúncio

```sql
create or replace function public.negocio_atualizar_status_anuncio(
  p_anuncio_id uuid,
  p_status public.negocio_status_anuncio
) returns boolean
language plpgsql
security definer
as $$
begin
  update public.negocio_anuncios
  set status = p_status,
      updated_at = now(),
      removed_at = case when p_status='removido' then now() else removed_at end
  where id = p_anuncio_id
    and (empresa_id = public.minha_empresa_id() or public.is_master_admin());

  return found;
end;
$$;
```

## 4.3 Registrar denúncia

```sql
create or replace function public.negocio_registrar_denuncia(
  p_anuncio_id uuid,
  p_motivo public.negocio_motivo_denuncia,
  p_descricao text default null
) returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  insert into public.negocio_denuncias (
    anuncio_id, denunciante_empresa_id, denunciante_user_id, motivo, descricao
  ) values (
    p_anuncio_id, public.minha_empresa_id(), auth.uid(), p_motivo, p_descricao
  ) returning id into v_id;

  return v_id;
end;
$$;
```

## 4.4 Confirmar disponibilidade

```sql
create or replace function public.negocio_confirmar_disponibilidade(
  p_anuncio_id uuid,
  p_resposta public.negocio_resposta_confirmacao
) returns boolean
language plpgsql
security definer
as $$
begin
  if p_resposta = 'ainda_disponivel' then
    update public.negocio_anuncios
    set status = 'ativo',
        ultima_confirmacao_em = now(),
        proxima_confirmacao_em = now() + interval '7 days',
        confirmacao_solicitada_em = null,
        limite_resposta_em = null,
        updated_at = now()
    where id = p_anuncio_id and empresa_id = public.minha_empresa_id();
  elsif p_resposta = 'vendido' then
    update public.negocio_anuncios
    set status = 'vendido', updated_at = now()
    where id = p_anuncio_id and empresa_id = public.minha_empresa_id();
  else
    update public.negocio_anuncios
    set status = 'pausado', updated_at = now()
    where id = p_anuncio_id and empresa_id = public.minha_empresa_id();
  end if;

  update public.negocio_confirmacoes_log
  set respondida_em = now(), resposta = p_resposta
  where anuncio_id = p_anuncio_id and respondida_em is null;

  return found;
end;
$$;
```

## 4.5 Job diário (solicitar confirmação e inativar sem resposta)

```sql
create or replace function public.negocio_job_confirmacao_diaria()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_solicitados int := 0;
  v_inativados int := 0;
begin
  -- 1) marcar anúncios ativos vencidos para aguardando_confirmacao
  with cte as (
    update public.negocio_anuncios a
    set status = 'aguardando_confirmacao',
        confirmacao_solicitada_em = now(),
        limite_resposta_em = now() + interval '48 hours',
        updated_at = now()
    where a.status = 'ativo'
      and a.proxima_confirmacao_em <= now()
    returning a.id, a.empresa_id
  )
  select count(*) into v_solicitados from cte;

  -- 2) inativar sem resposta após 48h
  with cte2 as (
    update public.negocio_anuncios a
    set status = 'inativo', updated_at = now()
    where a.status = 'aguardando_confirmacao'
      and a.limite_resposta_em <= now()
    returning a.id
  )
  select count(*) into v_inativados from cte2;

  -- 3) (opcional) inserir notificações para admin da empresa
  -- insert into public.notifications ...

  return jsonb_build_object(
    'solicitados', v_solicitados,
    'inativados', v_inativados
  );
end;
$$;
```

---

## 5) Jobs / scheduler

### Agendamento diário
- Via `pg_cron`/job scheduler já usado no projeto:

```sql
select cron.schedule(
  'negocio-confirmacao-diaria',
  '0 8 * * *',
  $$select public.negocio_job_confirmacao_diaria();$$
);
```

### Notificações
- Ao entrar em `aguardando_confirmacao`: notificar admin da empresa.
- 24h após solicitação, opcionalmente reenviar lembrete.

---

## 6) Endpoints/serviços (sugestão)

## 6.1 RPC-first (recomendado)
- `negocio_criar_anuncio(...)`
- `negocio_editar_anuncio(...)`
- `negocio_atualizar_status_anuncio(...)`
- `negocio_listar_anuncios(...)` (com filtros/paginação)
- `negocio_detalhar_anuncio(p_id)`
- `negocio_toggle_favorito(p_anuncio_id)`
- `negocio_registrar_denuncia(...)`
- `negocio_confirmar_disponibilidade(...)`
- `negocio_job_confirmacao_diaria()`

## 6.2 Rotas Next (opcional para UX)
- `GET /api/central-negocios/anuncios`
- `POST /api/central-negocios/anuncios`
- `PATCH /api/central-negocios/anuncios/:id/status`
- `POST /api/central-negocios/anuncios/:id/denuncia`
- `POST /api/central-negocios/anuncios/:id/favorito`

---

## 7) Estrutura de pastas (web)

```text
src/app/(painel)/central-negocios/
  page.tsx                     # listagem + filtros
  novo/page.tsx                # criação de anúncio
  meus-anuncios/page.tsx       # gestão própria
  favoritos/page.tsx
  [id]/page.tsx                # detalhe anúncio

src/components/central-negocios/
  FiltroAnuncios.tsx
  CardAnuncio.tsx
  FormAnuncio.tsx
  ContatoAnuncio.tsx
  ModalDenuncia.tsx

src/lib/centralNegocios.ts     # camada de chamadas RPC

src/app/(master)/master/central-negocios/
  page.tsx                     # dashboard moderação
  categorias/page.tsx          # CRUD categorias/subcategorias
  denuncias/page.tsx           # fila de denúncias
```

---

## 8) Fluxo de lifecycle do anúncio

1. Empresa cria anúncio em `rascunho` ou `ativo`.
2. Se publicado, define `proxima_confirmacao_em = now()+7d`.
3. Job diário identifica vencidos e muda para `aguardando_confirmacao`, com prazo 48h.
4. Empresa responde:
   - `ainda_disponivel` → `ativo` + novo ciclo de 7 dias.
   - `vendido` → `vendido`.
   - `pausar` → `pausado`.
5. Sem resposta em 48h → `inativo` automaticamente.
6. Master pode ocultar/remover por moderação.

---

## 9) Fases sugeridas (MVP → escala)

### Fase 1 (MVP funcional)
- Tabelas + RLS + RPCs base.
- CRUD de anúncio, listagem, detalhe, favoritos, denúncia.
- CRUD master de categorias e moderação básica.

### Fase 2 (governança)
- Job diário + notificações automáticas + painel de confirmações.
- Métricas: anúncios ativos, taxa de renovação 7d, denúncias abertas.

### Fase 3 (escala)
- Busca full-text indexada.
- Recomendação por categoria/localização.
- anti-spam e limite de publicação por janela.

---

## 10) Observações de segurança e tenancy

- Sempre derivar `empresa_id` de `minha_empresa_id()` em funções críticas.
- Nunca confiar em `empresa_id` enviado pelo cliente para escrita.
- `security definer` + validações explícitas.
- Auditoria de moderação (quem ocultou/removeu e por quê).

---

## Resultado esperado

Com este desenho, o módulo **Central de Negócios** nasce simples, útil e aderente ao SaaS multi-tenant do MasterFleetBR, aumentando retenção e geração de valor sem introduzir complexidade de e-commerce/pagamentos.
