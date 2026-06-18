"use client";

import { useRef, useState, useTransition } from "react";

import { LANGUAGE_OPTIONS, type SupportedLocale } from "@/lib/i18n/config";

type LanguageSelectorProps = {
  action: (formData: FormData) => void | Promise<void>;
  currentLocale: SupportedLocale;
  label: string;
  pendingLabel: string;
};

export function LanguageSelector({
  action,
  currentLocale,
  label,
  pendingLabel,
}: LanguageSelectorProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const localeRef = useRef<HTMLInputElement>(null);
  const returnToRef = useRef<HTMLInputElement>(null);
  const [selectedLocale, setSelectedLocale] =
    useState<SupportedLocale>(currentLocale);
  const [isChanging, setIsChanging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBusy = isChanging || isPending;

  return (
    <form
      ref={formRef}
      action={action}
      aria-busy={isBusy}
      className="relative flex items-center gap-2"
    >
      <label htmlFor="locale" className="sr-only">
        {label}
      </label>
      <input
        ref={localeRef}
        type="hidden"
        name="locale"
        value={selectedLocale}
      />
      <input ref={returnToRef} type="hidden" name="returnTo" value="/" />
      <select
        id="locale"
        aria-label={label}
        aria-describedby={isBusy ? "locale-pending-status" : undefined}
        disabled={isBusy}
        value={selectedLocale}
        className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--peace-border-strong)] bg-white px-2 pr-8 text-lg font-semibold text-[var(--peace-blue-800)] outline-none transition focus-visible:shadow-[var(--focus-ring)] disabled:cursor-wait disabled:opacity-75"
        onChange={(event) => {
          const nextLocale = event.currentTarget.value as SupportedLocale;

          if (nextLocale === currentLocale || isBusy) {
            return;
          }

          setSelectedLocale(nextLocale);
          setIsChanging(true);

          if (localeRef.current) {
            localeRef.current.value = nextLocale;
          }

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
      {isBusy ? (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--peace-blue-200)] border-t-[var(--peace-blue-800)]"
          />
          <span id="locale-pending-status" className="sr-only" role="status">
            {pendingLabel}
          </span>
        </>
      ) : null}
    </form>
  );
}
