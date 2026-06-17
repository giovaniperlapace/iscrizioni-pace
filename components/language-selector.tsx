"use client";

import { useRef, useTransition } from "react";

import { LANGUAGE_OPTIONS, type SupportedLocale } from "@/lib/i18n/config";

type LanguageSelectorProps = {
  action: (formData: FormData) => void | Promise<void>;
  currentLocale: SupportedLocale;
  label: string;
};

export function LanguageSelector({
  action,
  currentLocale,
  label,
}: LanguageSelectorProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const returnToRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <label htmlFor="locale" className="sr-only">
        {label}
      </label>
      <input ref={returnToRef} type="hidden" name="returnTo" value="/" />
      <select
        id="locale"
        name="locale"
        aria-label={label}
        defaultValue={currentLocale}
        className="min-h-9 rounded-md border border-[#c8d5be] bg-white px-2 text-lg font-semibold text-[#2f5e46] outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5e46]"
        onChange={() => {
          if (returnToRef.current) {
            returnToRef.current.value = `${window.location.pathname}${window.location.search}`;
          }

          startTransition(() => {
            formRef.current?.requestSubmit();
          });
        }}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option
            key={option.value}
            value={option.value}
            aria-label={option.nativeLabel}
          >
            {option.flag}
          </option>
        ))}
      </select>
    </form>
  );
}
