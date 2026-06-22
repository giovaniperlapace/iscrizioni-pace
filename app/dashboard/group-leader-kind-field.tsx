type GroupLeaderKindFieldProps = {
  legend?: string;
  defaultValue?: "primary" | "secondary";
};

export function GroupLeaderKindField({
  legend = "Tipo di capogruppo",
  defaultValue = "secondary",
}: GroupLeaderKindFieldProps) {
  return (
    <fieldset className="grid gap-2 text-sm text-[var(--peace-ink)]">
      <legend className="font-semibold">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex min-h-11 items-center gap-2 rounded-md border border-[var(--peace-border-strong)] bg-white px-3 py-2 transition has-[:checked]:border-[var(--peace-blue-800)] has-[:checked]:bg-[var(--peace-sky-100)]">
          <input
            name="leaderKind"
            type="radio"
            value="primary"
            className="mt-1"
            defaultChecked={defaultValue === "primary"}
          />
          <span className="font-semibold">Principale</span>
        </label>
        <label className="flex min-h-11 items-center gap-2 rounded-md border border-[var(--peace-border-strong)] bg-white px-3 py-2 transition has-[:checked]:border-[var(--peace-blue-800)] has-[:checked]:bg-[var(--peace-sky-100)]">
          <input
            name="leaderKind"
            type="radio"
            value="secondary"
            className="mt-1"
            defaultChecked={defaultValue !== "primary"}
          />
          <span className="font-semibold">Secondario</span>
        </label>
      </div>
    </fieldset>
  );
}
