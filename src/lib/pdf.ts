import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  PDFPage,
  LineCapStyle,
  StandardFonts,
  rgb,
  type PDFFont,
} from "pdf-lib";
import type { SubmissaoInput } from "./validation";

/**
 * Standard Helvetica usa WinAnsi encoding, que não suporta caracteres como
 * ✓ ✗ → emojis etc. Esta função substitui-os por equivalentes ASCII para evitar
 * crashes em runtime. Não é perfeito mas é defensivo.
 */
function safeText(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/[‐-―]/g, "-") // various dashes
    .replace(/[‘’]/g, "'") // smart single quotes
    .replace(/[“”]/g, '"') // smart double quotes
    .replace(/…/g, "...") // ellipsis (WinAnsi suporta mas seguro)
    .replace(/[✓✔✅]/g, "v") // checks
    .replace(/[✗✘❌]/g, "x") // crosses
    .replace(/[→➜➡]/g, ">") // right arrows
    .replace(/[←]/g, "<") // left arrow
    // remove qualquer outro char fora do BMP latim básico/suplementar
    .replace(/[^\x00-ÿ• ]/g, "");
}

async function tryLoadLogoBytes(): Promise<Uint8Array | null> {
  try {
    const filePath = path.join(process.cwd(), "public", "logo-nossa.png");
    const buf = await readFile(filePath);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

const COLORS = {
  brandBlue: rgb(0.06, 0.16, 0.32),
  brandGreen: rgb(0.49, 0.75, 0.24),
  text: rgb(0.1, 0.1, 0.15),
  muted: rgb(0.45, 0.45, 0.5),
  line: rgb(0.78, 0.83, 0.88),
  white: rgb(1, 1, 1),
};

const PAGE_WIDTH = 595.28;  // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;

interface DrawCtx {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
}

function drawText(
  ctx: DrawCtx,
  text: string,
  x: number,
  y: number,
  options: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {}
) {
  const { size = 9, bold = false, color = COLORS.text } = options;
  ctx.page.drawText(safeText(text), {
    x,
    y,
    size,
    font: bold ? ctx.bold : ctx.font,
    color,
  });
}

function drawLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = COLORS.line,
  thickness = 0.5
) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color,
  });
}

