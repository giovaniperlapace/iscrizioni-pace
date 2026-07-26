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
  const selectedOption =
    LANGUAGE_OPTIONS.find((option) => option.value === selectedLocale) ??
    LANGUAGE_OPTIONS[0];

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
      <div className="relative h-10 w-[4.75rem] shrink-0">
        <select
          id="locale"
          aria-label={label}
          aria-describedby={isBusy ? "locale-pending-status" : undefined}
          disabled={isBusy}
          value={selectedLocale}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer rounded-[var(--radius-sm)] opacity-0 disabled:cursor-wait"
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
            <option key={option.value} value={option.value}>
              {option.flag} {option.nativeLabel}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none flex h-full w-full items-center justify-between rounded-[var(--radius-sm)] border border-[var(--peace-border-strong)] bg-white px-2.5 text-[var(--peace-blue-800)] transition peer-focus-visible:shadow-[var(--focus-ring)] peer-disabled:opacity-75"
        >
          <span className="inline-flex h-7 min-w-8 items-center justify-center overflow-visible text-[1.4rem] leading-none">
            {selectedOption.flag}
          </span>
          {isBusy ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--peace-blue-200)] border-t-[var(--peace-blue-800)]" />
          ) : (
            <ChevronDownIcon />
          )}
        </span>
      </div>
      {isBusy ? (
          <span
            id="locale-pending-status"
            className="sr-only"
            role="status"
          >
            {pendingLabel}
          </span>
      ) : null}
    </form>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
