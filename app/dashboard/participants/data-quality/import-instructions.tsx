import { IMPORT_GUIDE } from "@/lib/data-quality/format";

export function ImportInstructions() {
  return (
    <div className="grid gap-4 text-sm leading-relaxed">
      {IMPORT_GUIDE.map(({ title, text }) => (
        <div key={title}>
          <p className="font-semibold text-[var(--peace-blue-900)]">{title}</p>
          <p className="mt-1 text-[var(--peace-muted)]">{text}</p>
        </div>
      ))}
    </div>
  );
}
