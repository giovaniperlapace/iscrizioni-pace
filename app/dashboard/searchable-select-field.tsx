"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SearchableSelectOption = {
  groupLabel?: string;
  label: string;
  value: string;
};

type SearchableSelectFieldProps = {
  emptyMessage?: string;
  label: string;
  name: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  required?: boolean;
  value: string;
};

const MAX_RESULTS = 8;

export function SearchableSelectField({
  emptyMessage = "Nessuna opzione trovata.",
  label,
  name,
  options,
  placeholder = "Cerca e seleziona",
  required = false,
  value,
}: SearchableSelectFieldProps) {
  const initialOption = options.find((option) => option.value === value) ?? null;
  const [query, setQuery] = useState(initialOption?.label ?? "");
  const [selectedValue, setSelectedValue] = useState(initialOption?.value ?? "");
  const [showOptions, setShowOptions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = normalizeSearch(query);
  const results = useMemo(() => {
    const filteredOptions = normalizedQuery
      ? options.filter((option) =>
          normalizeSearch(`${option.groupLabel ?? ""} ${option.label}`).includes(
            normalizedQuery
          )
        )
      : options;

    return filteredOptions.slice(0, MAX_RESULTS);
  }, [normalizedQuery, options]);

  useEffect(() => {
    inputRef.current?.setCustomValidity(
      required && !selectedValue ? "Seleziona una voce dall'elenco." : ""
    );
  }, [required, selectedValue]);

  function selectOption(option: SearchableSelectOption) {
    setSelectedValue(option.value);
    setQuery(option.label);
    setShowOptions(false);
  }

  return (
    <div className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)] sm:col-span-2">
      <label className="grid gap-1">
        {label}
        <div className="relative">
          <input
            ref={inputRef}
            className="field bg-white font-normal"
            type="search"
            value={query}
            onBlur={() => {
              window.setTimeout(() => setShowOptions(false), 120);
            }}
            onClick={() => setShowOptions(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedValue("");
              setShowOptions(true);
            }}
            onFocus={() => setShowOptions(true)}
            onMouseDown={() => setShowOptions(true)}
            placeholder={placeholder}
            autoComplete="off"
            required={required}
          />
          {showOptions ? (
            <div className="absolute z-50 mt-2 max-h-56 w-full overflow-auto rounded-md border border-[var(--peace-border-strong)] bg-white shadow-lg">
              {results.length > 0 ? (
                results.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm font-normal hover:bg-[var(--peace-sky-100)]"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectOption(option);
                    }}
                    onClick={() => selectOption(option)}
                  >
                    {option.groupLabel ? (
                      <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--peace-muted)]">
                        {option.groupLabel}
                      </span>
                    ) : null}
                    <span className="block font-semibold text-[var(--peace-ink)]">
                      {option.label}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm font-normal text-[var(--peace-muted)]">
                  {emptyMessage}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </label>
      <input type="hidden" name={name} value={selectedValue} />
    </div>
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
