import type { SupabaseClient } from "@supabase/supabase-js";

export const fixtureId = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
type RecordRow = Record<string, unknown>;
export function operationsPageDatabase(count = 5005) {
  const tables: Record<string, RecordRow[]> = {
    registrations: [], registration_children: [], participant_event_services: [],
    registration_questionnaire_answers: [], event_attendance_choices: [], accessibility_needs: [],
    groups: [{ id: "group", event_id: "event", name: "Gruppo prova", is_active: true, is_assignable: true }],
    operational_tags: [{ id: "tag", event_id: "event", label: "Tag prova", color: "#123456" }],
    event_services: [{ id: "service", event_id: "event", label: "Servizio prova", is_active: true, public_order: 0, description: null }],
  };
  for (let i = 0; i < count; i++) {
    const id = fixtureId(i);
    const child = { id: `child-${i}`, registration_id: id, first_name: "Minore", last_name: `Prova ${i}`, birth_date: "2018-01-01", position: 0 };
    const service = { id: `service-${i}`, event_id: "event", registration_id: id, participant_id: `person-${i}`, service_id: "service", status: "assigned", source: "manager", participant_note: "Nota conservata", operator_note: null, updated_at: null, event_services: { label: "Servizio prova" } };
    if (i % 7 === 0) tables.registration_children.push(child);
    if (i % 3 === 0) tables.participant_event_services.push(service);
    tables.registrations.push({
      id, event_id: "event", participant_id: `person-${i}`, status: "submitted", submitted_at: "2026-09-01",
      deleted_at: null, deleted_by: null, deletion_reason: null,
      registration_children: i % 7 === 0 ? [{ id: child.id }] : [],
      participant_group_assignments: i % 2 === 0 ? [{ id: `assignment-${i}`, group_id: "group", status: "confirmed", groups: { name: "Gruppo prova" } }] : [],
      participants: {
        id: `person-${i}`, auth_user_id: null, first_name: "Anna", last_name: `Test ${i}`, birth_date: "2000-01-01", public_code: `P${i}`,
        country_other: "Italy", city_other: i % 2 === 0 ? "Roma" : "Milano", countries: null, cities: null,
        participant_contacts: [{ id: `contact-${i}`, email: `fixture${i}@example.test`, phone: `+39000${i}` }],
        participant_event_services: i % 3 === 0 ? [service] : [],
        participant_operational_tags: i % 5 === 0 ? [{ tag_id: "tag", assigned_at: null, operational_tags: tables.operational_tags[0] }] : [],
      },
    });
    tables.registration_questionnaire_answers.push({ id: `answer-${i}`, registration_id: id, created_at: "2026-10-01", nationality: i % 2 === 0 ? "Italian" : "French", association: `Associazione ${count - i}`, source: "public", has_email: true, use_leader_email: false });
    tables.event_attendance_choices.push({ id: `attendance-${i}`, registration_id: id, day: "2026-10-25", day_part: "morning", choice: i % 2 === 0 ? "yes" : "no" });
  }
  const calls: { table: string; select: string; ids: string[] | null; from: number; to: number; filters: [string, unknown][] }[] = [];
  const rpcCalls: string[][] = [];
  let fail: ((table: string, from: number) => boolean) | null = null;
  const db = {
    from(table: string) {
      let selection = "", ids: string[] | null = null, from = 0, to = 499;
      const filters: [string, unknown][] = [], ordering: [string, boolean][] = [];
      const predicates: ((row: RecordRow) => boolean)[] = [];
      const query = {
        select(value: string) { selection = value; return query; },
        eq(column: string, value: unknown) { filters.push([column, value]); if (!column.includes(".")) predicates.push(row => row[column] === value); return query; },
        in(column: string, values: string[]) { ids = values; predicates.push(row => values.includes(String(row[column]))); return query; },
        filter(column: string, operation: string) { predicates.push(row => operation === "is" ? row[column] === null : row[column] !== null); return query; },
        order(column: string, options?: { ascending?: boolean }) { ordering.push([column, options?.ascending !== false]); return query; },
        range(start: number, end: number) { from = start; to = end; return query; },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          calls.push({ table, select: selection, ids, from, to, filters });
          if (fail?.(table, from)) return Promise.resolve({ data: null, error: { message: "Synthetic read failure" } }).then(resolve, reject);
          const rows = [...(tables[table] ?? [])].filter(row => predicates.every(predicate => predicate(row))).sort((a, b) => {
            for (const [column, asc] of ordering) { const c = String(a[column] ?? "").localeCompare(String(b[column] ?? "")); if (c) return asc ? c : -c; }
            return 0;
          });
          return Promise.resolve({ data: structuredClone(rows.slice(from, to + 1)), error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(_name: string, args: { p_registration_ids: string[] }) {
      rpcCalls.push(args.p_registration_ids);
      return { data: args.p_registration_ids.map(registration_id => ({ registration_id, sex: Number(registration_id.slice(-12)) % 2 === 0 ? "male" : "female" })), error: null };
    },
  };
  return { db: db as unknown as SupabaseClient, tables, calls, rpcCalls, failWhen: (fn: typeof fail) => { fail = fn; } };
}
