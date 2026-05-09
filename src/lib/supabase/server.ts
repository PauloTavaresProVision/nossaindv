import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com service_role para uso server-side.
 *
 * Inicialização preguiçosa via Proxy — assim o módulo pode ser importado
 * durante `next build` (page-data collection) sem rebentar quando as
 * variáveis de runtime ainda não existem. O throw só acontece à primeira
 * vez que algum método é realmente chamado (em runtime, na API route).
 */
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltam variáveis de ambiente: NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export const supabaseAdmin: SupabaseClient = new Proxy(
  {} as SupabaseClient,
  {
    get(_target, prop, receiver) {
      const client = getClient();
      const value = Reflect.get(client, prop, receiver);
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);

export const STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET ?? "pdfs-beneficiarios";
