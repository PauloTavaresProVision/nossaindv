-- ============================================================================
-- Migration 0002 — Remover coluna `assinatura`
-- ============================================================================
-- Contexto: a versão inicial guardava a assinatura desenhada no canvas.
-- A app agora usa um modal de aceitação digital, sem assinatura manuscrita.
-- A coluna deixa de ser usada.
--
-- Como executar:
--   - Se já correste a 0001 antes desta alteração: cola este ficheiro no
--     SQL Editor do Supabase e clica Run.
--   - Se ainda não correste a 0001 (já actualizada), podes ignorar este
--     ficheiro — a coluna nunca chegou a existir.
-- ============================================================================

alter table public.submissoes drop column if exists assinatura;
