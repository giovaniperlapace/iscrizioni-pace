import type { SupportedLocale } from "@/lib/i18n/config";

export function RequiredIndicator() {
  return <span aria-hidden="true" className="text-[#8a3323]"> *</span>;
}

const NOTES: Record<SupportedLocale, string> = {
  it: "* Campo obbligatorio",
  en: "* Required field",
  fr: "* Champ obligatoire",
  de: "* Pflichtfeld",
  es: "* Campo obligatorio",
  nl: "* Verplicht veld",
  uk: "* Обов’язкове поле",
};

export function RequiredFieldsNote({ locale }: { locale: SupportedLocale }) {
  return <p className="text-sm text-[var(--peace-muted)]">{NOTES[locale]}</p>;
}
