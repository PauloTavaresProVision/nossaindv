import "server-only";
import nodemailer from "nodemailer";

const HOST = process.env.SMTP_HOST;
const PORT = Number(process.env.SMTP_PORT ?? 587);
const SECURE = process.env.SMTP_SECURE === "true";
const USER = process.env.SMTP_USER;
const PASS = process.env.SMTP_PASS;
const FROM_NAME = process.env.SMTP_FROM_NAME ?? "Nossa Seguros";
const FROM_EMAIL = process.env.SMTP_FROM_EMAIL ?? USER ?? "";

let transporter: nodemailer.Transporter | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(HOST && USER && PASS && FROM_EMAIL);
}

function getTransporter(): nodemailer.Transporter {
  if (!isEmailConfigured()) {
    throw new Error(
      "SMTP não configurado. Define SMTP_HOST, SMTP_USER, SMTP_PASS e SMTP_FROM_EMAIL no .env.local"
    );
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: SECURE,
      auth: { user: USER, pass: PASS },
    });
  }
  return transporter;
}

interface EmailLabels {
  subject: string;
  greeting: (name: string) => string;
  body: string;
  reference: (id: string) => string;
  support: string;
  regards: string;
  team: string;
  automaticEmail: string;
}

const LABELS: Record<string, EmailLabels> = {
  pt: {
    subject: "Cópia da sua Nomeação de Beneficiários - Nossa Seguros",
    greeting: (n) => `Caro(a) ${n},`,
    body: "Em anexo segue a cópia em PDF do formulário de Nomeação de Beneficiários do Seguro de Vida Individual que submeteu através do nosso portal.",
    reference: (id) => `Referência da submissão: ${id}`,
    support: "Para qualquer questão, contacte o nosso Contact Center através do +244 923 190 860 ou de geral@nossaseguros.ao.",
    regards: "Com os melhores cumprimentos,",
    team: "Equipa Nossa Seguros",
    automaticEmail: "Este é um email automático. Por favor, não responda a esta mensagem.",
  },
  en: {
    subject: "Copy of your Beneficiary Designation - Nossa Seguros",
    greeting: (n) => `Dear ${n},`,
    body: "Please find attached the PDF copy of the Beneficiary Designation form for the Individual Life Insurance you submitted through our portal.",
    reference: (id) => `Submission reference: ${id}`,
    support: "For any questions, contact our Contact Center at +244 923 190 860 or geral@nossaseguros.ao.",
    regards: "Best regards,",
    team: "Nossa Seguros Team",
    automaticEmail: "This is an automatic email. Please do not reply.",
  },
  fr: {
    subject: "Copie de votre Désignation de Bénéficiaires - Nossa Seguros",
    greeting: (n) => `Cher/Chère ${n},`,
    body: "Veuillez trouver ci-joint la copie PDF du formulaire de Désignation des Bénéficiaires de l'Assurance Vie Individuelle que vous avez soumis via notre portail.",
    reference: (id) => `Référence de la soumission : ${id}`,
    support: "Pour toute question, contactez notre Contact Center au +244 923 190 860 ou à geral@nossaseguros.ao.",
    regards: "Cordialement,",
    team: "Équipe Nossa Seguros",
    automaticEmail: "Ceci est un email automatique. Merci de ne pas y répondre.",
  },
};

function buildHtml(labels: EmailLabels, name: string, id: string): string {
  return `<!DOCTYPE html>
<html lang="pt">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${labels.subject}</title>
  </head>
  <body style="margin:0; padding:0; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background:#f4f6fa; color:#1a2238;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.06);">
            <tr>
              <td style="background:#0f2952; padding:24px 32px;">
                <div style="color:#ffffff; font-weight:700; font-size:22px; letter-spacing:1px;">NOSSA</div>
                <div style="color:#cfe7b3; font-weight:500; font-size:11px; letter-spacing:3px; margin-top:2px;">SEGUROS</div>
              </td>
            </tr>
            <tr>
              <td style="background:#7fbe3d; height:6px;"></td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px; font-size:16px;">${labels.greeting(name)}</p>
                <p style="margin:0 0 16px; font-size:14px; line-height:1.6;">${labels.body}</p>
                <div style="background:#f4f6fa; border-left:4px solid #7fbe3d; padding:12px 16px; margin:20px 0; border-radius:4px; font-size:13px;">
                  <strong>${labels.reference(id)}</strong>
                </div>
                <p style="margin:0 0 16px; font-size:13px; color:#4a5273; line-height:1.6;">${labels.support}</p>
                <p style="margin:24px 0 4px; font-size:14px;">${labels.regards}</p>
                <p style="margin:0; font-weight:600; font-size:14px;">${labels.team}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px; background:#f4f6fa; font-size:11px; color:#7d8495; text-align:center;">
                ${labels.automaticEmail}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export interface SendCopyEmailInput {
  to: string;
  name: string;
  submissionId: string;
  pdfBuffer: Uint8Array;
  locale: "pt" | "en" | "fr";
  bcc?: string;
}

export async function sendBeneficiariesCopyEmail(input: SendCopyEmailInput): Promise<void> {
  const labels = LABELS[input.locale] ?? LABELS.pt;
  const t = getTransporter();

  await t.sendMail({
    from: { name: FROM_NAME, address: FROM_EMAIL },
    to: input.to,
    bcc: input.bcc || undefined,
    subject: labels.subject,
    html: buildHtml(labels, input.name, input.submissionId),
    text: [
      labels.greeting(input.name),
      "",
      labels.body,
      "",
      labels.reference(input.submissionId),
      "",
      labels.support,
      "",
      labels.regards,
      labels.team,
      "",
      labels.automaticEmail,
    ].join("\n"),
    attachments: [
      {
        filename: `nomeacao-beneficiarios-${input.submissionId}.pdf`,
        content: Buffer.from(input.pdfBuffer),
        contentType: "application/pdf",
      },
    ],
  });
}

export async function verifyEmailConfig(): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  try {
    await getTransporter().verify();
    return true;
  } catch {
    return false;
  }
}
