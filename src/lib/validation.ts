import { z } from "zod";

const optionalTrim = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const beneficiarioSchema = z.object({
  nomeCompleto: z.string().trim().min(2),
  dataNascimento: optionalTrim,
  biPassaporte: optionalTrim,
  grauParentesco: optionalTrim,
  percentagem: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
      return Number.isFinite(n) ? n : undefined;
    })
    .refine((v) => v === undefined || (v >= 0 && v <= 100), {
      message: "0..100",
    }),
});

export const submissaoSchema = z.object({
  nomeCompleto: z.string().trim().min(2),
  numeroApolice: z.string().trim().min(1),
  endereco: z.string().trim().min(2),
  nif: z
    .string()
    .trim()
    .regex(/^[0-9A-Z]{9,14}$/i),
  telefone: z
    .string()
    .trim()
    .regex(/^[+0-9 ()-]{6,30}$/),
  email: z.email(),
  declaracaoAceite: z.literal(true),
  idioma: z.enum(["pt", "en", "fr"]).default("pt"),
  beneficiarios: z.array(beneficiarioSchema).min(1),
});

export type BeneficiarioInput = z.infer<typeof beneficiarioSchema>;
export type SubmissaoInput = z.infer<typeof submissaoSchema>;
