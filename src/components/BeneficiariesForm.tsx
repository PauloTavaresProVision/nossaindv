"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";

type FormBeneficiario = {
  nomeCompleto: string;
  dataNascimento: string;
  biPassaporte: string;
  grauParentesco: string;
  percentagem: string;
};

type FormValues = {
  nomeCompleto: string;
  numeroApolice: string;
  endereco: string;
  nif: string;
  telefone: string;
  email: string;
  beneficiarios: FormBeneficiario[];
  declaracaoAceite: boolean;
};

const NIF_REGEX = /^[0-9A-Za-z]{9,14}$/;
const PHONE_REGEX = /^[+0-9 ()-]{6,30}$/;

const emptyBeneficiario = (): FormBeneficiario => ({
  nomeCompleto: "",
  dataNascimento: "",
  biPassaporte: "",
  grauParentesco: "",
  percentagem: "",
});

type PendingPayload = {
  nomeCompleto: string;
  numeroApolice: string;
  endereco: string;
  nif: string;
  telefone: string;
  email: string;
  declaracaoAceite: boolean;
  idioma: "pt" | "en" | "fr";
  beneficiarios: Array<{
    nomeCompleto: string;
    dataNascimento?: string;
    biPassaporte?: string;
    grauParentesco?: string;
    percentagem?: number;
  }>;
};

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; submissionId: string }
  | { status: "error"; message: string };

