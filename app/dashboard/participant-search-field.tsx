"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ParticipantSearchOption = {
  email: string | null;
  id: string;
  name: string;
};

type ParticipantSearchFieldProps = {
  label: string;
  name: string;
  options: ParticipantSearchOption[];
  placeholder?: string;
};

const MAX_RESULTS = 5;

export function ParticipantSearchField({
  label,
  name,
  options,
  placeholder = "Cerca per nome o email",
}: ParticipantSearchFieldProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const results = useMemo(() => {
    const filteredOptions = normalizedQuery
      ? options.filter((option) =>
          [option.name, option.email]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        )
      : options;

    return filteredOptions.slice(0, MAX_RESULTS);
  }, [normalizedQuery, options]);
  const selected = options.find((option) => option.id === selectedId) ?? null;
  const selectOption = (option: ParticipantSearchOption) => {
    setSelectedId(option.id);
    setQuery(formatParticipantOption(option));
    setShowOptions(false);
  };

  useEffect(() => {
    inputRef.current?.setCustomValidity(
      selectedId ? "" : "Seleziona una persona dall'elenco."
    );
  }, [selectedId]);

  return (
    <div className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
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
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedId("");
              setShowOptions(true);
            }}
            onFocus={() => setShowOptions(true)}
            placeholder={placeholder}
            autoComplete="off"
            required
          />
          {showOptions ? (
            <div className="absolute z-50 mt-2 max-h-48 w-full overflow-auto rounded-md border border-[var(--peace-border-strong)] bg-white shadow-lg">
              {results.length > 0 ? (
                results.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm font-normal hover:bg-[var(--peace-sky-100)]"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectOption(option);
                    }}
                    onClick={() => selectOption(option)}
                  >
                    <span className="block font-semibold text-[var(--peace-ink)]">
                      {option.name}
                    </span>
                    {option.email ? (
                      <span className="block text-[var(--peace-muted)]">{option.email}</span>
                    ) : null}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm font-normal text-[var(--peace-muted)]">
                  Nessuna persona trovata.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </label>
      <input type="hidden" name={name} value={selectedId} />
      {selected ? <span className="sr-only">Selezionato: {selected.name}</span> : null}
    </div>
  );
}

function formatParticipantOption(option: ParticipantSearchOption): string {
  return option.email ? `${option.name} - ${option.email}` : option.name;
}
