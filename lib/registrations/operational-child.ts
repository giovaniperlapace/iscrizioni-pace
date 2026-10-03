import { validateAccompanyingChildren } from "./registration-children.ts";
import { formFailure, issueFromMessage } from "../forms/result.ts";

export function parseOperationalChild(form: FormData) {
  const childId = form.get("childId");
  const intent = form.get("intent");
  if (typeof childId !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(childId)
      || (intent !== "save" && intent !== "delete")) return formFailure([{ field: null, code: "invalid" }]);
  let expected: unknown;
  try { expected = JSON.parse(String(form.get("expected"))); } catch { return formFailure([{ field: null, code: "invalid" }]); }
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) return formFailure([{ field: null, code: "invalid" }]);
  if (intent === "delete") return { childId, expected, child: null };
  const firstName = String(form.get("firstName") ?? "").trim().replace(/\s+/g, " ");
  const lastName = String(form.get("lastName") ?? "").trim().replace(/\s+/g, " ");
  const birthDate = String(form.get("birthDate") ?? "").trim();
  const issues = validateAccompanyingChildren({ participatesWithChildren: true, children: [{ firstName, lastName, birthDate }] })
    .map(message => { const issue = issueFromMessage(message); return { ...issue, field: issue.field?.replace(/^child_0_/, "") ?? null }; });
  for (const [field, value] of [["firstName", firstName], ["lastName", lastName]]) {
    if (value.length > 120) issues.push({ field, code: "tooLong" });
  }
  if (issues.length) return formFailure(issues);
  return { childId, expected, child: { first_name: firstName, last_name: lastName, birth_date: birthDate } };
}
