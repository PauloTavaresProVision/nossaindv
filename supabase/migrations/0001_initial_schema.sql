-- ============================================================================
-- Nossa Seguros - Formulário de Nomeação de Beneficiários
-- Schema inicial
-- ============================================================================
-- Como executar:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Cola este ficheiro inteiro e clica "Run"
-- ============================================================================

-- Extensões úteis
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Tabela: submissoes
-- Cada linha = um formulário submetido.
-- ----------------------------------------------------------------------------
create table if not exists public.submissoes (
  id              uuid primary key default gen_random_uuid(),
  -- dados do tomador / pessoa segura
  nome_completo   text not null,
  numero_apolice  text not null,
  endereco        text not null,
  nif             text not null,
  telefone        text not null,
  email           text not null,
  -- consentimento
  declaracao_aceite boolean not null default false,
  -- metadados
  idioma          text not null default 'pt' check (idioma in ('pt','en','fr')),
  pdf_storage_path text,           -- caminho do PDF em Supabase Storage
  email_enviado   boolean not null default false,
  email_erro      text,
  ip_address      inet,
  user_agent      text,
  data_submissao  timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Tabela: beneficiarios
-- Linhas filhas — relação 1:N com submissoes.
-- ----------------------------------------------------------------------------
create table if not exists public.beneficiarios (
  id                uuid primary key default gen_random_uuid(),
  submissao_id      uuid not null references public.submissoes(id) on delete cascade,
  nome_completo     text not null,
  data_nascimento   date,
  bi_passaporte     text,
  grau_parentesco   text,
  percentagem       numeric(6,2),
  ordem             int not null default 0,
  created_at        timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Índices
-- ----------------------------------------------------------------------------
create index if not exists idx_submissoes_nif         on public.submissoes(nif);
create index if not exists idx_submissoes_apolice     on public.submissoes(numero_apolice);
create index if not exists idx_submissoes_email       on public.submissoes(email);
create index if not exists idx_submissoes_data        on public.submissoes(data_submissao desc);
create index if not exists idx_beneficiarios_submissao on public.beneficiarios(submissao_id);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- A app escreve sempre via service_role key (server-side), portanto:
--   - RLS activado nas duas tabelas
--   - Sem policies para anon / authenticated → bloqueado por defeito
--   - service_role bypassa RLS automaticamente
-- ----------------------------------------------------------------------------
alter table public.submissoes    enable row level security;
alter table public.beneficiarios enable row level security;

-- ----------------------------------------------------------------------------
-- Storage bucket para guardar os PDFs gerados
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pdfs-beneficiarios',
  'pdfs-beneficiarios',
  false,
  10485760,                       -- 10 MB
  array['application/pdf']
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- View administrativa: resumo das submissões com nº de beneficiários
-- (útil para dashboards futuros)
-- ----------------------------------------------------------------------------
create or replace view public.v_submissoes_resumo as
select
  s.id,
  s.nome_completo,
  s.numero_apolice,
  s.nif,
  s.email,
  s.idioma,
  s.email_enviado,
  s.data_submissao,
  count(b.id)           as total_beneficiarios,
  coalesce(sum(b.percentagem), 0) as soma_percentagens
from public.submissoes s
left join public.beneficiarios b on b.submissao_id = s.id
group by s.id;

-- ----------------------------------------------------------------------------
-- Done.
-- ----------------------------------------------------------------------------
