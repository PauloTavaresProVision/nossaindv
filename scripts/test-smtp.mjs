#!/usr/bin/env node
/**
 * Teste de conectividade SMTP.
 *
 * Uso:
 *   node --env-file=.env.local scripts/test-smtp.mjs
 *     → apenas verifica a ligação (auth + handshake)
 *
 *   node --env-file=.env.local scripts/test-smtp.mjs destinatario@exemplo.com
 *     → verifica E envia um email de teste para o destinatário indicado
 */
import nodemailer from "nodemailer";

const HOST = process.env.SMTP_HOST;
const PORT = Number(process.env.SMTP_PORT ?? 587);
const SECURE = process.env.SMTP_SECURE === "true";
const USER = process.env.SMTP_USER;
const PASS = process.env.SMTP_PASS;
const FROM_NAME = process.env.SMTP_FROM_NAME ?? "Nossa Seguros";
const FROM_EMAIL = process.env.SMTP_FROM_EMAIL ?? USER ?? "";

console.log("┌─────────────────────────────────────");
console.log("│ Teste SMTP — Nossa Formulário");
console.log("├─────────────────────────────────────");
console.log("│ host    :", HOST);
console.log("│ port    :", PORT);
console.log("│ secure  :", SECURE);
console.log("│ user    :", USER);
console.log("│ pass    :", PASS ? `••• (${PASS.length} chars)` : "(vazio!)");
console.log("│ from    :", `${FROM_NAME} <${FROM_EMAIL}>`);
console.log("└─────────────────────────────────────\n");

if (!HOST || !USER || !PASS || !FROM_EMAIL) {
  console.error("✗ Faltam variáveis SMTP_HOST, SMTP_USER, SMTP_PASS ou SMTP_FROM_EMAIL");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: HOST,
  port: PORT,
  secure: SECURE,
  auth: { user: USER, pass: PASS },
  // Logging detalhado para diagnóstico
  logger: false,
  debug: false,
});

// 1) Verify
console.log("→ A verificar a ligação SMTP (auth + handshake)…");
try {
  await transporter.verify();
  console.log("✓ Verificação OK — credenciais válidas e servidor responde.\n");
} catch (e) {
  console.error("✗ Verificação falhou:");
  console.error("  ", e.message);
  if (e.code) console.error("  code:", e.code);
  if (e.response) console.error("  response:", e.response);
  if (e.command) console.error("  command:", e.command);
  console.error("\nDicas:");
  if (e.code === "EAUTH") {
    console.error("  • Password incorrecta. Verifica em .env.local.");
  } else if (e.code === "ETIMEDOUT" || e.code === "ECONNECTION") {
    console.error("  • Firewall/ISP bloqueia a porta. Tenta SMTP_PORT=587 + SMTP_SECURE=false.");
  } else if (e.code === "ESOCKET") {
    console.error("  • Problema de TLS. Confirma que SMTP_SECURE=true para porta 465.");
  }
  process.exit(2);
}

// 2) Envio de teste (se foi indicado destinatário)
const to = process.argv[2];
if (!to) {
  console.log("ℹ Para enviar um email de teste real, corre novamente assim:");
  console.log("  node --env-file=.env.local scripts/test-smtp.mjs <email-destino>\n");
  process.exit(0);
}

console.log(`→ A enviar email de teste para ${to}…`);
try {
  const info = await transporter.sendMail({
    from: { name: FROM_NAME, address: FROM_EMAIL },
    to,
    subject: "[Teste] Nossa Seguros — Formulário Beneficiários",
    text: [
      "Este é um email de teste do servidor SMTP configurado para o portal",
      "de Nomeação de Beneficiários da Nossa Seguros.",
      "",
      "Se está a ler isto, a configuração está correcta e o sistema vai",
      "conseguir enviar cópias em PDF aos clientes que submetam o formulário.",
      "",
      `Servidor: ${HOST}:${PORT}`,
      `Conta:    ${USER}`,
      `Data:     ${new Date().toLocaleString("pt-PT")}`,
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a2238;">
        <div style="background: #0a1d3f; padding: 16px 24px; color: #fff; border-radius: 8px 8px 0 0;">
          <strong style="font-size: 18px; letter-spacing: 1px;">NOSSA</strong>
          <span style="font-size: 11px; letter-spacing: 3px; margin-left: 4px; color: #cfe7b3;">SEGUROS — TESTE</span>
        </div>
        <div style="background: #fff; padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Este é um <strong>email de teste</strong> do servidor SMTP configurado para o portal de Nomeação de Beneficiários.</p>
          <p>Se está a ler isto, a configuração está correcta. ✓</p>
          <table style="margin-top: 16px; font-size: 13px; color: #555;">
            <tr><td style="padding: 2px 8px 2px 0;"><b>Servidor:</b></td><td>${HOST}:${PORT}</td></tr>
            <tr><td style="padding: 2px 8px 2px 0;"><b>Conta:</b></td><td>${USER}</td></tr>
            <tr><td style="padding: 2px 8px 2px 0;"><b>Data:</b></td><td>${new Date().toLocaleString("pt-PT")}</td></tr>
          </table>
        </div>
      </div>
    `,
  });
  console.log("✓ Email enviado!");
  console.log("  messageId :", info.messageId);
  console.log("  accepted  :", info.accepted);
  console.log("  rejected  :", info.rejected);
  console.log("  response  :", info.response);
} catch (e) {
  console.error("✗ Envio falhou:");
  console.error("  ", e.message);
  if (e.code) console.error("  code:", e.code);
  if (e.response) console.error("  response:", e.response);
  process.exit(3);
}
