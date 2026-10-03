import { attendanceTableColumns } from "../registrations/attendance-summary.ts";
import { PRESENCE_EXPORTS } from "./catalog.ts";
import type { PresenceConfig, PresenceLine, PresenceReport, PresenceSource, PresenceVariant } from "./types.ts";

const normalize = (value: string) => value.normalize("NFC").trim().toLocaleLowerCase("it");

export function buildPresenceReport(source: PresenceSource, config: PresenceConfig, variant: PresenceVariant): PresenceReport {
  if (config.eventId !== source.event.id) throw new Error("Raccordo di un altro evento");
  const slots = attendanceTableColumns(source.event.starts_on, source.event.ends_on);
  if (!slots.length) throw new Error("Calendario evento non disponibile");
  const withServices = variant === "b" || variant === "b2";
  const grouped = variant === "a2" || variant === "b2";
  const width = slots.length + 2;
  const zero = () => Array<number>(width).fill(0);
  const zones = [...config.zones, { id: "servizi", label: "Servizi" }, { id: "non-classificati", label: "Da classificare" }, { id: "verificare", label: "Da verificare" }];
  const zoneLabels = new Map(zones.map(zone => [zone.id, zone.label]));
  if (zoneLabels.size !== zones.length) throw new Error("Zone duplicate nel raccordo");
  const groups = new Map(source.groups.map(group => [group.id, group]));
  const rules = new Map(config.groups.map(rule => [rule.groupId, rule]));
  const roots = new Map(config.zoneRoots.map(rule => [rule.groupId, rule]));
  if (rules.size !== config.groups.length || roots.size !== config.zoneRoots.length) throw new Error("Gruppi duplicati nel raccordo");
  for (const rule of [...config.groups, ...config.zoneRoots]) {
    if (!config.zones.some(zone => zone.id === rule.zoneId)) throw new Error("Zona non valida nel raccordo");
  }
  const classifications = new Map<string, { zoneId: string; rollup: string | null; inherited: boolean }>();
  for (const group of source.groups) {
    const visited = new Set<string>();
    let current: typeof group | undefined = group;
    let classification: { zoneId: string; rollup: string | null; inherited: boolean } | undefined;
    while (current) {
      if (visited.has(current.id)) throw new Error("Gerarchia gruppi ciclica");
      visited.add(current.id);
      const rule = rules.get(current.id);
      const root = roots.get(current.id);
      if (!classification && (rule || root)) classification = {
        zoneId: (rule ?? root)!.zoneId, rollup: rule?.rollup ?? null, inherited: current.id !== group.id,
      };
      if (!current.parent_group_id) break;
      current = groups.get(current.parent_group_id);
      if (!current) throw new Error("Gerarchia gruppi incompleta");
    }
    classifications.set(group.id, classification ?? { zoneId: "non-classificati", rollup: null, inherited: false });
  }
  const warnings = new Set<string>();
  const assignments = new Map<string, string>();
  for (const row of source.assignments) {
    if (assignments.has(row.registration_id)) throw new Error("Più gruppi correnti per la stessa iscrizione");
    if (!groups.has(row.group_id)) throw new Error("Gruppo assegnato non disponibile");
    assignments.set(row.registration_id, row.group_id);
  }
  const services = new Map(source.services.map(service => [service.id, service]));
  const serviceByRegistration = new Map<string, string>();
  for (const row of source.serviceAssignments) {
    if (row.status !== "assigned") continue;
    if (serviceByRegistration.has(row.registration_id)) throw new Error("Più servizi assegnati alla stessa iscrizione");
    if (!services.has(row.service_id)) throw new Error("Servizio assegnato non disponibile");
    serviceByRegistration.set(row.registration_id, row.service_id);
  }
  const tags = new Map(source.tags.map(tag => [tag.id, tag.label]));
  const operatorTargets = new Map<string, string>();
  for (const rule of config.groups) if (rule.operatorTag) {
    const key = normalize(rule.operatorTag);
    if (operatorTargets.has(key)) throw new Error("Tag operatore collegato a più gruppi");
    operatorTargets.set(key, rule.groupId);
  }
  const tagsByParticipant = new Map<string, string[]>();
  for (const row of source.tagAssignments) {
    const label = tags.get(row.tag_id);
    if (!label) throw new Error("Tag assegnato non disponibile");
    const labels = tagsByParticipant.get(row.participant_id) ?? [];
    labels.push(normalize(label));
    tagsByParticipant.set(row.participant_id, labels);
  }
  const attendance = new Map<string, Set<string>>();
  const allowedSlots = new Set(slots.map(slot => slot.key));
  for (const row of source.attendance) {
    if (row.choice !== "yes" || !row.day) continue;
    const selected = attendance.get(row.registration_id) ?? new Set<string>();
    for (const part of row.day_part ? [row.day_part] : ["morning", "afternoon"]) {
      const key = `${row.day}__${part}`;
      if (allowedSlots.has(key)) selected.add(key);
    }
    attendance.set(row.registration_id, selected);
  }
  const childCounts = new Map<string, number>();
  const childIds = new Set<string>();
  const registrationIds = new Set(source.registrations.map(row => row.id));
  if (registrationIds.size !== source.registrations.length) throw new Error("Iscrizioni duplicate");
  for (const child of source.children) {
    if (!registrationIds.has(child.registration_id) || childIds.has(child.id)) throw new Error("Figli non coerenti con le iscrizioni");
    childIds.add(child.id);
    childCounts.set(child.registration_id, (childCounts.get(child.registration_id) ?? 0) + 1);
  }
  type Bucket = { key: string; label: string; zoneId: string };
  function groupBucket(groupId: string | undefined): Bucket {
    if (!groupId) return { key: "no-group", label: "Senza gruppo", zoneId: "non-classificati" };
    const group = groups.get(groupId)!;
    const classification = classifications.get(groupId)!;
    if (classification.zoneId === "non-classificati") warnings.add("I gruppi senza raccordo sono inclusi in Da classificare; il totale generale li comprende.");
    return grouped && classification.rollup
      ? { key: `rollup:${classification.zoneId}:${classification.rollup}`, label: classification.rollup, zoneId: classification.zoneId }
      : { key: `group:${groupId}`, label: group.name, zoneId: classification.zoneId };
  }
  function adultBucket(registrationId: string, participantId: string, original: Bucket): Bucket {
    if (!withServices) return original;
    const operatorLabels = (tagsByParticipant.get(participantId) ?? []).filter(label => operatorTargets.has(label) || label.startsWith("acc_"));
    const targets = new Set(operatorLabels.map(label => operatorTargets.get(label)));
    if (targets.size > 1 || (operatorLabels.length && (targets.has(undefined) || [...targets].some(id => !id || !groups.has(id))))) {
      warnings.add("Alcuni operatori hanno tag senza raccordo o collegati a gruppi diversi: sono contati una sola volta in Da verificare, senza attribuzioni arbitrarie.");
      return { key: "operator-conflict", label: "Operatori con raccordo da verificare", zoneId: "verificare" };
    }
    const target = [...targets][0];
    if (target) return groupBucket(target);
    const serviceId = serviceByRegistration.get(registrationId);
    return serviceId ? { key: `service:${serviceId}`, label: services.get(serviceId)!.label, zoneId: "servizi" } : original;
  }
  const buckets = new Map<string, PresenceLine>();
  const total = zero();
  function add(bucket: Bucket, values: number[], count: number) {
    if (!count) return;
    const line = buckets.get(bucket.key) ?? { ...bucket, values: zero(), kind: "detail" as const };
    values.forEach((value, index) => { line.values[index] += value * count; total[index] += value * count; });
    buckets.set(bucket.key, line);
  }
  for (const registration of source.registrations) {
    const selected = attendance.get(registration.id) ?? new Set<string>();
    const values = [1, ...slots.map(slot => Number(selected.has(slot.key))), Number(selected.size === 0)];
    const original = groupBucket(assignments.get(registration.id));
    add(adultBucket(registration.id, registration.participant_id, original), values, 1);
    // Children inherit attendance, but do not inherit adult service/operator duties.
    add(original, values, childCounts.get(registration.id) ?? 0);
  }
  // Disambiguate homonymous rows without combining their counts.
  const labelCounts = new Map<string, number>();
  for (const line of buckets.values()) {
    const key = `${line.zoneId}:${normalize(line.label)}`;
    labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
  }
  const lines: PresenceLine[] = [];
  for (const zone of zones) {
    const detail = [...buckets.values()].filter(line => line.zoneId === zone.id)
      .sort((a, b) => a.label.localeCompare(b.label, "it") || a.key.localeCompare(b.key));
    if (!detail.length) continue;
    for (const line of detail) if ((labelCounts.get(`${line.zoneId}:${normalize(line.label)}`) ?? 0) > 1) line.label += ` [${line.key.replace(/^(group|service):/, "")}]`;
    lines.push(...detail, { key: `subtotal:${zone.id}`, label: `TOTALE ${zone.label.toLocaleUpperCase("it")}`, zoneId: zone.id, kind: "subtotal",
      values: detail.reduce((sum, line) => sum.map((value, index) => value + line.values[index]), zero()) });
  }
  lines.push({ key: "total", label: "TOTALE GENERALE", zoneId: "", kind: "total", values: total });
  const tagNames = new Set(source.tags.map(tag => normalize(tag.label)));
  const assignedGroupIds = new Set(assignments.values());
  const mapping = source.groups.filter(group => group.is_assignable || assignedGroupIds.has(group.id) || rules.has(group.id))
    .map(group => {
      const classification = classifications.get(group.id)!;
      const rule = rules.get(group.id);
      return { groupId: group.id, name: group.name, zone: zoneLabels.get(classification.zoneId)!, rollup: classification.rollup ?? "", tag: rule?.operatorTag ?? "",
        status: classification.zoneId === "non-classificati" ? "Zona da indicare" : rule?.operatorTag && !tagNames.has(normalize(rule.operatorTag)) ? "Tag previsto, non ancora presente" : classification.inherited ? "Zona/raggruppamento ereditati dal nodo superiore" : "Raccordo esplicito" };
    }).sort((a, b) => a.zone.localeCompare(b.zone, "it") || a.name.localeCompare(b.name, "it"));
  return { variant, title: PRESENCE_EXPORTS.find(item => item.key === variant)!.title,
    headers: ["Comunità / gruppo / servizio", "Totale persone", ...slots.map(slot => `${slot.part === "morning" ? "Mattina" : "Pomeriggio"}\n${slot.day.slice(8, 10)}/${slot.day.slice(5, 7)}/${slot.day.slice(0, 4)}`), "Date non indicate"],
    lines, warnings: [...warnings], mapping, total, extractedAt: source.extractedAt, eventTitle: source.event.title, configVersion: config.version };
}