function drawRect(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  fill?: ReturnType<typeof rgb>,
  border = COLORS.line
) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: fill,
    borderColor: border,
    borderWidth: 0.5,
  });
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const words = safeText(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawWrapped(
  ctx: DrawCtx,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  options: { size?: number; lineHeight?: number; color?: ReturnType<typeof rgb> } = {}
): number {
  const { size = 9, lineHeight = 12, color = COLORS.text } = options;
  const lines = wrapText(text, ctx.font, size, maxWidth);
  let curY = y;
  for (const line of lines) {
    ctx.page.drawText(line, { x, y: curY, size, font: ctx.font, color });
    curY -= lineHeight;
  }
  return curY;
}

function fmtDate(value: string | undefined, locale: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  try {
    return d.toLocaleDateString(localeMap(locale));
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function localeMap(locale: string): string {
  switch (locale) {
    case "en":
      return "en-GB";
    case "fr":
      return "fr-FR";
    default:
      return "pt-PT";
  }
}

/** Fallback do logo quando o PNG não está disponível: NOSSA verde + SEGUROS azul. */
function drawLogoText(ctx: DrawCtx) {
  // pequeno globo azul à esquerda
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 42,
    width: 36,
    height: 36,
    color: COLORS.brandBlue,
    borderColor: COLORS.brandBlue,
  });
  ctx.page.drawCircle({
    x: MARGIN + 18,
    y: ctx.y - 24,
    size: 13,
    borderColor: rgb(0.49, 0.64, 0.84),
    borderWidth: 0.5,
  });
  ctx.page.drawLine({
    start: { x: MARGIN + 5, y: ctx.y - 24 },
    end: { x: MARGIN + 31, y: ctx.y - 24 },
    color: rgb(0.49, 0.64, 0.84),
    thickness: 0.5,
  });

  // NOSSA — verde
  drawText(ctx, "NOSSA", MARGIN + 46, ctx.y - 22, {
    size: 22,
    bold: true,
    color: COLORS.brandGreen,
  });
  // SEGUROS — azul escuro
  drawText(ctx, "S E G U R O S", MARGIN + 46, ctx.y - 38, {
    size: 8,
    color: COLORS.brandBlue,
  });
}

interface I18nLabels {
  productName: string;
  formName: string;
  formNumber: string;
  fillInstruction: string;
  policyHolderSection: string;
  insuredPersonSection: string;
  fields: {
    fullName: string;
    policyNumber: string;
    address: string;
    nif: string;
    phone: string;
    email: string;
  };
  declaration: {
    intro: string;
    outro: string;
    deathClause: string;
    confirmation: string;
  };
  beneficiaries: {
    fullName: string;
    birthDate: string;
    idDocument: string;
    relationship: string;
    percentage: string;
  };
  consent: {
    updateNotice: string;
    dataProcessing: string;
    integralPart: string;
    agree: string;
  };
  acceptance: {
    title: string;
    line1: string;
    line2: (date: string) => string;
    line3: (id: string) => string;
    date: string;
  };
  footer: {
    company: string;
    address: string;
    contactCenterLabel: string;
    contactCenterNumber: string;
    website: string;
    legal: string;
  };
}

const LABELS: Record<string, I18nLabels> = {
  pt: {
    productName: "SEGURO DE VIDA INDIVIDUAL",
    formName: "FORMULÁRIO DE NOMEAÇÃO DE BENEFICIÁRIOS",
    formNumber: "01",
    fillInstruction: "PREENCHIDO ATRAVÉS DE FORMULÁRIO DIGITAL",
    policyHolderSection: "TOMADOR DO SEGURO/PESSOA SEGURA",
    insuredPersonSection: "PESSOA SEGURA",
    fields: {
      fullName: "Nome Completo:",
      policyNumber: "Número da Apólice:",
      address: "Endereço:",
      nif: "NIF:",
      phone: "Telefone:",
      email: "Email:",
    },
    declaration: {
      intro: "Eu,",
      outro: ", reconheço que fui informado(a) sobre os Termos e Condições da Apólice do Seguro de Vida Individual.",
      deathClause: "Estou ciente de que em caso de Morte será pago o Capital Seguro ao(s) beneficiário(s) abaixo declarados.",
      confirmation: "Confirmo que o(s) beneficiário(s) desta Apólice é/são os seguintes:",
    },
    beneficiaries: {
      fullName: "Nome Completo",
      birthDate: "Data de Nascimento",
      idDocument: "B.I. / Passaporte",
      relationship: "Grau de Parentesco",
      percentage: "Beneficiário (%)",
    },
    consent: {
      updateNotice: "Estou ciente que deverei actualizar este formulário sempre que necessário e submeter à NOSSA.",
      dataProcessing: "Autorizo que os dados recolhidos no presente documento, bem como em outros documentos que vierem a ser fornecidos posteriormente, nomeadamente aquando da participação de um sinistro, sejam processados e armazenados informaticamente para efeitos de gestão da Apólice do Seguro de Vida Individual, incluindo a disponibilização dos dados a outras empresas, nomeadamente do grupo, subcontratadas e resseguradores, podendo envolver a transferência da informação para outros países, bem como para efeitos de marketing directo.",
      integralPart: "Concordo que esta confirmação seja parte integrante da Apólice.",
      agree: "Li e concordo com as declarações e autorizações.",
    },
    acceptance: {
      title: "ACEITAÇÃO DIGITAL",
      line1: "Este formulário foi submetido digitalmente. O Segurado declarou ter lido e aceitado as declarações e autorizações acima.",
      line2: (d) => `Aceitação registada em: ${d}`,
      line3: (id) => `Referência da submissão: ${id}`,
      date: "Data:",
    },
    footer: {
      company: "Nova Sociedade de Seguros de Angola, S. A.",
      address: 'Av. Pedro de Castro Van-Dúnem "Loy", Academia BAI, Bloco C, 4º Andar, Morro Bento, Luanda Sul – Angola',
      contactCenterLabel: "Contact Center",
      contactCenterNumber: "+244 923 190 860",
      website: "www.nossaseguros.ao",
      legal: "Nossa Seguros, S.A - Capital Social: AKZ 5.000.000.000,00 - Reg. Cons. Reg. Com. Luanda Nº 1142 (5/11/2004) - N.I.F. 5401113420",
    },
  },
  en: {
    productName: "INDIVIDUAL LIFE INSURANCE",
    formName: "BENEFICIARY DESIGNATION FORM",
    formNumber: "01",
    fillInstruction: "COMPLETED VIA DIGITAL FORM",
    policyHolderSection: "POLICYHOLDER / INSURED PERSON",
    insuredPersonSection: "INSURED PERSON",
    fields: {
      fullName: "Full name:",
      policyNumber: "Policy number:",
      address: "Address:",
      nif: "Tax ID:",
      phone: "Phone:",
      email: "Email:",
    },
    declaration: {
      intro: "I,",
      outro: ", acknowledge that I have been informed of the Terms and Conditions of the Individual Life Insurance Policy.",
      deathClause: "I am aware that in the event of Death the Insured Capital will be paid to the beneficiary(ies) declared below.",
      confirmation: "I confirm that the beneficiary(ies) of this Policy is/are the following:",
    },
    beneficiaries: {
      fullName: "Full name",
      birthDate: "Date of birth",
      idDocument: "ID / Passport",
      relationship: "Relationship",
      percentage: "Share (%)",
    },
    consent: {
      updateNotice: "I am aware that I must update this form whenever necessary and submit it to NOSSA.",
      dataProcessing: "I authorise the data collected in this document, as well as in any other documents to be provided later, namely upon claim submission, to be processed and stored electronically for the purposes of managing the Individual Life Insurance Policy, including disclosure to other companies (in particular within the group, subcontractors and reinsurers), which may involve transferring information to other countries, as well as for direct marketing purposes.",
      integralPart: "I agree that this confirmation forms an integral part of the Policy.",
      agree: "I have read and agree with the declarations and authorisations.",
    },
    acceptance: {
      title: "DIGITAL ACCEPTANCE",
      line1: "This form was submitted digitally. The Insured declared having read and accepted the declarations and authorisations above.",
      line2: (d) => `Acceptance recorded on: ${d}`,
      line3: (id) => `Submission reference: ${id}`,
      date: "Date:",
    },
    footer: {
      company: "Nova Sociedade de Seguros de Angola, S. A.",
      address: 'Av. Pedro de Castro Van-Dúnem "Loy", Academia BAI, Bloco C, 4th Floor, Morro Bento, Luanda Sul – Angola',
      contactCenterLabel: "Contact Center",
      contactCenterNumber: "+244 923 190 860",
      website: "www.nossaseguros.ao",
      legal: "Nossa Seguros, S.A - Share Capital: AKZ 5,000,000,000.00 - Commercial Registry of Luanda Nº 1142 (5/11/2004) - Tax ID 5401113420",
    },
  },
  fr: {
    productName: "ASSURANCE VIE INDIVIDUELLE",
    formName: "FORMULAIRE DE DESIGNATION DES BENEFICIAIRES",
    formNumber: "01",
    fillInstruction: "REMPLI VIA FORMULAIRE NUMERIQUE",
    policyHolderSection: "SOUSCRIPTEUR / ASSURE",
    insuredPersonSection: "PERSONNE ASSUREE",
    fields: {
      fullName: "Nom complet:",
      policyNumber: "Numero de police:",
      address: "Adresse:",
      nif: "Numero fiscal:",
      phone: "Telephone:",
      email: "Email:",
    },
    declaration: {
      intro: "Je soussigne(e),",
      outro: ", reconnais avoir ete informe(e) des Conditions Generales de la Police d'Assurance Vie Individuelle.",
      deathClause: "Je suis conscient(e) qu'en cas de Deces le Capital Assure sera verse au(x) beneficiaire(s) designe(s) ci-dessous.",
      confirmation: "Je confirme que le(s) beneficiaire(s) de cette Police est/sont le(s) suivant(s):",
    },
    beneficiaries: {
      fullName: "Nom complet",
      birthDate: "Date de naissance",
      idDocument: "C.I. / Passeport",
      relationship: "Lien de parente",
      percentage: "Quote-part (%)",
    },
    consent: {
      updateNotice: "Je suis conscient(e) que je devrai mettre a jour ce formulaire chaque fois que necessaire et le soumettre a NOSSA.",
      dataProcessing: "J'autorise le traitement et la conservation informatique des donnees recueillies dans le present document, ainsi que dans d'autres documents fournis ulterieurement, notamment lors d'une declaration de sinistre, aux fins de gestion de la Police d'Assurance Vie Individuelle, y compris la communication des donnees a d'autres entreprises, notamment au sein du groupe, a des sous-traitants et a des reassureurs, pouvant impliquer le transfert d'informations vers d'autres pays, ainsi qu'a des fins de marketing direct.",
      integralPart: "J'accepte que cette confirmation fasse partie integrante de la Police.",
      agree: "J'ai lu et j'accepte les declarations et autorisations.",
    },
    acceptance: {
      title: "ACCEPTATION NUMERIQUE",
      line1: "Ce formulaire a ete soumis numeriquement. L'Assure declare avoir lu et accepte les declarations et autorisations ci-dessus.",
      line2: (d) => `Acceptation enregistree le: ${d}`,
      line3: (id) => `Reference de la soumission: ${id}`,
      date: "Date:",
    },
    footer: {
      company: "Nova Sociedade de Seguros de Angola, S. A.",
      address: 'Av. Pedro de Castro Van-Dunem "Loy", Academia BAI, Bloco C, 4eme etage, Morro Bento, Luanda Sul - Angola',
      contactCenterLabel: "Contact Center",
      contactCenterNumber: "+244 923 190 860",
      website: "www.nossaseguros.ao",
      legal: "Nossa Seguros, S.A - Capital Social: AKZ 5.000.000.000,00 - Reg. Cons. Reg. Com. Luanda N 1142 (5/11/2004) - N.I.F. 5401113420",
    },
  },
};

export interface PdfPayload extends SubmissaoInput {
  submissionId: string;
  submissionDate: Date;
}

export async function generateBeneficiariesPdf(
  payload: PdfPayload
): Promise<Uint8Array> {
  const labels = LABELS[payload.idioma] ?? LABELS.pt;

  const pdf = await PDFDocument.create();
  pdf.setTitle("Formulário de Nomeação de Beneficiários");
  pdf.setAuthor("Nossa Seguros");
  pdf.setSubject(labels.formName);
  pdf.setProducer("nossaseguros.ao");
  pdf.setCreator("Portal Digital Nossa");
  pdf.setCreationDate(new Date());

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const ctx: DrawCtx = { page, font, bold, y: PAGE_HEIGHT - MARGIN };

  // ============== HEADER ==============
  const logoBytes = await tryLoadLogoBytes();
  if (logoBytes) {
    // Logo oficial (PNG em public/logo-nossa.png)
    try {
      const logoImg = await pdf.embedPng(logoBytes);
      const logoH = 42;
      const logoW = logoImg.width * (logoH / logoImg.height);
      page.drawImage(logoImg, {
        x: MARGIN,
        y: ctx.y - logoH,
        width: logoW,
        height: logoH,
      });
    } catch {
      drawLogoText(ctx);
    }
  } else {
    drawLogoText(ctx);
  }

  // Banner verde com nome do produto à direita
  const bannerX = 270;
  const bannerY = ctx.y - 42;
  const bannerW = PAGE_WIDTH - MARGIN - bannerX - 30;
  drawRect(page, bannerX, bannerY, bannerW, 36, COLORS.brandGreen, COLORS.brandGreen);
  drawText(ctx, labels.productName, bannerX + 12, bannerY + 22, {
    size: 11,
    bold: true,
    color: COLORS.white,
  });
  drawText(ctx, labels.formName, bannerX + 12, bannerY + 8, {
    size: 7,
    color: COLORS.white,
  });

  // Badge "01" circular
  const badgeR = 14;
  const badgeCx = bannerX + bannerW + 16;
  const badgeCy = bannerY + 18;
  page.drawCircle({
    x: badgeCx,
    y: badgeCy,
    size: badgeR,
    color: COLORS.brandGreen,
    borderColor: COLORS.white,
    borderWidth: 1.5,
  });
  drawText(ctx, labels.formNumber, badgeCx - 7, badgeCy - 4, {
    size: 11,
    bold: true,
    color: COLORS.white,
  });

  ctx.y = bannerY - 24;

  // ============== INSTRUÇÃO ==============
  drawText(ctx, labels.fillInstruction, MARGIN, ctx.y, {
    size: 6.5,
    color: COLORS.muted,
  });
  ctx.y -= 8;
  drawLine(page, MARGIN, ctx.y, PAGE_WIDTH - MARGIN, ctx.y, COLORS.line, 0.5);
  ctx.y -= 14;
  drawText(ctx, labels.policyHolderSection, PAGE_WIDTH / 2 - 90, ctx.y, {
    size: 9,
    bold: true,
  });
  ctx.y -= 6;
  drawLine(page, MARGIN, ctx.y, PAGE_WIDTH - MARGIN, ctx.y, COLORS.brandGreen, 0.7);
  ctx.y -= 18;

  // ============== DADOS DO TOMADOR ==============
  const colW = (PAGE_WIDTH - MARGIN * 2) / 2;
  const labelOpts = { size: 8, color: COLORS.muted } as const;
  const valueOpts = { size: 9, color: COLORS.text } as const;

  const drawField = (
    x: number,
    y: number,
    label: string,
    value: string,
    width: number
  ) => {
    drawText(ctx, label, x, y, labelOpts);
    drawText(ctx, value || "—", x, y - 12, valueOpts);
    drawLine(page, x, y - 16, x + width - 10, y - 16, COLORS.line, 0.4);
  };

  drawField(MARGIN, ctx.y, labels.fields.fullName, payload.nomeCompleto, colW);
  drawField(MARGIN + colW, ctx.y, labels.fields.policyNumber, payload.numeroApolice, colW);
  ctx.y -= 30;

  drawField(MARGIN, ctx.y, labels.fields.address, payload.endereco, colW);
  drawField(MARGIN + colW, ctx.y, labels.fields.nif, payload.nif, colW);
  ctx.y -= 30;

  drawField(MARGIN, ctx.y, labels.fields.phone, payload.telefone, colW);
  drawField(MARGIN + colW, ctx.y, labels.fields.email, payload.email, colW);
  ctx.y -= 30;

  // ============== SECÇÃO PESSOA SEGURA ==============
  drawText(ctx, labels.insuredPersonSection, PAGE_WIDTH / 2 - 50, ctx.y, {
    size: 9,
    bold: true,
  });
  ctx.y -= 6;
  drawLine(page, MARGIN, ctx.y, PAGE_WIDTH - MARGIN, ctx.y, COLORS.brandGreen, 0.7);
  ctx.y -= 16;

  // Declaração: "Eu, NOME, reconheço..."
  ctx.y = drawWrapped(
    ctx,
    `${labels.declaration.intro} ${payload.nomeCompleto}${labels.declaration.outro}`,
    MARGIN,
    ctx.y,
    PAGE_WIDTH - MARGIN * 2,
    { size: 9, lineHeight: 12 }
  );
  ctx.y -= 6;
  ctx.y = drawWrapped(ctx, labels.declaration.deathClause, MARGIN, ctx.y, PAGE_WIDTH - MARGIN * 2);
  ctx.y -= 6;
  ctx.y = drawWrapped(ctx, labels.declaration.confirmation, MARGIN, ctx.y, PAGE_WIDTH - MARGIN * 2);
  ctx.y -= 12;

  // ============== TABELA DE BENEFICIÁRIOS ==============
  const tableX = MARGIN;
  const tableW = PAGE_WIDTH - MARGIN * 2;
  const cols = [
    { label: labels.beneficiaries.fullName, w: 0.32 },
    { label: labels.beneficiaries.birthDate, w: 0.16 },
    { label: labels.beneficiaries.idDocument, w: 0.18 },
    { label: labels.beneficiaries.relationship, w: 0.19 },
    { label: labels.beneficiaries.percentage, w: 0.15 },
  ];
  const rowH = 18;
  const headerH = 22;

  // Header
  drawRect(page, tableX, ctx.y - headerH, tableW, headerH, COLORS.white, COLORS.line);
  let cx = tableX;
  cols.forEach((c) => {
    const w = tableW * c.w;
    drawText(ctx, c.label, cx + 4, ctx.y - 14, { size: 8, bold: true });
    cx += w;
    if (cx < tableX + tableW - 0.5) {
      drawLine(page, cx, ctx.y - headerH, cx, ctx.y, COLORS.line, 0.4);
    }
  });
  ctx.y -= headerH;

  // Linhas
  const minRows = Math.max(payload.beneficiarios.length, 6);
  for (let i = 0; i < minRows; i++) {
    const b = payload.beneficiarios[i];
    drawRect(page, tableX, ctx.y - rowH, tableW, rowH, undefined, COLORS.line);
    cx = tableX;
    if (b) {
      const cells = [
        b.nomeCompleto || "",
        fmtDate(b.dataNascimento, payload.idioma),
        b.biPassaporte || "",
        b.grauParentesco || "",
        b.percentagem !== undefined ? String(b.percentagem) : "",
      ];
      cells.forEach((value, idx) => {
        const w = tableW * cols[idx].w;
        const truncated = truncate(value, font, 9, w - 8);
        drawText(ctx, truncated, cx + 4, ctx.y - 12, { size: 9 });
        cx += w;
      });
    } else {
      cols.forEach((c) => {
        cx += tableW * c.w;
      });
    }
    // separadores verticais
    cx = tableX;
    cols.forEach((c, idx) => {
      cx += tableW * c.w;
      if (idx < cols.length - 1) {
        drawLine(page, cx, ctx.y - rowH, cx, ctx.y, COLORS.line, 0.4);
      }
    });
    ctx.y -= rowH;
  }
  ctx.y -= 10;

  // ============== AUTORIZAÇÕES ==============
  ctx.y = drawWrapped(ctx, labels.consent.updateNotice, MARGIN, ctx.y, PAGE_WIDTH - MARGIN * 2, {
    size: 8,
    lineHeight: 11,
  });
  ctx.y -= 6;
  ctx.y = drawWrapped(ctx, labels.consent.dataProcessing, MARGIN, ctx.y, PAGE_WIDTH - MARGIN * 2, {
    size: 7.5,
    lineHeight: 10,
  });
  ctx.y -= 6;
  ctx.y = drawWrapped(ctx, labels.consent.integralPart, MARGIN, ctx.y, PAGE_WIDTH - MARGIN * 2, {
    size: 8,
    lineHeight: 11,
  });
  ctx.y -= 18;

  // ============== DATA + ACEITAÇÃO DIGITAL ==============
  // Coluna esquerda: Data
  drawText(ctx, labels.acceptance.date, MARGIN, ctx.y, labelOpts);
  drawText(
    ctx,
    payload.submissionDate.toLocaleDateString(localeMap(payload.idioma)),
    MARGIN,
    ctx.y - 12,
    valueOpts
  );

  // Coluna direita: caixa "ACEITAÇÃO DIGITAL" com bordo verde
  const accX = PAGE_WIDTH / 2 + 20;
  const accW = PAGE_WIDTH - MARGIN - accX;
  const accBoxH = 70;
  const accBoxY = ctx.y - accBoxH + 10;

  // Caixa com fundo verde claro e bordo verde
  page.drawRectangle({
    x: accX,
    y: accBoxY,
    width: accW,
    height: accBoxH,
    color: rgb(0.93, 0.97, 0.83),
    borderColor: COLORS.brandGreen,
    borderWidth: 1,
  });

  // Cabeçalho da caixa: barra verde com check
  page.drawRectangle({
    x: accX,
    y: accBoxY + accBoxH - 16,
    width: accW,
    height: 16,
    color: COLORS.brandGreen,
  });
  // Check ícone — desenhado com linhas (independente da fonte)
  const checkX = accX + 5;
  const checkY = accBoxY + accBoxH - 11;
  page.drawLine({
    start: { x: checkX, y: checkY },
    end: { x: checkX + 3, y: checkY - 3 },
    color: COLORS.white,
    thickness: 1.4,
    lineCap: LineCapStyle.Round,
  });
  page.drawLine({
    start: { x: checkX + 3, y: checkY - 3 },
    end: { x: checkX + 8, y: checkY + 4 },
    color: COLORS.white,
    thickness: 1.4,
    lineCap: LineCapStyle.Round,
  });
  drawText(ctx, labels.acceptance.title, accX + 18, accBoxY + accBoxH - 12, {
    size: 8,
    bold: true,
    color: COLORS.white,
  });

  // Conteúdo da caixa
  let accY = accBoxY + accBoxH - 24;
  accY = drawWrapped(ctx, labels.acceptance.line1, accX + 6, accY, accW - 12, {
    size: 7,
    lineHeight: 9,
  });
  accY -= 2;
  drawText(
    ctx,
    labels.acceptance.line2(
      payload.submissionDate.toLocaleString(localeMap(payload.idioma))
    ),
    accX + 6,
    accY,
    { size: 6.5, color: COLORS.muted }
  );
  drawText(
    ctx,
    labels.acceptance.line3(payload.submissionId),
    accX + 6,
    accY - 9,
    { size: 6.5, color: COLORS.muted }
  );

  ctx.y = accBoxY - 8;

  // ============== FOOTER ==============
  const footerY = MARGIN + 8;
  drawLine(
    page,
    MARGIN,
    footerY + 38,
    PAGE_WIDTH - MARGIN,
    footerY + 38,
    COLORS.brandGreen,
    0.8
  );
  drawText(
    ctx,
    labels.footer.company + " | " + labels.footer.address,
    MARGIN,
    footerY + 26,
    { size: 6, color: COLORS.muted }
  );
  drawText(
    ctx,
    `${labels.footer.contactCenterLabel}: ${labels.footer.contactCenterNumber} | ${labels.footer.website}`,
    MARGIN,
    footerY + 16,
    { size: 6, bold: true, color: COLORS.brandBlue }
  );
  drawText(ctx, labels.footer.legal, MARGIN, footerY + 6, {
    size: 6,
    color: COLORS.muted,
  });
  drawText(ctx, "1/1", PAGE_WIDTH - MARGIN - 12, footerY + 6, {
    size: 6,
    color: COLORS.muted,
  });

  return await pdf.save();
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const clean = safeText(text);
  if (!clean) return "";
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  let out = clean;
  while (out.length > 0 && font.widthOfTextAtSize(out + "...", size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + "...";
}
