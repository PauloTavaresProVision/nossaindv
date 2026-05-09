# Formulário de Nomeação de Beneficiários — Nossa Seguros

Versão digital do **Formulário de Nomeação de Beneficiários do Seguro de Vida Individual** (Nossa Seguros, S.A.).

- **Stack:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4
- **i18n:** PT · EN · FR (next-intl)
- **BD / Storage:** Supabase (Postgres + Storage)
- **PDF:** `pdf-lib` (gerado server-side, réplica simplificada do original)
- **Email:** Nodemailer (qualquer servidor SMTP)
- **Deploy:** Docker (output `standalone` do Next)

---

## Deploy rápido (Docker no VPS)

```bash
git clone https://github.com/PauloTavaresProVision/nossaindv.git
cd nossaindv
cp .env.example .env       # depois edita com as tuas keys
docker compose up -d --build
```

App disponível em `http://<vps>:3000`. Para HTTPS, põe Nginx/Traefik à frente — exemplo no fim deste README.

**Em plataformas tipo Coolify / Dokku / Portainer / Railway:**
1. Aponta para `https://github.com/PauloTavaresProVision/nossaindv`
2. Build pack: **Dockerfile**
3. Define as variáveis de ambiente (ver tabela abaixo) — as `NEXT_PUBLIC_*` têm de ser definidas como **build args** (não só runtime), porque são embebidas no bundle.
4. Antes do primeiro deploy, corre o SQL em `supabase/migrations/0001_initial_schema.sql` no Supabase SQL Editor.

---

## 1. Setup local

### Pré-requisitos
- Node.js 22+ (testado com 24)
- npm 10+
- Conta Supabase (free tier chega)
- Servidor SMTP

### Instalar dependências

```powershell
npm install
```

### Variáveis de ambiente

Copia o `.env.example` para `.env.local` e preenche:

```powershell
Copy-Item .env.example .env.local
```

| Variável | Onde obter |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | mesma página, "anon / public" |
| `SUPABASE_SERVICE_ROLE_KEY` | mesma página, "service_role" (clica "Reveal") — **nunca expor no frontend** |
| `SMTP_*` | Credenciais do servidor SMTP que vai enviar a cópia ao cliente |
| `INTERNAL_NOTIFICATION_EMAIL` | (opcional) endereço interno que recebe BCC de cada submissão |

### Executar BD (uma vez)

No Supabase Dashboard → **SQL Editor** → **New query**:

1. Cola o conteúdo de `supabase/migrations/0001_initial_schema.sql`
2. Clica **Run**
3. Verifica em **Table Editor** que existem `submissoes` e `beneficiarios`
4. Verifica em **Storage** que existe o bucket `pdfs-beneficiarios`

### Arrancar em desenvolvimento

```powershell
npm run dev
```

Abre <http://localhost:3000> — o middleware redireciona para `/pt`.

---

## 2. Estrutura

```
.
├─ messages/                  # traduções pt.json / en.json / fr.json
├─ public/                    # estáticos (logo SVG, favicon, etc.)
├─ src/
│  ├─ app/
│  │  ├─ [locale]/            # páginas localizadas
│  │  ├─ api/submit/          # endpoint POST que valida + grava + gera PDF + envia email
│  │  ├─ globals.css
│  │  └─ layout.tsx
│  ├─ components/             # Header, Footer, BeneficiariesForm, SignaturePad…
│  ├─ i18n/                   # routing + request config do next-intl
│  ├─ lib/
│  │  ├─ supabase/{client,server}.ts
│  │  ├─ pdf.ts               # geração do PDF
│  │  ├─ email.ts             # envio SMTP
│  │  └─ validation.ts        # schemas Zod
│  └─ middleware.ts
├─ supabase/migrations/0001_initial_schema.sql
├─ Dockerfile
├─ docker-compose.yml
└─ package.json
```

---

## 3. Fluxo de submissão

1. Cliente preenche o formulário → `BeneficiariesForm.tsx`
2. Submit faz `POST /api/submit` com payload JSON
3. API:
   1. Valida com Zod
   2. Insere `submissoes` + `beneficiarios` (via `service_role`)
   3. Gera PDF (`pdf-lib`) com cabeçalho NOSSA, dados, tabela, assinatura, footer
   4. Faz upload para `Storage/pdfs-beneficiarios/<ano>/<id>.pdf`
   5. Envia email com PDF anexado (idioma escolhido)
   6. Marca `email_enviado = true` (ou regista `email_erro`)
4. Cliente vê ecrã de sucesso com referência da submissão

Se o SMTP não estiver configurado, o resto continua a funcionar — o PDF fica disponível em Storage e a submissão fica gravada.

---

## 4. Comandos

```powershell
npm run dev         # dev server
npm run build       # build produção
npm run start       # produção local (necessita build prévio)
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint
```

---

## 5. Deploy via Docker (VPS)

### Build da imagem

No VPS, com o repositório clonado:

```bash
docker compose build
```

> ⚠️ As variáveis `NEXT_PUBLIC_*` têm de existir no momento do **build** porque
> são embebidas no bundle do browser. As privadas (`SUPABASE_SERVICE_ROLE_KEY`,
> `SMTP_*`) são lidas em runtime — basta tê-las no `.env`.

### Subir o container

Cria um `.env` no VPS (mesmo formato do `.env.example`, sem ser commitado) e:

```bash
docker compose up -d
```

A app fica em `http://<vps>:3000` (ou na porta definida em `APP_PORT`).

### Reverse proxy (recomendado)

Para servir em HTTPS num domínio próprio, põe um **Nginx** ou **Traefik** à frente:

**Nginx mínimo:**

```nginx
server {
    listen 443 ssl http2;
    server_name formulario.nossaseguros.ao;

    # ssl_certificate / ssl_certificate_key (Let's Encrypt via certbot)

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Atualizar

```bash
git pull
docker compose build
docker compose up -d
```

### Logs

```bash
docker compose logs -f app
```

---

## 6. Segurança

- `SUPABASE_SERVICE_ROLE_KEY` **só existe no servidor** (nunca é enviada ao browser).
- RLS está activo nas tabelas — nenhuma escrita/leitura é permitida via `anon` key.
- Toda a inserção passa pela API route com validação Zod.
- O `.env.local` está no `.gitignore` — confirma sempre antes de fazer commit.
- **Recomendação:** rodar a `service_role` key sempre que for partilhada acidentalmente
  (Supabase Dashboard → API → "Reset" ao lado de service_role).

---

## 7. TO-DOs futuros (sugestões)

- Backoffice para a equipa Nossa visualizar/exportar submissões (Supabase Auth + página `/admin`)
- Re-envio de email em caso de falha
- Captcha (hCaptcha / Turnstile) na submissão
- Notificação webhook para sistemas internos da Nossa
- Versão pixel-perfect do PDF (sobreposição em template do PDF original em vez de geração from scratch)
- Logs estruturados (Pino + envio para Logtail/Better Stack)

---

## 8. Suporte

Para questões técnicas sobre este projeto: contacta a equipa de desenvolvimento.

Para questões sobre o seguro: <geral@nossaseguros.ao> · (+244) 222 670 700
