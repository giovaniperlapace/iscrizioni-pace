import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as forms from '../lib/forms/result.ts';
import { parseManualRegistrationForm, buildManualRegistrationQuestionnaireAnswers } from '../lib/registrations/manual-registration.ts';
import { manualRegistrationPath } from '../lib/registrations/manual-registration-navigation.ts';
import { canCreateOperationsRegistration } from '../lib/registrations/manual-registration-access.ts';
import { explicitParticipantDelegate, chooseParticipantDelegate } from '../lib/email/participant-delegate.ts';
import { normalizeEmail } from '../lib/registrations/validation.ts';
import { attendanceSlotKey, buildAllowedAttendanceSlotKeys } from '../lib/registrations/attendance-slots.ts';

const groupId = '11111111-1111-4111-8111-111111111111';
function data() {
  const form = new FormData();
  for (const [key, value] of Object.entries({ sourceDashboard: 'manager', groupId, firstName: 'Test', lastName: 'Persona', email: 'person@example.test', birthDate: '1990-01-02', cityOther: 'Berlin', availabilityUnknown: 'on', consentConfirmed: 'on' })) form.set(key, value);
  return form;
}
type Options = { roles?: Array<{ role: string; eventId: string | null }>; current?: string | null; group?: Record<string, unknown>; groupError?: boolean; duplicateEmail?: boolean; duplicate?: boolean; failedWrite?: string; mailFails?: boolean; unauthenticated?: boolean };
function harness(options: Options = {}) {
  const writes: Array<{ table: string; row: any }> = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const sends: unknown[] = [];
  const reads: string[] = [];
  const db = { from(table: string) {
    reads.push(table);
    return { select() { return this; }, eq() { return this; },
      insert(row: unknown) { writes.push({ table, row }); return this; },
      async maybeSingle() { return { data: { id: groupId, event_id: 'event', name: 'Hidden group', is_active: true, is_assignable: true, is_public_catalog: false, country_id: null, city_id: null, events: { starts_on: '2026-10-25', ends_on: '2026-10-27' }, ...options.group }, error: options.groupError ? { message: 'read failed' } : null }; },
      async single() { return { data: { id: table === 'participants' ? 'participant' : 'registration', public_code: 'TEST' }, error: null }; },
      then(resolve: (result: unknown) => unknown) { return Promise.resolve({ error: options.failedWrite === table ? { message: 'failed' } : null }).then(resolve); },
    };
  } };
  const deps = { ...forms, parseManualRegistrationForm, buildManualRegistrationQuestionnaireAnswers, canCreateOperationsRegistration, manualRegistrationPath, normalizeEmail, attendanceSlotKey, buildAllowedAttendanceSlotKeys,
    createSupabaseServerClient: async () => db, createSupabaseServiceClient: () => db,
    getCurrentAuthContext: async () => options.unauthenticated ? null : ({ dashboardRole: options.roles?.[0]?.role === 'capogruppo' ? 'capogruppo' : 'manager', user: { id: 'operator', email: 'operator@example.test' }, eventRoles: options.roles ?? [{ role: 'manager', eventId: 'event' }] }),
    getCurrentOperationalEventId: async () => options.current === undefined ? 'event' : options.current,
    canManageGroupRegistrationLink: async () => true,
    hasExistingRegistrationForEmail: async () => !!options.duplicateEmail,
    relatedOne: (value: unknown) => Array.isArray(value) ? value[0] : value,
    createOpaqueQrToken: () => ({ token: 'opaque', tokenHash: 'hash' }), encryptQrToken: () => 'encrypted',
    toRegistrationChildRows: (id: string, children: unknown[]) => children.map(child => ({ registration_id: id, child })),
    getQuestionnaireVisibilitySummary: () => ({}), REGISTRATION_QUESTIONNAIRE_VERSION: 'v1', PRIVACY_VERSION: 'v1',
    sendAccountAccessEmail: async (_db: unknown, input: unknown) => { sends.push(input); return !options.mailFails; },
    getAppUrl: () => 'https://example.test', revalidatePath: () => {},
    redirect: (path: string) => { throw Error('REDIRECT:' + path); },
    require: (id: string) => id.includes('data.server') ? { loadQualityPeople: async () => options.duplicate ? [{ id: 'other' }] : [] }
      : id.includes('fingerprint.server') ? { hashIdentityFingerprint: () => 'hash' }
      : { compareIdentities: () => true, identityFingerprint: () => 'identity' },
  };
  const source = readFileSync(new URL('../app/actions.ts', import.meta.url), 'utf8');
  const code = source.slice(source.indexOf('export async function createGroupLeaderManualRegistration'), source.indexOf('export async function updateGroupRegistrationLink')).replace('export async', 'async');
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const action = new Function(...Object.keys(deps), js + ';return createGroupLeaderManualRegistration;')(...Object.values(deps));
  return { action, writes, sends, reads };
}

