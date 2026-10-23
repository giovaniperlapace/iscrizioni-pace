import assert from "node:assert/strict";
import test from "node:test";
import { FORUM_RELAY_ROOMS, getForumRelayRoom } from "../lib/events/assisi-2026-relay-rooms.ts";
import { FORUM_RELAY_COPY, relayDirections } from "../lib/panels/relay-copy.ts";
import { getForumLanguagesLabel } from "../lib/events/assisi-2026-forum-languages.ts";
import { renderForumWaitlistEmail } from "../lib/panels/waitlist-email.ts";
import { compareForums } from "../lib/panels/forum-order.ts";

test("six linked rooms offer 798 seats and every Serafico session has 110", () => {
 assert.equal(FORUM_RELAY_ROOMS.length, 6);
 assert.equal(new Set(FORUM_RELAY_ROOMS.map(r => r.sourceId)).size, 6);
 assert.equal(new Set(FORUM_RELAY_ROOMS.map(r => r.locationId)).size, 2);
 assert.equal(FORUM_RELAY_ROOMS.reduce((sum,r) => sum+r.capacity,0), 798);
 for (const room of FORUM_RELAY_ROOMS) {
  assert.equal(room.capacity, room.venue === "Serafico" ? 110 : 156);
  assert.equal(room.address, room.venue === "Serafico" ? "Viale Guglielmo Marconi 6, Assisi" : "Viale Giovanni XXIII 2, Assisi");
  assert.equal(room.parking, room.venue === "Serafico" ? "limited" : "ample");
  assert.equal(getForumRelayRoom(room.sourceId), undefined);
  assert.equal(getForumLanguagesLabel(room.id,"it"), "Lingue: italiano");
 }
});
for(const locale of ["it","en","fr","de","es","nl","uk"] as const) test(`relay offer unmistakably describes Italian only and retains original queue in ${locale}`, () => {
 const room=FORUM_RELAY_ROOMS[0], copy=FORUM_RELAY_COPY[locale];
 for(const notificationKind of ["participant","leader"] as const) {
 const email=renderForumWaitlistEmail({id:"offer",claim:"private",eventId:"event",registrationId:"registration",panelId:room.id,sectionId:room.sectionId,notificationKind,
 name:"<img onerror=bad>",email:"test@example.invalid",locale,title:"FORUM 1 — SALA COLLEGATA — SOLO IN ITALIANO",location:room.venue,
 startsAt:"2026-10-26T08:30:00Z",endsAt:"2026-10-26T11:30:00Z",expiresAt:"2026-10-23T12:30:00Z",seats:2},"https://example.invalid");
 assert.ok(email.subject.startsWith(copy.subject));
 assert.ok(email.text.startsWith(copy.badge));
 assert.ok(email.text.includes(copy.notice));
 assert.ok(email.text.includes(copy.queue));
 assert.ok(email.text.includes(room.address));
 assert.ok(email.text.includes(relayDirections(locale, room.parking)));
 assert.ok(email.html.includes(room.address));
 assert.ok(email.text.includes(copy.emailBody));
 assert.doesNotMatch(email.text, /60|minuti|minutes|Minuten|minutos|minuten|хвилин/);
 assert.ok(email.html.includes(`<strong>${copy.badge}</strong>`));
 assert.doesNotMatch(email.html,/<img|private|accept=/);
 assert.ok(email.text.includes(notificationKind==='leader'?`section=${room.sectionId}`:`/forum/${room.id}`));
 }
});
test("main room precedes its relay with the same Forum number", () => {
 const room=FORUM_RELAY_ROOMS[0];
 assert.ok(compareForums({id:room.sourceId,title:"FORUM 1 - Title"},{id:room.id,title:"FORUM 1 — SALA COLLEGATA — SOLO IN ITALIANO"})<0);
});

test("both venues carry their own address and parking in actual email rendering", () => {
 for (const room of FORUM_RELAY_ROOMS) {
  const email = renderForumWaitlistEmail({id:"offer",claim:"private",eventId:"event",registrationId:"registration",panelId:room.id,
   name:"Esempio",email:"test@example.invalid",locale:"it",title:"Forum",location:room.venue,
   startsAt:"2026-10-26T08:30:00Z",endsAt:"2026-10-26T11:30:00Z",expiresAt:"2026-10-23T12:30:00Z",seats:1},"https://example.invalid");
  assert.ok(email.text.includes(room.address));
  assert.match(email.text,/navetta Linea C o con mezzi propri/);
  assert.match(email.text,/2 ore/);
  assert.ok(email.text.includes(room.parking === "ample" ? "Ampio parcheggio." : "Parcheggio limitato."));
 }
});
