export type FormIssue = { field: string | null; code: string };
export type FormFailure = { status: "error"; issues: FormIssue[] };

export function formFailure(issues: FormIssue[]): FormFailure {
  return { status: "error", issues };
}

// Adapter for the existing action error codes. Errors are returned to the form;
// only successful writes and authentication still navigate.
export function formFailureFromRedirect(path: string): FormFailure {
  const params = new URL(path, "https://local.invalid").searchParams;
  const error = [...params].find(([key]) => /error$/i.test(key));
  return formFailure([issueFromMessage(error?.[1] ?? "failed")]);
}

export function issueFromMessage(message: string): FormIssue {
  const child = message.match(/figlio (\d+)/);
  const prefix = child ? `child_${Number(child[1]) - 1}_` : "";
  if (/cognome/i.test(message)) return { field: `${prefix}lastName`, code: "name" };
  if (/\bnome\b/i.test(message)) return { field: `${prefix}firstName`, code: "name" };
  if (/nascita/i.test(message)) return { field: `${prefix}birthDate`, code: "date" };
  if (/almeno email o telefono/i.test(message)) return { field: "email", code: "contact" };
  if (/telefono/i.test(message)) return { field: "phone", code: "phone" };
  if (/duplicate-email|email-taken/.test(message)) return { field: "email", code: "duplicateEmail" };
  if (/email/i.test(message) && !/invite-email|auth-user/.test(message)) return { field: "email", code: "email" };
  if (/presenza|invalid-days/i.test(message)) return { field: "availabilitySlots", code: "attendance" };
  if (/consenso/i.test(message)) return { field: "consentConfirmed", code: "consent" };
  if (/figli/i.test(message)) return { field: "childrenCount", code: "children" };
  if (/gruppo|invalid-group|missing-group|invalid-parent|invalid-target-group|group-not-assignable/i.test(message)) return { field: "groupId", code: "group" };
  if (message === "service-label-too-long") return { field: "label", code: "tooLong" };
  if (message === "service-description-too-long") return { field: "description", code: "tooLong" };
  if (message === "invalid-dates") return { field: "endsOn", code: "date" };
  if (message === "forbidden" || message === "scope") return { field: null, code: "forbidden" };
  if (message === "closed") return { field: null, code: "closed" };
  if (message === "link-already-exists") return { field: "displayName", code: "duplicate" };
  return { field: null, code: "failed" };
}

export function validateContactFields(formData: FormData): FormIssue[] {
  const issues: FormIssue[] = [];
  for (const field of ["firstName", "lastName"]) {
    if (formData.has(field)) {
      const value = String(formData.get(field) ?? "").trim();
      if (value.length < 2 || value.length > 120) issues.push({ field, code: "name" });
    }
  }
  const email = String(formData.get("email") ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push({ field: "email", code: "email" });
  const phone = String(formData.get("phone") ?? "").trim().replace(/[\s().-]/g, "");
  if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) issues.push({ field: "phone", code: "phone" });
  const birthDate = String(formData.get("birthDate") ?? "");
  if (birthDate && (!isRealDate(birthDate) || birthDate > new Date().toISOString().slice(0, 10))) {
    issues.push({ field: "birthDate", code: "date" });
  }
  return issues;
}

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
