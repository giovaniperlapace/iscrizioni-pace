import { ChevronDown, Pencil, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EditableRegistrationInfo({ label, value, editable, copy, icon: Icon, children }: {
  label: string; value: string; editable: boolean;
  copy: { edit: string; editUnavailable: string }; icon?: LucideIcon; children: ReactNode;
}) {
  return <details className="group rounded-xl border border-[var(--peace-border)] bg-white transition open:border-[var(--peace-border-strong)] open:shadow-sm sm:col-span-2">
    <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 rounded-xl p-4 transition hover:bg-[var(--peace-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
      {Icon ? <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--peace-sky-100)] text-[var(--peace-blue-800)]"><Icon size={20} aria-hidden="true" /></span> : null}
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[var(--peace-blue-900)]">{label}</span><span className="mt-1 block break-words text-sm leading-6 text-[var(--peace-muted)]">{value}</span></span>
      <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-[var(--peace-blue-800)]">
        {editable ? <Pencil size={16} aria-hidden="true" /> : null}
        <span className="sr-only sm:not-sr-only">{editable ? copy.edit : copy.editUnavailable}</span>
        <ChevronDown size={18} aria-hidden="true" className="transition group-open:rotate-180" />
      </span>
    </summary>
    <div className="border-t border-[var(--peace-border)] p-4 sm:p-5">{children}</div>
  </details>;
}
