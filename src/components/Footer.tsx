import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("Footer");
  const phoneNumber = t("contactCenterNumber");
  const phoneHref = "tel:" + phoneNumber.replace(/\s+/g, "");

  return (
    <footer className="mt-12 border-t-2 border-[var(--color-nossa-green-500)] bg-white">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-4 text-[12px] leading-relaxed text-[var(--color-nossa-gray-700)] sm:grid-cols-2">
          <div>
            <p className="font-semibold text-[var(--color-nossa-blue-900)]">
              {t("company")}
            </p>
            <p className="mt-1">{t("address")}</p>
          </div>
          <div className="sm:text-right">
            <p>
              <span className="font-semibold uppercase tracking-wide text-[var(--color-nossa-green-700)]">
                {t("contactCenterLabel")}
              </span>
              <span className="mx-2 text-[var(--color-nossa-gray-200)]">|</span>
              <a
                href={phoneHref}
                className="font-semibold text-[var(--color-nossa-blue-900)] hover:underline"
              >
                {phoneNumber}
              </a>
            </p>
            <p className="mt-1">
              <a
                href={`https://${t("website")}`}
                className="text-[var(--color-nossa-green-700)] underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {t("website")}
              </a>
            </p>
          </div>
        </div>

        <p className="mt-4 border-t border-[var(--color-nossa-gray-100)] pt-3 text-center text-[10px] text-[var(--color-nossa-gray-400)]">
          {t("legal")}
        </p>
      </div>
    </footer>
  );
}
