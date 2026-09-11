import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { ACCESS_EMAIL_COPY, renderAccountAccessEmail } from "../lib/email/account-access.ts";
import { SUPPORTED_LOCALES } from "../lib/i18n/config.ts";
import { selectAccountAccessCandidates, loadAccountAccessCandidates } from "../lib/email/account-access-candidates.ts";

test("access instructions are localized, escaped, and use a stable URL without credentials", () => {
  for (const locale of SUPPORTED_LOCALES) {
    const result = renderAccountAccessEmail({ name: '<Anna & "Bianchi">', siteLink: "https://example.test/", locale });
    assert.equal(result.subject, ACCESS_EMAIL_COPY[locale].subject);
    assert.ok(result.text.includes(ACCESS_EMAIL_COPY[locale].access));
    assert.ok(result.text.indexOf("https://example.test/") < result.text.indexOf(ACCESS_EMAIL_COPY[locale].access));
    assert.ok(result.html.indexOf('href="https://example.test/"') < result.html.indexOf(ACCESS_EMAIL_COPY[locale].access));
    assert.ok(result.html.includes("&lt;Anna &amp; &quot;Bianchi&quot;&gt;"));
    assert.ok(result.html.includes('href="https://example.test/"'));
    assert.ok(!result.html.includes("token_hash"));
    assert.ok(result.text.includes("registrationspeace@santegidio.org"));
  }
  assert.throws(() => renderAccountAccessEmail({ name: "Test", siteLink: "javascript:alert(1)" }));
  const role = renderAccountAccessEmail({ name: "Test", siteLink: "https://example.test", role: "manager_viewer" });
  assert.match(role.subject, /sola lettura/);
  assert.match(role.text, /La mia iscrizione/);
});

function history() {
  return {
    registrations: [{ id: "reg", participant_id: "person", source: "capogruppo", created_by: "leader", deleted_at: null as string | null, status: "submitted" }],
    contacts: [{ participant_id: "person", email: "person@example.test" }],
    snapshots: [{ registration_id: "reg", answers: { contact: { hasEmail: true, useLeaderEmail: false } } }],
    creators: [{ id: "leader", email: "leader@example.test" }], sentRegistrationIds: [] as string[],
  };
}
test("historical selection includes personal and legacy emails but excludes delegation, inactive records and prior sends", () => {
  assert.equal(selectAccountAccessCandidates(history()).candidates.length, 1);
  const legacy = history(); legacy.snapshots[0].answers.contact = { hasEmail: true } as typeof legacy.snapshots[0]["answers"]["contact"];
  assert.equal(selectAccountAccessCandidates(legacy).candidates.length, 1);
  for (const reason of ["delegated", "inactive", "already_notified", "provenance_to_review", "leader_email", "shared_email", "creator_to_review"]) {
    const data = history();
    if (reason === "delegated") data.snapshots[0].answers.contact.useLeaderEmail = true;
    if (reason === "inactive") data.registrations[0].deleted_at = "2026-09-10";
    if (reason === "already_notified") data.sentRegistrationIds.push("reg");
    if (reason === "provenance_to_review") data.snapshots = [];
    if (reason === "leader_email") data.contacts[0].email = "leader@example.test";
    if (reason === "shared_email") data.contacts.push({ participant_id: "other", email: "PERSON@example.test" });
    if (reason === "creator_to_review") data.creators = [];
    const result = selectAccountAccessCandidates(data);
    assert.equal(result.candidates.length, 0, reason);
    assert.equal(result.excluded[reason], 1, reason);
  }
  const delegatedWithNewEmail = history(); delegatedWithNewEmail.snapshots[0].answers.contact.useLeaderEmail = true;
  assert.equal(selectAccountAccessCandidates(delegatedWithNewEmail).candidates.length, 0);
});

