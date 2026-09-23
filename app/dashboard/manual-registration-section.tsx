import type { ManualRegistrationCopy } from "@/lib/registrations/manual-registration-copy";
import type { AttendanceDayColumn } from "@/lib/registrations/attendance-slots";
import type { SupportedLocale } from "@/lib/i18n/config";
import { ParticipantBirthDateField } from "@/components/participant-birth-date-field";
import { RequiredIndicator, RequiredFieldsNote } from "@/components/required-indicator";
import { ManualPhoneFields } from "@/app/dashboard/capogruppo/manual-phone-fields";
import { ManualEmailFields } from "@/app/dashboard/capogruppo/manual-email-fields";
import { MANUAL_DUPLICATE_COPY } from "@/lib/data-quality/manual-copy";
import { ReliableForm } from "@/components/reliable-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ManualAccessibilityFields } from "@/app/dashboard/capogruppo/manual-accessibility-fields";
import { ManualAttendanceFields } from "@/app/dashboard/capogruppo/manual-attendance-fields";
import { ManualChildrenFields } from "@/app/dashboard/capogruppo/manual-children-fields";

export function ManualRegistrationSection({
  action,
  sourceDashboard = "capogruppo",
  groups,
  selectedGroupId,
  eventDays,
  locale,
  copy,
}: {
  action: (data: FormData) => Promise<unknown>;
  sourceDashboard?: "capogruppo" | "manager";
  groups: Array<{ id: string; name: string; isAssignable: boolean }>;
  selectedGroupId: string | null;
  eventDays: AttendanceDayColumn[];
  locale: SupportedLocale;
  copy: ManualRegistrationCopy;
}) {
  const assignableGroups = groups.filter((group) => group.isAssignable);
  const defaultGroupId =
    selectedGroupId && assignableGroups.some((group) => group.id === selectedGroupId)
      ? selectedGroupId
      : "";

  return (
    <section>
      <div>
        <h2 className="text-lg font-semibold">{copy.manualTitle}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--peace-muted)]">
          {copy.manualHelp}
        </p>
      </div>

      {assignableGroups.length > 0 ? (
        <ReliableForm
          action={action}
          validation="manualRegistration"
          locale={locale}
          className="mt-5 grid gap-4 lg:grid-cols-2"
        >
          <input type="hidden" name="sourceDashboard" value={sourceDashboard} />
          <div className="lg:col-span-2"><RequiredFieldsNote locale={locale} /></div>
          <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)] lg:col-span-2">
            <span>{copy.group}<RequiredIndicator /></span>
            <select name="groupId" required className="field" defaultValue={defaultGroupId}>
              <option value="">{copy.selectGroup}</option>
              {assignableGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
            <span>{copy.firstName}<RequiredIndicator /></span>
            <input name="firstName" required minLength={2} className="field" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
            <span>{copy.lastName}<RequiredIndicator /></span>
            <input name="lastName" required minLength={2} className="field" />
          </label>
          <ManualEmailFields locale={locale} emailLabel={copy.email} delegation={sourceDashboard === "manager" ? "group" : "self"} />
          <ManualPhoneFields locale={locale} label={copy.phone} />
          <ParticipantBirthDateField label={copy.birthDate} locale={locale} />
          <ManualAttendanceFields eventDays={eventDays} copy={copy.attendance} locale={locale} initialUnknown={false} />
          <ManualChildrenFields locale={locale} />
          <ManualAccessibilityFields
            locale={locale}
            copy={copy.accessibility}
          />
          <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)] lg:col-span-2">
            {copy.internalNote}
            <textarea
              name="leaderNote"
              rows={3}
              className="min-h-20 rounded-md border border-[var(--peace-border-strong)] bg-white px-3 py-2 text-sm font-normal text-[var(--peace-ink)] outline-none transition focus:border-[var(--peace-sky-400)]"
            />
          </label>
          <label className="flex gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-3 text-sm font-medium text-[var(--peace-ink)] lg:col-span-2">
            <input
              name="consentConfirmed"
              type="checkbox"
              required
              className="mt-1 h-4 w-4 accent-[var(--peace-blue-800)]"
            />
            <span>{copy.consent}<RequiredIndicator /></span>
          </label>
          <label className="grid gap-1 text-sm lg:col-span-2">
            {MANUAL_DUPLICATE_COPY[locale]}
            <textarea name="duplicateReason" className="field" minLength={3} maxLength={500} />
          </label>
          <div className="lg:col-span-2">
            <PendingSubmitButton className="min-h-10 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
              {copy.addParticipant}
            </PendingSubmitButton>
          </div>
        </ReliableForm>
      ) : (
        <p className="mt-4 text-sm text-[var(--peace-muted)]">
          {copy.noRegistrableGroups}
        </p>
      )}
    </section>
  );
}