export function BeneficiariesForm() {
  const t = useTranslations("Form");
  const tSuccess = useTranslations("Success");
  const tErrors = useTranslations("Errors");
  const locale = useLocale() as "pt" | "en" | "fr";

  const [pendingPayload, setPendingPayload] = useState<PendingPayload | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      nomeCompleto: "",
      numeroApolice: "",
      endereco: "",
      nif: "",
      telefone: "",
      email: "",
      beneficiarios: [emptyBeneficiario()],
      declaracaoAceite: false,
    },
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "beneficiarios",
  });

  const relationshipKeys = [
    "spouse",
    "child",
    "parent",
    "sibling",
    "grandparent",
    "grandchild",
    "other",
  ] as const;

  function onSubmit(values: FormValues) {
    const payload: PendingPayload = {
      nomeCompleto: values.nomeCompleto.trim(),
      numeroApolice: values.numeroApolice.trim(),
      endereco: values.endereco.trim(),
      nif: values.nif.trim(),
      telefone: values.telefone.trim(),
      email: values.email.trim(),
      declaracaoAceite: values.declaracaoAceite,
      idioma: locale,
      beneficiarios: values.beneficiarios
        .filter((b) => b.nomeCompleto.trim().length > 0)
        .map((b) => ({
          nomeCompleto: b.nomeCompleto.trim(),
          dataNascimento: b.dataNascimento || undefined,
          biPassaporte: b.biPassaporte.trim() || undefined,
          grauParentesco: b.grauParentesco.trim() || undefined,
          percentagem:
            b.percentagem === "" ? undefined : Number(String(b.percentagem).replace(",", ".")),
        })),
    };

    if (payload.beneficiarios.length === 0) {
      setSubmitState({
        status: "error",
        message: t("validation.atLeastOneBeneficiary"),
      });
      return;
    }

    setSubmitState({ status: "idle" });
    setPendingPayload(payload);
  }

  async function confirmAndSubmit() {
    if (!pendingPayload) return;
    setSubmitState({ status: "submitting" });
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingPayload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || tErrors("submitFailed"));
      }
      const data: { id: string } = await res.json();
      setSubmitState({ status: "success", submissionId: data.id });
      setPendingPayload(null);
      reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setPendingPayload(null);
      setSubmitState({
        status: "error",
        message: err instanceof Error ? err.message : tErrors("submitFailed"),
      });
    }
  }

  if (submitState.status === "success") {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-[var(--color-nossa-green-300)] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-nossa-green-100)] text-[var(--color-nossa-green-700)]">
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[var(--color-nossa-blue-900)]">
          {tSuccess("title")}
        </h2>
        <p className="mt-3 text-sm text-[var(--color-nossa-gray-700)]">
          {tSuccess("message")}
        </p>
        <p className="mt-4 inline-block rounded-md bg-[var(--color-nossa-gray-50)] px-3 py-1.5 text-xs font-semibold text-[var(--color-nossa-gray-700)]">
          {tSuccess("submissionId")}: {submitState.submissionId}
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setSubmitState({ status: "idle" })}
            className="btn-primary"
          >
            {tSuccess("newSubmission")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      onKeyDown={(e) => {
        // Bloqueia submit acidental por Enter em qualquer input/select.
        // Só o clique no botão "Submeter" abre o modal de confirmação.
        if (e.key === "Enter") {
          const target = e.target as HTMLElement;
          const tag = target.tagName;
          const type = (target as HTMLInputElement).type;
          if (tag === "TEXTAREA") return;
          if ((tag === "INPUT" && type !== "submit") || tag === "SELECT") {
            e.preventDefault();
          }
        }
      }}
      className="space-y-6"
      noValidate
    >
      <p className="text-center text-[11px] uppercase tracking-wider text-[var(--color-nossa-gray-400)]">
        {t("fillInstruction")}
      </p>

      {/* ===== TOMADOR DO SEGURO / PESSOA SEGURA ===== */}
      <section className="rounded-xl border border-[var(--color-nossa-gray-200)] bg-white p-4 shadow-sm sm:p-6">
        <h2 className="section-header">{t("policyHolderSection")}</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label={t("fields.fullName")}
            error={errors.nomeCompleto?.message}
            required
          >
            <input
              {...register("nomeCompleto", {
                required: t("validation.required"),
                minLength: { value: 2, message: t("validation.minLength", { min: 2 }) },
              })}
              type="text"
              className="input-base"
              autoComplete="name"
              aria-invalid={!!errors.nomeCompleto}
            />
          </Field>

          <Field
            label={t("fields.policyNumber")}
            error={errors.numeroApolice?.message}
            required
          >
            <input
              {...register("numeroApolice", { required: t("validation.required") })}
              type="text"
              className="input-base"
              aria-invalid={!!errors.numeroApolice}
            />
          </Field>

          <Field label={t("fields.address")} error={errors.endereco?.message} required>
            <input
              {...register("endereco", { required: t("validation.required") })}
              type="text"
              className="input-base"
              autoComplete="street-address"
              aria-invalid={!!errors.endereco}
            />
          </Field>

          <Field label={t("fields.nif")} error={errors.nif?.message} required>
            <input
              {...register("nif", {
                required: t("validation.required"),
                pattern: { value: NIF_REGEX, message: t("validation.invalidNif") },
              })}
              type="text"
              className="input-base uppercase"
              aria-invalid={!!errors.nif}
            />
          </Field>

          <Field label={t("fields.phone")} error={errors.telefone?.message} required>
            <input
              {...register("telefone", {
                required: t("validation.required"),
                pattern: { value: PHONE_REGEX, message: t("validation.invalidPhone") },
              })}
              type="tel"
              className="input-base"
              autoComplete="tel"
              aria-invalid={!!errors.telefone}
            />
          </Field>

          <Field
            label={t("fields.email")}
            error={errors.email?.message}
            hint={t("fields.emailHint")}
            required
          >
            <input
              {...register("email", {
                required: t("validation.required"),
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: t("validation.invalidEmail"),
                },
              })}
              type="email"
              className="input-base"
              autoComplete="email"
              aria-invalid={!!errors.email}
            />
          </Field>
        </div>
      </section>

      {/* ===== PESSOA SEGURA ===== */}
      <section className="rounded-xl border border-[var(--color-nossa-gray-200)] bg-white p-4 shadow-sm sm:p-6">
        <h2 className="section-header">{t("insuredPersonSection")}</h2>

        <p className="mb-3 text-sm leading-relaxed text-[var(--color-nossa-gray-700)]">
          <span>{t("declaration.intro")} </span>
          <Controller
            name="nomeCompleto"
            control={control}
            render={({ field }) => (
              <span className="font-semibold text-[var(--color-nossa-blue-900)]">
                {field.value || "_______________________________"}
              </span>
            )}
          />
          <span>{t("declaration.outro")}</span>
        </p>
        <p className="mb-2 text-sm leading-relaxed text-[var(--color-nossa-gray-700)]">
          {t("declaration.deathClause")}
        </p>
        <p className="mb-4 text-sm leading-relaxed text-[var(--color-nossa-gray-700)]">
          {t("declaration.confirmation")}
        </p>

        {/* Beneficiários — sempre em cards, labels sempre visíveis */}
        <div className="mt-4 space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-md border border-[var(--color-nossa-gray-200)] bg-[var(--color-nossa-gray-50)] p-3 sm:p-4"
            >
              {/* Topo do card: índice + botão remover */}
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-nossa-gray-700)]">
                  {t("beneficiaries.row", { index: index + 1 })}
                </span>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                    {t("beneficiaries.removeRow")}
                  </button>
                )}
              </div>

              {/* Campos: 1 col mobile, 2 sm, 12-col system em lg para Nome ficar mais largo */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:gap-3">
                <div className="lg:col-span-4">
                  <span className="label-base">{t("beneficiaries.fullName")}</span>
                  <input
                    {...register(`beneficiarios.${index}.nomeCompleto` as const)}
                    defaultValue={field.nomeCompleto}
                    type="text"
                    className="input-base"
                  />
                </div>
                <div className="lg:col-span-2">
                  <span className="label-base">{t("beneficiaries.birthDate")}</span>
                  <input
                    {...register(`beneficiarios.${index}.dataNascimento` as const)}
                    defaultValue={field.dataNascimento}
                    type="date"
                    className="input-base"
                  />
                </div>
                <div className="lg:col-span-2">
                  <span className="label-base">{t("beneficiaries.idDocument")}</span>
                  <input
                    {...register(`beneficiarios.${index}.biPassaporte` as const)}
                    defaultValue={field.biPassaporte}
                    type="text"
                    className="input-base"
                  />
                </div>
                <div className="lg:col-span-2">
                  <span className="label-base">{t("beneficiaries.relationship")}</span>
                  <select
                    {...register(`beneficiarios.${index}.grauParentesco` as const)}
                    defaultValue={field.grauParentesco}
                    className="input-base"
                  >
                    <option value="">—</option>
                    {relationshipKeys.map((k) => (
                      <option key={k} value={t(`beneficiaries.relationshipOptions.${k}`)}>
                        {t(`beneficiaries.relationshipOptions.${k}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <span className="label-base">{t("beneficiaries.percentage")}</span>
                  <input
                    {...register(`beneficiarios.${index}.percentagem` as const)}
                    defaultValue={field.percentagem}
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    inputMode="decimal"
                    className="input-base"
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => append(emptyBeneficiario())}
            className="btn-secondary"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            {t("beneficiaries.addRow")}
          </button>
        </div>

        {/* Autorizações */}
        <div className="mt-6 space-y-3 text-xs leading-relaxed text-[var(--color-nossa-gray-700)]">
          <p>{t("consent.updateNotice")}</p>
          <p className="text-[11px] text-[var(--color-nossa-gray-700)]">
            {t("consent.dataProcessing")}
          </p>
          <p>{t("consent.integralPart")}</p>
        </div>
      </section>

      {/* ===== DATA + ACEITAÇÃO ===== */}
      <section className="rounded-xl border border-[var(--color-nossa-gray-200)] bg-white p-4 shadow-sm sm:p-6">
        <div>
          <span className="label-base">{t("confirmation.date")}</span>
          <p className="text-sm font-semibold text-[var(--color-nossa-blue-900)]">
            {new Date().toLocaleDateString(
              locale === "fr" ? "fr-FR" : locale === "en" ? "en-GB" : "pt-PT"
            )}
          </p>
        </div>

        <label className="mt-6 flex items-start gap-3 rounded-md border border-[var(--color-nossa-gray-200)] bg-[var(--color-nossa-gray-50)] p-3">
          <input
            {...register("declaracaoAceite", { required: t("validation.agreeRequired") })}
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--color-nossa-gray-200)] accent-[var(--color-nossa-green-500)]"
          />
          <span className="text-sm text-[var(--color-nossa-gray-900)]">
            {t("consent.agree")}
          </span>
        </label>
        {errors.declaracaoAceite && (
          <p className="mt-1 text-xs text-red-600">{errors.declaracaoAceite.message}</p>
        )}
      </section>

      {/* ===== ERRO GLOBAL ===== */}
      {submitState.status === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">{tErrors("title")}</p>
          <p>{submitState.message}</p>
        </div>
      )}

      {/* ===== ACÇÕES ===== */}
      <div className="flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => {
            reset();
            setPendingPayload(null);
            setSubmitState({ status: "idle" });
          }}
          className="btn-secondary"
        >
          {t("actions.reset")}
        </button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {t("actions.submit")}
        </button>
      </div>

      <ConfirmationModal
        open={pendingPayload !== null}
        submitting={submitState.status === "submitting"}
        locale={locale}
        onCancel={() => setPendingPayload(null)}
        onConfirm={confirmAndSubmit}
      />
    </form>
  );
}

interface ConfirmationModalProps {
  open: boolean;
  submitting: boolean;
  locale: "pt" | "en" | "fr";
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmationModal({
  open,
  submitting,
  locale,
  onCancel,
  onConfirm,
}: ConfirmationModalProps) {
  const t = useTranslations("Form.confirmation");
  const tActions = useTranslations("Form.actions");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onCancel();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, submitting, onCancel]);

  if (!open) return null;

  const bullets = t.raw("modalBullets") as string[];
  const dateStr = new Date().toLocaleString(
    locale === "fr" ? "fr-FR" : locale === "en" ? "en-GB" : "pt-PT"
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={() => {
        if (!submitting) onCancel();
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-[var(--color-nossa-gray-100)] bg-[var(--color-nossa-green-100)] p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-nossa-green-500)] text-white">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          </div>
          <div>
            <h3
              id="confirm-title"
              className="text-base font-bold text-[var(--color-nossa-blue-900)]"
            >
              {t("modalTitle")}
            </h3>
            <p className="mt-1 text-xs text-[var(--color-nossa-gray-700)]">
              {t("modalDateNotice", { date: dateStr })}
            </p>
          </div>
        </div>

        <div className="space-y-3 p-5 text-sm text-[var(--color-nossa-gray-900)]">
          <p className="font-medium">{t("modalIntro")}</p>
          <ul className="space-y-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <svg
                  viewBox="0 0 24 24"
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-nossa-green-600)]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-nossa-gray-100)] bg-[var(--color-nossa-gray-50)] p-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="btn-secondary"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? tActions("submitting") : t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ label, error, hint, required, children }: FieldProps) {
  return (
    <div>
      <span className="label-base">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {hint && !error && (
        <p className="mt-1 text-[11px] text-[var(--color-nossa-gray-400)]">{hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