test("historical preflight pages beyond 1,000 and aborts on a read failure", async () => {
  const data = history();
  const registrations = Array.from({ length: 1101 }, (_, i) => ({ ...data.registrations[0], id: `reg${i}` }));
  const tables: Record<string, unknown[]> = { registrations, participant_contacts: data.contacts,
    profiles: data.creators, registration_questionnaire_answers: registrations.map(r => ({ registration_id: r.id, answers: data.snapshots[0].answers })), audit_logs: [] };
  const db = (failed = false) => ({ from(table: string) {
    let ids: unknown[] | null = null; let field = "";
    return { select() { return this; }, eq() { return this; }, order() { return this; },
      in(key: string, values: unknown[]) { ids = values; field = key; return this; },
      range(from: number, to: number) {
        const rows = ids ? tables[table].filter(row => ids!.includes((row as Record<string, unknown>)[field])) : tables[table];
        return Promise.resolve({ data: rows.slice(from, to + 1), error: failed ? { message: "read failed" } : null });
      } };
  } });
  assert.equal((await loadAccountAccessCandidates(db() as never, "event")).candidates.length, 1101);
  await assert.rejects(loadAccountAccessCandidates(db(true) as never, "event"), /read failed/);
});

test("SMTP success/failure is audited truthfully and audit failure never repeats an accepted send", async () => {
  const source = readFileSync(new URL("../lib/email/account-access.server.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const smtpFails of [false, true]) for (const auditFails of [false, true]) {
    let sends = 0; const logs: Record<string, unknown>[] = [];
    const exports: Record<string, (...args: unknown[]) => Promise<boolean>> = {};
    new Function("require", "exports", output)((id: string) => {
      if (id.includes("node:crypto")) return { createHash: () => ({ update: () => ({ digest: () => "hash" }) }) };
      if (id.includes("account-access.ts")) return { renderAccountAccessEmail };
      if (id.includes("smtp")) return { sendTransactionalEmail: async () => { sends++; if (smtpFails) throw Error("private@email.test"); } };
      throw Error(id);
    }, exports);
    const result = await exports.sendAccountAccessEmail({ from: () => ({ insert: async (row: Record<string, unknown>) => {
      logs.push(row); return { error: auditFails ? Error("audit failed") : null };
    } }) }, { name: "Synthetic", siteLink: "https://example.test", email: "private@email.test", eventId: "event", actorUserId: "actor", entityId: "reg" });
    assert.equal(result, !smtpFails); assert.equal(sends, 1);
    assert.match(String(logs[0].action), smtpFails ? /_failed$/ : /_(sent|simulated)$/);
    assert.ok(!JSON.stringify(logs).includes("private@email.test"));
  }
});

function manualHarness(options: { delegated?: boolean; writeFails?: boolean; mailFails?: boolean; unauthorized?: boolean } = {}) {
  const writes: string[] = []; const sends: Record<string, unknown>[] = [];
  const db = { from(table: string) {
    return { select() { return this; }, eq() { return this; },
      insert() { writes.push(table); return this; },
      async maybeSingle() { return { data: { id: "group", event_id: "event", is_active: true, is_assignable: true, events: {} }, error: null }; },
      async single() { return { data: { id: table === "participants" ? "person" : "reg" }, error: null }; },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ error: options.writeFails && table === "qr_tokens" ? { message: "write failed" } : null }).then(resolve); },
    };
  } };
  const dependencies = {
    validateContactFields: () => [], parseManualRegistrationForm: () => ({ ok: true, value: {
      useLeaderEmail: !!options.delegated, email: options.delegated ? null : "person@example.test", firstName: "Test", lastName: "Person",
      preferredLocale: "en", availabilityUnknown: true, children: [],
    } }),
    createSupabaseServerClient: async () => db, createSupabaseServiceClient: () => db,
    getCurrentAuthContext: async () => options.unauthorized ? null : ({ dashboardRole: "capogruppo", user: { id: "leader", email: "leader@example.test" } }),
    canManageGroupRegistrationLink: async () => true, normalizeEmail: (s: string) => s,
    hasExistingRegistrationForEmail: async () => false, relatedOne: () => ({}), buildAllowedAttendanceSlotKeys: () => new Set(),
    createOpaqueQrToken: () => ({ token: "opaque", tokenHash: "hash" }), encryptQrToken: () => "encrypted",
    buildManualRegistrationQuestionnaireAnswers: () => ({}), getQuestionnaireVisibilitySummary: () => ({}),
    REGISTRATION_QUESTIONNAIRE_VERSION: "v1", PRIVACY_VERSION: "v1",
    sendAccountAccessEmail: async (_db: unknown, input: Record<string, unknown>) => { sends.push(input); return !options.mailFails; },
    getAppUrl: () => "https://example.test", revalidatePath: () => {},
    redirect: (path: string) => { throw Error(`REDIRECT:${path}`); }, formFailureFromRedirect: (path: string) => path,
    require: (id: string) => id.includes("data.server") ? { loadQualityPeople: async () => [] } : {},
  };
  const source = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
  const code = source.slice(source.indexOf("export async function createGroupLeaderManualRegistration"), source.indexOf("export async function updateGroupRegistrationLink")).replace("export async", "async");
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const action = new Function(...Object.keys(dependencies), `${js}; return createGroupLeaderManualRegistration;`)(...Object.values(dependencies));
  return { action, sends, writes };
}

