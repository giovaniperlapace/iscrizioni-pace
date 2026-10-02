"use server";

import { parseDemographics, type Demographics } from "@/lib/registrations/assisted-demographics";
import { loadInternalSexes } from "@/lib/registrations/assisted-demographics.server";
type DemographicsSnapshot = Demographics & { questionnaireId: string | null; countryId: string | null; countryOther: string | null };

import { revalidatePath } from "next/cache";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { formFailure } from "@/lib/forms/result";
import { parseOperationalChild } from "@/lib/registrations/operational-child";
import { ACCESSIBILITY_DIFFICULTIES } from "@/lib/questionnaire/registration";

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function failure(code?: string) {
  return formFailure([{ field: null, code: code === "42501" ? "forbidden" : code === "PT409" || code === "40001" ? "conflict" : "failed" }]);
}
function refresh() {
  for (const path of ["/dashboard/admin", "/dashboard/manager", "/dashboard/capogruppo", "/dashboard/partecipante"]) revalidatePath(path);
}
export async function addOperationalChild(form: FormData) {
  const registrationId = String(form.get("registrationId") ?? "");
  if (!uuid.test(registrationId)) return failure("42501");
  // Reuse the existing child validation without trusting client intent/version.
  const input = new FormData();
  for (const name of ["childId", "firstName", "lastName", "birthDate"]) input.set(name, String(form.get(name) ?? ""));
  input.set("intent", "save"); input.set("expected", "{}");
  const parsed = parseOperationalChild(input);
  if ("status" in parsed) return parsed;
  try {
    const auth = await getCurrentAuthContext(await createSupabaseServerClient());
    if (!auth) return failure("42501");
    const { error } = await createSupabaseServiceClient().rpc("add_operational_child", {
      p_registration_id: registrationId, p_actor_user_id: auth.user.id, p_child_id: parsed.childId, p_child: parsed.child,
    });
    if (error) return failure(error.code);
    refresh();
    return { status: "success" as const };
  } catch { return failure(); }
}

export async function getOperationalAccessibility(registrationId: string) {
  if (!uuid.test(registrationId)) return failure("42501");
  try {
    const auth = await getCurrentAuthContext(await createSupabaseServerClient());
    if (!auth) return failure("42501");
    const { data, error } = await createSupabaseServiceClient().rpc("get_operational_accessibility", {
      p_registration_id: registrationId, p_actor_user_id: auth.user.id,
    });
    if (error) return failure(error.code);
    return { status: "success" as const, snapshot: data as { answers: Record<string, boolean>; version: string } | null };
  } catch { return failure(); }
}

export async function updateOperationalAccessibility(form: FormData) {
  const registrationId = String(form.get("registrationId") ?? "");
  if (!uuid.test(registrationId)) return failure("42501");
  let expected: unknown;
  try { expected = JSON.parse(String(form.get("expected"))); } catch { return formFailure([{ field: null, code: "invalid" }]); }
  const answers = Object.fromEntries(ACCESSIBILITY_DIFFICULTIES.map(({ key }) => [key, form.get(`accessibility_${key}`) === "on"]));
  try {
    const auth = await getCurrentAuthContext(await createSupabaseServerClient());
    if (!auth) return failure("42501");
    const { data, error } = await createSupabaseServiceClient().rpc("update_operational_accessibility", {
      p_registration_id: registrationId, p_actor_user_id: auth.user.id, p_expected: expected, p_answers: answers,
    });
    if (error) return failure(error.code);
    refresh();
    return { status: "success" as const, snapshot: data as { answers: Record<string, boolean>; version: string } };
  } catch { return failure(); }
}

export async function getOperationalDemographics(registrationId: string) {
  if (!uuid.test(registrationId)) return failure("42501");
  try {
    const auth = await getCurrentAuthContext(await createSupabaseServerClient());
    if (!auth) return failure("42501");
    const { data, error } = await createSupabaseServiceClient().rpc("get_operational_demographics", {
      p_registration_id: registrationId, p_actor_user_id: auth.user.id,
    });
    if (error) return failure(error.code);
    return { status: "success" as const, snapshot: data as DemographicsSnapshot };
  } catch { return failure(); }
}

export async function updateOperationalDemographics(form: FormData) {
  const registrationId = String(form.get("registrationId") ?? "");
  const value = parseDemographics(form);
  if (!uuid.test(registrationId) || !value) return failure("42501");
  let expected: unknown;
  try { expected = JSON.parse(String(form.get("expected"))); } catch { return failure(); }
  try {
    const auth = await getCurrentAuthContext(await createSupabaseServerClient());
    if (!auth) return failure("42501");
    const { data, error } = await createSupabaseServiceClient().rpc("update_operational_demographics", {
      p_registration_id: registrationId, p_actor_user_id: auth.user.id, p_expected: expected, p_value: value,
    });
    if (error) return failure(error.code);
    refresh();
    return { status: "success" as const, snapshot: data as DemographicsSnapshot };
  } catch { return failure(); }
}

export async function getVisibleInternalSexes(registrationIds: string[]) {
  if (!Array.isArray(registrationIds) || registrationIds.length > 200 || registrationIds.some(id => !uuid.test(id))) return failure("42501");
  try {
    const auth = await getCurrentAuthContext(await createSupabaseServerClient());
    if (!auth) return failure("42501");
    const values = await loadInternalSexes(createSupabaseServiceClient(), registrationIds, auth.user.id);
    return { status: "success" as const, values };
  } catch { return failure(); }
}

export async function getOperationalAssociation(registrationId: string) {
  if (!uuid.test(registrationId)) return failure("42501");
  try {
    const auth = await getCurrentAuthContext(await createSupabaseServerClient());
    if (!auth?.eventRoles.some(role => role.role === "admin" || role.role === "manager")) return failure("42501");
    const { data, error } = await createSupabaseServiceClient().rpc("get_operational_association", {
      p_registration_id: registrationId, p_actor_user_id: auth.user.id,
    });
    if (error) return failure(error.code);
    return { status: "success" as const, snapshot: data as { association: string | null; questionnaireId: string | null } };
  } catch { return failure(); }
}

export async function updateOperationalAssociation(form: FormData) {
  const registrationId = String(form.get("registrationId") ?? "");
  const value = String(form.get("association") ?? "").trim();
  if (!uuid.test(registrationId)) return failure("42501");
  if (value.length > 200) return formFailure([{ field: "association", code: "invalid" }]);
  let expected: unknown;
  try { expected = JSON.parse(String(form.get("expected"))); } catch { return failure(); }
  try {
    const auth = await getCurrentAuthContext(await createSupabaseServerClient());
    if (!auth?.eventRoles.some(role => role.role === "admin" || role.role === "manager")) return failure("42501");
    const { data, error } = await createSupabaseServiceClient().rpc("update_operational_association", {
      p_registration_id: registrationId, p_actor_user_id: auth.user.id, p_expected: expected, p_value: value || null,
    });
    if (error) return failure(error.code);
    refresh();
    return { status: "success" as const, snapshot: data as { association: string | null; questionnaireId: string | null } };
  } catch { return failure(); }
}