test('operational manual action authorizes only global Admin or current-event Manager before reading groups', async () => {
  for (const roles of [[], [{ role: 'manager_viewer', eventId: 'event' }], [{ role: 'manager', eventId: 'other' }], [{ role: 'admin', eventId: 'event' }], [{ role: 'capogruppo', eventId: 'event' }], [{ role: 'manager_viewer', eventId: 'event' }, { role: 'capogruppo', eventId: 'event' }]]) {
    const h = harness({ roles });
    assert.deepEqual(await h.action(data()), forms.formFailure([{ field: null, code: 'forbidden' }]));
    assert.deepEqual(h.reads, []); assert.deepEqual(h.writes, []); assert.deepEqual(h.sends, []);
  }
  const noEvent = harness({ current: null }); assert.equal((await noEvent.action(data())).status, 'error'); assert.deepEqual(noEvent.writes, []);
  const noAuth = harness({ unauthenticated: true }); await assert.rejects(noAuth.action(data()), /REDIRECT:\/login/); assert.deepEqual(noAuth.writes, []);
});

test('Manager and Admin create in unassigned hidden groups, recording actual provenance, children, attendance and consent', async () => {
  for (const actor of ['manager', 'admin']) {
    const h = harness({ roles: [{ role: actor, eventId: actor === 'admin' ? null : 'event' }] });
    const form = data();
    form.set('created_by', 'forged'); form.set('eventId', 'forged');
    form.set('participatesWithChildren', 'yes'); form.set('childrenCount', '1');
    form.set('child_0_firstName', 'Test'); form.set('child_0_lastName', 'Child'); form.set('child_0_birthDate', '2020-02-02');
    await assert.rejects(h.action(form), /REDIRECT:\/dashboard\/manager\?.*manual=1&manualSaved=1$/);
    const row = (table: string) => h.writes.find(w => w.table === table)!.row;
    assert.equal(row('participants').city_other, 'Berlin');
    assert.equal(row('participants').city_id, null);
    assert.equal(row('registration_questionnaire_answers').answers.residence.cityOther, 'Berlin');
    assert.equal(row('registrations').source, 'admin'); assert.equal(row('registrations').created_by, 'operator');
    assert.equal(row('registrations').event_id, 'event');
    assert.equal(row('participant_group_assignments').group_id, groupId);
    assert.equal(row('participant_group_assignments').source, actor);
    assert.equal(row('participant_group_assignments').status, 'confirmed');
    assert.equal(row('participant_group_assignments').leader_decision_by, null);
    assert.equal(row('registration_questionnaire_answers').answers.source, actor + '_manual');
    assert.equal(row('participant_consents').accepted_by_user_id, 'operator');
    assert.equal(row('registration_children').length, 1);
    assert.deepEqual(row('event_attendance_choices'), [{ registration_id: 'registration', choice: 'unknown' }]);
    assert.equal(row('audit_logs').action, 'registration.created_by_' + actor);
    assert.equal(h.sends.length, 1);
  }
});

test('operational insertion fails closed for obsolete groups, other events, read errors, dates, duplicate email and missing consent', async () => {
  for (const option of [{ group: { is_active: false } }, { group: { is_assignable: false } }, { group: { event_id: 'other' } }, { groupError: true }, { duplicateEmail: true }]) {
    const h = harness(option); assert.equal((await h.action(data())).status, 'error'); assert.equal(h.writes.length, 0); assert.equal(h.sends.length, 0);
  }
  for (const [field, value] of [['cityOther', ''], ['cityOther', '   '], ['cityOther', 'x'.repeat(121)], ['birthDate', ''], ['birthDate', '2999-01-01'], ['consentConfirmed', ''], ['email', 'operator@example.test']]) {
    const h = harness(); const form = data(); form.set(field, value);
    assert.equal((await h.action(form)).status, 'error'); assert.equal(h.writes.length, 0);
  }
  const h = harness(); const form = data(); form.delete('availabilityUnknown'); form.set('availabilitySlots', '2026-10-24__morning');
  assert.equal((await h.action(form)).status, 'error'); assert.equal(h.writes.length, 0);
});

test('operational duplicate override requires a reason and preserves data-quality audit', async () => {
  const h = harness({ duplicate: true }); const form = data();
  assert.equal((await h.action(form)).issues[0].field, 'duplicateReason'); assert.equal(h.writes.length, 0);
  form.set('duplicateReason', 'Verified distinct people');
  await assert.rejects(h.action(form), /manualSaved=1$/);
  assert.equal(h.writes.filter(w => w.table === 'duplicate_reviews').length, 1);
});