test("manual creation sends only after successful writes, never for delegation or unauthorized requests", async () => {
  const good = manualHarness(); await assert.rejects(good.action(new FormData()), /manualSaved=1$/);
  assert.equal(good.sends.length, 1); assert.equal(good.sends[0].entityId, "reg");
  assert.ok(good.writes.includes("qr_tokens"));
  const delegated = manualHarness({ delegated: true }); await assert.rejects(delegated.action(new FormData()), /manualSaved=1$/);
  assert.equal(delegated.sends.length, 0);
  const failed = manualHarness({ writeFails: true }); assert.match(await failed.action(new FormData()), /manualError/); assert.equal(failed.sends.length, 0);
  const denied = manualHarness({ unauthorized: true }); await assert.rejects(denied.action(new FormData()), /login/); assert.equal(denied.writes.length, 0); assert.equal(denied.sends.length, 0);
  const mailFailed = manualHarness({ mailFails: true }); await assert.rejects(mailFailed.action(new FormData()), /manualSaved=1&manualError=access-email/); assert.equal(mailFailed.sends.length, 1);
});

test("creating a leader from group management sends after membership success, never for an existing leader", async () => {
  const source = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
  const code = source.slice(source.indexOf("export async function assignGroupLeader"), source.indexOf("export async function assignOperationalUserRole")).replace("export async", "async");
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const mode of ["new", "existing"]) for (const writeFails of [false, true]) {
    const events: string[] = [];
    const db = { from(table: string) { return {
      select() { return this; }, eq() { return this; },
      maybeSingle: async () => ({ data: { id: "group", event_id: "event" } }),
      upsert: async () => { events.push("membership"); return { error: writeFails ? { message: "failed" } : null }; },
      insert: async () => { events.push(table); return { error: null }; },
    }; } };
    const target = async () => ({ ok: true, userId: "leader", fullName: "New Leader" });
    const dependencies = {
      validateContactFields: () => [], optionalText: (value: unknown) => value,
      getGroupManagementDashboardPath: () => "/dashboard/manager", parseGroupLeaderKind: () => "secondary",
      createSupabaseServerClient: async () => db, createSupabaseServiceClient: () => db,
      getGroupManagementRequestedRole: () => "manager",
      getCurrentAuthContext: async () => ({ user: { id: "actor" }, eventRoles: [{ role: "manager", eventId: "event" }] }),
      getExistingGroupLeaderTarget: target, getNewGroupLeaderTarget: target, normalizeEmail: (value: string) => value,
      syncGroupPrimaryLeaderName: async () => null,
      sendAccountAccessEmail: async () => { events.push("send"); return true; },
      getAppUrl: () => "https://example.test", revalidatePath: () => {}, getGroupLeaderSuccessPath: () => "/saved",
      formFailureFromRedirect: (value: string) => value, redirect: (path: string) => { throw Error(`REDIRECT:${path}`); },
    };
    const action = new Function(...Object.keys(dependencies), `${js}; return assignGroupLeader;`)(...Object.values(dependencies));
    const form = new FormData(); form.set("mode", mode); form.set("groupId", "group"); form.set("sourceDashboard", "manager"); form.set("email", "new@example.test");
    if (writeFails) assert.match(await action(form), /groupError/);
    else await assert.rejects(action(form), /REDIRECT/);
    assert.equal(events.includes("send"), mode === "new" && !writeFails);
    if (events.includes("send")) assert.equal(events.at(-1), "send");
  }
});
