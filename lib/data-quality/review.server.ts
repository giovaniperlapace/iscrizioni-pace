import type { SupabaseClient } from "@supabase/supabase-js";
import { loadQualityPeople } from "./data.server.ts";
import { loadRowsForIds } from "../supabase/all-rows.ts";
import { hashIdentityFingerprint } from "./fingerprint.server.ts";
import { identityFingerprint } from "./duplicates.ts";
import { qualityExpiry, sealQualityPayload } from "./seal.server.ts";
import type { DuplicateReview } from "./review.ts";

/** Called only after qualityAccess. Every participant read is bounded to this
 * event and pair; the SQL version checks exactly the same comparison context. */
export async function loadDuplicateReview(
  db: SupabaseClient,
  service: SupabaseClient,
  eventId: string,
  actor: string,
  ids: [string, string],
  canWrite: boolean,
): Promise<DuplicateReview> {
  const version = async () => {
    const { data, error } = await service.rpc("quality_duplicate_pair_version", {
      p_event_id: eventId, p_actor_user_id: actor,
      p_left_id: ids[0], p_right_id: ids[1],
    });
    if (error || typeof data !== "string") throw new Error("Confronto non disponibile. Riprova.");
    return data;
  };
  const before = await version();
  const people = await loadQualityPeople(db, eventId, ids);
  const [services, tags] = await Promise.all([
    loadRowsForIds(people.flatMap(person => person.currentServiceId ? [person.currentServiceId] : []), (chunk, from, to) =>
      db.from("event_services").select("id,label").eq("event_id", eventId).eq("is_active", true).in("id", chunk).order("id").range(from, to)),
    loadRowsForIds(people.flatMap(person => person.tagIds), (chunk, from, to) =>
      db.from("operational_tags").select("id,label").eq("event_id", eventId).in("id", chunk).order("id").range(from, to)),
  ]);
  const after = await version();
  if (before !== after) throw new Error("Una delle due schede è cambiata. Ricarica il confronto.");
  const left = people.find(person => person.id === ids[0] && !person.deletedAt);
  const right = people.find(person => person.id === ids[1] && !person.deletedAt);
  if (!left || !right) throw new Error("Una delle iscrizioni non è più disponibile.");
  return {
    left, right, catalog: { groups: [], services: services.data, tags: tags.data }, canWrite,
    token: canWrite ? sealQualityPayload({
      kind: "review-v1", scope: "pair-v1", actor, eventId,
      expires: qualityExpiry(), version: before, left: left.id, right: right.id,
      leftFingerprint: hashIdentityFingerprint(identityFingerprint(left)),
      rightFingerprint: hashIdentityFingerprint(identityFingerprint(right)),
    }) : "",
  };
}
