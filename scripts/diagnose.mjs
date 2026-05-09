#!/usr/bin/env node
/**
 * Diagnóstico end-to-end:
 *   1. Tabelas Supabase
 *   2. Bucket de Storage
 *   3. Últimas 5 submissões (se houver)
 *   4. Estado do envio de email para cada uma
 *
 * Uso:
 *   node --env-file=.env.local scripts/diagnose.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "pdfs-beneficiarios";

if (!url || !key) {
  console.error("✗ Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const ok = (msg) => console.log("✓ " + msg);
const ko = (msg) => console.log("✗ " + msg);
const info = (msg) => console.log("ℹ " + msg);

console.log("\n━━━ 1. Tabelas Supabase ━━━");

const { error: errSubm, count: countSubm } = await sb
  .from("submissoes")
  .select("*", { count: "exact", head: true });
if (errSubm) {
  ko(`Tabela submissoes não existe: ${errSubm.message}`);
  ko("→ Tens de correr supabase/migrations/0001_initial_schema.sql no SQL Editor.");
  process.exit(2);
}
ok(`Tabela submissoes existe (${countSubm ?? 0} registos)`);

const { error: errBen, count: countBen } = await sb
  .from("beneficiarios")
  .select("*", { count: "exact", head: true });
if (errBen) {
  ko(`Tabela beneficiarios não existe: ${errBen.message}`);
  process.exit(2);
}
ok(`Tabela beneficiarios existe (${countBen ?? 0} registos)`);

console.log("\n━━━ 2. Storage bucket ━━━");
const { data: buckets, error: errBuckets } = await sb.storage.listBuckets();
if (errBuckets) {
  ko(`Erro a listar buckets: ${errBuckets.message}`);
} else {
  const b = buckets.find((x) => x.id === bucket);
  if (b) ok(`Bucket "${bucket}" existe (public=${b.public})`);
  else ko(`Bucket "${bucket}" NÃO existe — corre a migration SQL`);
}

console.log("\n━━━ 3. Últimas submissões ━━━");
const { data: recent, error: errRecent } = await sb
  .from("submissoes")
  .select(
    "id, nome_completo, email, idioma, email_enviado, email_erro, data_submissao, pdf_storage_path"
  )
  .order("data_submissao", { ascending: false })
  .limit(5);

if (errRecent) {
  ko("Erro a ler submissões: " + errRecent.message);
} else if (!recent || recent.length === 0) {
  info("Sem submissões na BD ainda. Submete o formulário primeiro.");
} else {
  for (const r of recent) {
    const when = new Date(r.data_submissao).toLocaleString("pt-PT");
    console.log(`  • ${when}`);
    console.log(`    id:    ${r.id}`);
    console.log(`    nome:  ${r.nome_completo}`);
    console.log(`    email: ${r.email}`);
    console.log(`    pdf:   ${r.pdf_storage_path ?? "—"}`);
    console.log(
      `    email enviado: ${r.email_enviado ? "✓" : "✗"}${r.email_erro ? " | erro: " + r.email_erro : ""}`
    );
  }
}

console.log("\n━━━ 4. PDFs no Storage (últimos 5) ━━━");
const { data: files, error: errFiles } = await sb.storage
  .from(bucket)
  .list(new Date().getFullYear().toString(), {
    limit: 5,
    sortBy: { column: "created_at", order: "desc" },
  });
if (errFiles) {
  ko("Erro a listar PDFs: " + errFiles.message);
} else if (!files || files.length === 0) {
  info("Sem PDFs no Storage ainda.");
} else {
  for (const f of files) {
    console.log(`  • ${f.name}  (${(f.metadata?.size ?? 0) / 1024 | 0} KB, ${f.created_at})`);
  }
}

console.log("\n━━━ Resumo ━━━");
if (recent && recent.length > 0) {
  const sentCount = recent.filter((r) => r.email_enviado).length;
  const errCount = recent.filter((r) => r.email_erro).length;
  console.log(`Submissões: ${recent.length} | Emails enviados: ${sentCount} | Erros: ${errCount}`);
  if (sentCount === 0 && recent.length > 0) {
    ko("Nenhum email saiu. Possíveis causas:");
    ko("  • SMTP não configurado quando a submissão foi feita (verifica .env.local + reinicia npm run dev)");
    ko("  • PDF não foi gerado (assinatura legacy?)");
    ko("  • Erro no envio (vê coluna email_erro acima)");
  }
}
