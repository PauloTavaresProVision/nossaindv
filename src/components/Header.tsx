import { useTranslations } from "next-intl";
import { NossaLogo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Header() {
  const t = useTranslations("Header");

  return (
    <header className="relative bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-6">
        {/* Logo */}
        <div className="flex shrink-0 items-center">
          <NossaLogo className="h-12 w-auto sm:h-14" />
        </div>

        {/* Direita: idioma + banner do produto */}
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <div className="self-start sm:self-end">
            <LanguageSwitcher />
          </div>

          <div className="relative flex items-center gap-3 rounded-md bg-[var(--color-nossa-green-500)] py-2 pl-3 pr-12 text-white shadow-sm sm:py-2.5 sm:pl-4 sm:pr-14">
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7 shrink-0 sm:h-8 sm:w-8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
              <path d="M3.22 12H9.5l.5-1 2 4 2-7 1.5 4h5.27" />
            </svg>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-[12px] font-bold uppercase tracking-[0.18em] sm:text-[13px]">
                {t("productName")}
              </span>
              <span className="text-[9px] font-medium uppercase tracking-[0.14em] opacity-95 sm:text-[10px]">
                {t("formName")}
              </span>
            </div>
            {/* badge "01" */}
            <div
              className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 translate-x-1/3 items-center justify-center rounded-full border-[3px] border-white bg-[var(--color-nossa-green-500)] text-base font-bold text-white shadow-md sm:h-12 sm:w-12 sm:text-lg"
              aria-hidden
            >
              {t("formNumber")}
            </div>
          </div>
        </div>
      </div>

      {/* Linha decorativa verde, à imagem do PDF */}
      <div className="h-[3px] w-full bg-gradient-to-r from-[var(--color-nossa-green-500)] via-[var(--color-nossa-green-300)] to-[var(--color-nossa-green-500)]" />
    </header>
  );
}
