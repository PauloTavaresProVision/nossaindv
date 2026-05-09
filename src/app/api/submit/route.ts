import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { submissaoSchema } from "@/lib/validation";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase/server";
import { generateBeneficiariesPdf } from "@/lib/pdf";
import {
  isEmailConfigured,
  sendBeneficiariesCopyEmail,
} from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = submissaoSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Dados inválidos.",
          errors: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const hdrs = await headers();
    const ipAddress =
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      hdrs.get("x-real-ip") ||
      null;
    const userAgent = hdrs.get("user-agent") || null;

    // 1) Inserir submissao
    const { data: submissao, error: submissaoErr } = await supabaseAdmin
      .from("submissoes")
      .insert({
        nome_completo: data.nomeCompleto,
        numero_apolice: data.numeroApolice,
        endereco: data.endereco,
        nif: data.nif,
        telefone: data.telefone,
        email: data.email,
        declaracao_aceite: data.declaracaoAceite,
        idioma: data.idioma,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select("id")
      .single();

    if (submissaoErr || !submissao) {
      console.error("[submit] insert submissao failed:", submissaoErr);
      return NextResponse.json(
        { message: "Erro ao gravar submissão." },
        { status: 500 }
      );
    }

    const submissionId = submissao.id as string;

    // 2) Inserir beneficiarios
    const beneficiariosRows = data.beneficiarios.map((b, idx) => ({
      submissao_id: submissionId,
      nome_completo: b.nomeCompleto,
      data_nascimento: b.dataNascimento || null,
      bi_passaporte: b.biPassaporte || null,
      grau_parentesco: b.grauParentesco || null,
      percentagem: b.percentagem ?? null,
      ordem: idx,
    }));

    const { error: benefErr } = await supabaseAdmin
      .from("beneficiarios")
      .insert(beneficiariosRows);

    if (benefErr) {
      console.error("[submit] insert beneficiarios failed:", benefErr);
      // não rebenta — submissão já foi guardada; segue em frente.
    }

    // 3) Gerar PDF
    let pdfBytes: Uint8Array | null = null;
    let pdfStoragePath: string | null = null;
    try {
      pdfBytes = await generateBeneficiariesPdf({
        ...data,
        submissionId,
        submissionDate: new Date(),
      });

      // 4) Upload para Storage
      const fileName = `${new Date().getFullYear()}/${submissionId}.pdf`;
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, Buffer.from(pdfBytes), {
          contentType: "application/pdf",
          upsert: true,
        });
      if (uploadErr) {
        console.error("[submit] storage upload failed:", uploadErr);
      } else {
        pdfStoragePath = fileName;
        await supabaseAdmin
          .from("submissoes")
          .update({ pdf_storage_path: fileName })
          .eq("id", submissionId);
      }
    } catch (e) {
      console.error("[submit] pdf generation failed:", e);
    }

    // 5) Enviar email (se SMTP configurado e PDF disponível)
    if (pdfBytes && isEmailConfigured()) {
      try {
        await sendBeneficiariesCopyEmail({
          to: data.email,
          name: data.nomeCompleto,
          submissionId,
          pdfBuffer: pdfBytes,
          locale: data.idioma,
          bcc: process.env.INTERNAL_NOTIFICATION_EMAIL || undefined,
        });
        await supabaseAdmin
          .from("submissoes")
          .update({ email_enviado: true })
          .eq("id", submissionId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        console.error("[submit] email send failed:", msg);
        await supabaseAdmin
          .from("submissoes")
          .update({ email_erro: msg })
          .eq("id", submissionId);
      }
    } else if (!isEmailConfigured()) {
      console.warn("[submit] SMTP não configurado — email não enviado");
    }

    return NextResponse.json({ id: submissionId, pdfStoragePath });
  } catch (e) {
    console.error("[submit] unexpected error:", e);
    return NextResponse.json(
      { message: "Erro inesperado." },
      { status: 500 }
    );
  }
}