test('no personal email delegates to the group leader, never to the inserting Manager', async () => {
  const h = harness(); const form = data(); form.set('useLeaderEmail', 'on'); form.set('communicationDelegateUserId', 'forged');
  await assert.rejects(h.action(form), /manualSaved=1$/);
  assert.equal(h.sends.length, 0); assert.equal(h.writes.filter(w => w.table === 'participant_contacts').length, 0);
  const answers = h.writes.find(w => w.table === 'registration_questionnaire_answers')!.row.answers;
  assert.equal(answers.contact.useLeaderEmail, false); assert.equal(answers.contact.communicationDelegateUserId, null);
  const delegate = explicitParticipantDelegate({ source: 'admin', created_by: 'operator' }, answers);
  assert.equal(chooseParticipantDelegate(delegate, ['group-leader']), 'group-leader');
  assert.equal(chooseParticipantDelegate(delegate, []), null);
});

test('failed writes never send and failed email returns saved state without encouraging a duplicate insertion', async () => {
  for (const failedWrite of ['qr_tokens', 'registration_questionnaire_answers']) {
    const h = harness({ failedWrite }); assert.equal((await h.action(data())).status, 'error'); assert.equal(h.sends.length, 0);
  }
  const h = harness({ mailFails: true }); await assert.rejects(h.action(data()), /manualSaved=1&manualError=access-email$/); assert.equal(h.sends.length, 1);
});

