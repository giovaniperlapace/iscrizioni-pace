"use client";
import type { SupportedLocale } from "@/lib/i18n/config";
import { FORUM_CHILD_COPY, type ForumChildOption } from "@/lib/panels/child-selection";

export function ForumChildSelection({ options, selected, onChange, locale, locked = false, disabled = false }: {
  options: ForumChildOption[]; selected: string[]; onChange: (ids: string[]) => void;
  locale: SupportedLocale; locked?: boolean; disabled?: boolean;
}) {
  if (!options.length) return null;
  const copy = FORUM_CHILD_COPY[locale];
  return <fieldset className="my-3 grid min-w-0 gap-2 rounded-lg border border-[var(--peace-border)] p-3 text-sm" disabled={disabled || locked}>
    <legend className="px-1 font-semibold">{copy.title}</legend>
    <p className="max-w-lg text-xs font-normal leading-5 text-[var(--peace-muted)]">{locked ? copy.saved : copy.help}</p>
    {options.map(child => <label key={child.id} className="flex min-h-11 items-center gap-2 font-normal">
      <input type="checkbox" name="childIds" value={child.id} checked={selected.includes(child.id)}
        onChange={e => onChange(e.target.checked ? [...selected, child.id] : selected.filter(id => id !== child.id))} />
      <span>{child.name}</span>
    </label>)}
  </fieldset>;
}
