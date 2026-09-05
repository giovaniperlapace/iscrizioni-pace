import type { SupportedLocale } from "@/lib/i18n/config";
import { MANAGED_PARTICIPANT_COPY } from "@/lib/registrations/managed-participant-copy";

export function DeliveryFields({ locale, defaultMode = "delegated" }: { locale: SupportedLocale; defaultMode?: string }) {
  const copy = MANAGED_PARTICIPANT_COPY[locale];
  return <label className="grid gap-2 text-sm font-semibold lg:col-span-2">
    {copy.delivery}
    <select name="deliveryMode" defaultValue={defaultMode} className="field bg-white font-normal">
      <option value="delegated">{copy.delegated}</option>
      <option value="personal">{copy.personal}</option>
    </select>
    <span className="text-xs font-normal text-[var(--peace-muted)]">{copy.deliveryHelp}</span>
  </label>;
}