async function pageHarness(options: { role?: string; eventId?: string; failPage?: boolean } = {}) {
  const { loadAllRows } = await import('../lib/supabase/all-rows.ts');
  const rows = Array.from({ length: 1101 }, (_, index) => ({ id: `group-${index}`, name: `Group ${index}` }));
  const filters: Array<[string, unknown]> = [];
  const ranges: number[] = [];
  const db = { from(table: string) {
    assert.equal(table, 'groups');
    return { select() { return this; }, eq(key: string, value: unknown) { filters.push([key, value]); return this; }, order() { return this; },
      range(from: number, to: number) { ranges.push(from); return Promise.resolve({ data: rows.slice(from, to + 1), error: options.failPage && from > 0 ? { message: 'page failed' } : null }); },
    };
  } };
  const source = readFileSync(new URL('../app/dashboard/operations-manual-registration.tsx', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: Record<string, (props: unknown) => Promise<unknown>> = {};
  new Function('require', 'exports', js)((id: string) => {
    if (id === 'node:crypto') return { randomUUID: () => 'synthetic-form-key' };
    if (id === 'react/jsx-runtime') return { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) };
    if (id === 'next/navigation') return { redirect: (path: string) => { throw Error('REDIRECT:' + path); } };
    if (id.endsWith('session')) return { getCurrentAuthContext: async () => ({ user: { id: 'operator' }, eventRoles: [{ role: options.role ?? 'manager', eventId: options.eventId ?? 'event' }] }) };
    if (id.endsWith('supabase/server')) return { createSupabaseServerClient: async () => db };
    if (id.endsWith('supabase/service')) return { createSupabaseServiceClient: () => db };
    if (id.endsWith('events/current')) return { getCurrentOperationalEvent: async () => ({ id: 'event', title: 'Synthetic event' }) };
    if (id.endsWith('all-rows')) return { loadAllRows };
    if (id.endsWith('manual-registration-navigation')) return { manualRegistrationPath };
    if (id.endsWith('manual-registration-access')) return { canCreateOperationsRegistration };
    if (id.endsWith('i18n/server')) return { getRequestLocale: async () => 'it' };
    if (id.endsWith('manual-registration-copy')) return { MANUAL_REGISTRATION_COPY: { it: { addParticipant: 'Add' } } };
    if (id.endsWith('operations-manual-copy')) return { OPERATIONS_MANUAL_COPY: { it: { help: 'Help' } } };
    if (id.endsWith('attendance-slots')) return { buildAttendanceDayColumns: () => [] };
    if (id.endsWith('manual-registration-section')) return { ManualRegistrationSection: 'ManualRegistrationSection' };
    return {};
  }, exports);
  return { page: () => exports.OperationsManualRegistration({ dashboard: 'manager', searchParams: {} }), filters, ranges };
}

test('direct new-participant URL denies Viewer and wrong-event Manager before loading groups', async () => {
  for (const options of [{ role: 'manager_viewer' }, { role: 'capogruppo' }, { eventId: 'other' }]) {
    const h = await pageHarness(options);
    await assert.rejects(h.page(), /REDIRECT:\/dashboard\/manager\?section=iscritti/);
    assert.deepEqual(h.ranges, []);
  }
});

test('new-participant catalogue is paginated, scoped and includes private groups; later errors abort rendering', async () => {
  const h = await pageHarness();
  const rendered = JSON.stringify(await h.page());
  assert.ok(rendered.includes('group-1100'));
  assert.deepEqual(h.ranges, [0, 500, 1000]);
  assert.ok(h.filters.some(([key, value]) => key === 'event_id' && value === 'event'));
  assert.ok(h.filters.some(([key, value]) => key === 'is_active' && value === true));
  assert.ok(h.filters.some(([key, value]) => key === 'is_assignable' && value === true));
  assert.ok(!h.filters.some(([key]) => key === 'is_public_catalog'));
  const failure = await pageHarness({ failPage: true }); await assert.rejects(failure.page(), /page failed/);
});

test('overlay navigation preserves filters and display preferences, strips other dialogs and rejects external destinations', () => {
  for (const dashboard of ['manager', 'admin'] as const) for (const nav of ['full', 'mini']) {
    const query = new URLSearchParams({ q: 'Anna & Rossi', contact: 'email', group: 'group', tag: 'tag', service: 'service', status: 'submitted', stat: 'stat', view: 'without-group', sort: 'name', direction: 'desc', columns: 'name,group', nav, edit: 'person', import: 'excel', manualSaved: '1', manualError: 'access-email' });
    const opened = new URL(manualRegistrationPath(`/dashboard/${dashboard}?${query}`, dashboard, true), 'https://local.invalid');
    for (const key of ['q', 'contact', 'group', 'tag', 'service', 'status', 'stat', 'view', 'sort', 'direction', 'columns', 'nav']) assert.equal(opened.searchParams.get(key), query.get(key));
    for (const key of ['edit', 'import', 'manualSaved', 'manualError']) assert.equal(opened.searchParams.has(key), false);
    assert.equal(opened.searchParams.get('manual'), '1');
    assert.equal(opened.searchParams.get('section'), 'iscritti');
    assert.equal(new URL(manualRegistrationPath(opened.pathname + opened.search, dashboard), opened).searchParams.has('manual'), false);
  }
  for (const value of ['https://evil.example/path', '//evil.example/path', '/dashboard/admin?section=ruoli', '/dashboard/manager/evil?nav=full', null]) {
    assert.equal(manualRegistrationPath(value, 'manager', true), '/dashboard/manager?section=iscritti&nav=mini&manual=1');
  }
});

test('successful insertion returns to the same authorized dashboard overlay with filters and email warning', async () => {
  for (const dashboard of ['manager', 'admin'] as const) {
    const h = harness({ roles: [{ role: dashboard, eventId: dashboard === 'admin' ? null : 'event' }], mailFails: true });
    const form = data(); form.set('returnTo', `/dashboard/${dashboard}?section=iscritti&q=Rossi&group=private&nav=full&manualSaved=old&edit=someone`);
    await assert.rejects(h.action(form), (error: Error) => {
      const destination = new URL(error.message.replace('REDIRECT:', ''), 'https://local.invalid');
      assert.equal(destination.pathname, `/dashboard/${dashboard}`);
      assert.equal(destination.searchParams.get('q'), 'Rossi');
      assert.equal(destination.searchParams.get('group'), 'private');
      assert.equal(destination.searchParams.get('nav'), 'full');
      assert.equal(destination.searchParams.get('manual'), '1');
      assert.equal(destination.searchParams.get('manualSaved'), '1');
      assert.equal(destination.searchParams.get('manualError'), 'access-email');
      assert.equal(destination.searchParams.has('edit'), false);
      return true;
    });
  }
});


test('leader saves the supplied residence city, never the city of the assigned group', async () => {
  const h = harness({ roles: [{ role: 'capogruppo', eventId: 'event' }], group: { city_id: 'unrelated-group-city' } });
  const form = data(); form.delete('sourceDashboard'); form.set('cityOther', '  Würzburg  ');
  await assert.rejects(h.action(form), /REDIRECT:\/dashboard\/capogruppo\?manualSaved=1$/);
  const participant = h.writes.find(w => w.table === 'participants')!.row;
  assert.equal(participant.city_other, 'Würzburg');
  assert.equal(participant.city_id, null);
  assert.equal(participant.birth_date, '1990-01-02');
  assert.equal(h.writes.find(w => w.table === 'registration_questionnaire_answers')!.row.answers.residence.cityOther, 'Würzburg');
});
