"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTransition } from "react";
import { routing } from "@/i18n/routing";

export function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="sr-only">{t("label")}</span>
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          disabled={isPending || loc === locale}
          onClick={() => {
            startTransition(() => {
              router.replace(pathname, { locale: loc });
            });
          }}
          className={`rounded px-2 py-1 font-semibold uppercase tracking-wide transition ${
            loc === locale
              ? "bg-[var(--color-nossa-blue-700)] text-white"
              : "text-[var(--color-nossa-gray-700)] hover:bg-[var(--color-nossa-gray-100)]"
          }`}
          aria-current={loc === locale ? "true" : undefined}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
