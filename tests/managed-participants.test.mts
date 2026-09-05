import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseManualRegistrationForm, buildManualRegistrationQuestionnaireAnswers } from "../lib/registrations/manual-registration.ts";
import { isRegistrationQrActive, formatManagedAttendance } from "../lib/registrations/managed-card.ts";
import { MANAGED_PARTICIPANT_COPY } from "../lib/registrations/managed-participant-copy.ts";

function form() {
 const data = new FormData();
 for (const [key, value] of Object.entries({groupId:"11111111-1111-4111-8111-111111111111",firstName:"Test",lastName:"Participant",consentConfirmed:"on",availabilityUnknown:"on",deliveryMode:"delegated"})) data.set(key,value);
 return data;
}
test("email-less and phone-less manual entry preserves empty personal contacts and declared source", () => {
 const result = parseManualRegistrationForm(form());
 assert.ok(result.ok);
 assert.equal(result.value.email,null);
 assert.equal(result.value.phone,null);
 assert.equal(result.value.deliveryMode,"delegated");
 const answers=buildManualRegistrationQuestionnaireAnswers(result.value,{id:result.value.groupId,name:"Group"});
 assert.equal(answers.contact.deliveryMode,"delegated");
 assert.equal(answers.consents.acceptedByGroupLeader,true);
 assert.equal(answers.groupParticipation.hasPreviousSantegidioParticipation,null);
});
test("direct delivery requires a real personal email even with a phone", () => {
 const data=form(); data.set("deliveryMode","personal"); data.set("phone","+393331234567");
 assert.equal(parseManualRegistrationForm(data).ok,false);
 data.set("email","person@example.org");
 const result=parseManualRegistrationForm(data); assert.ok(result.ok); assert.equal(result.value.email,"person@example.org");
 data.set("email","broken"); assert.equal(parseManualRegistrationForm(data).ok,false);
});
test("QR remains the same real token while status includes cancellation, revocation and expiry", () => {
 const now=Date.parse("2026-09-05T12:00:00Z");
 assert.equal(isRegistrationQrActive({status:"active",expires_at:null},"submitted",now),true);
 for (const status of ["revoked","expired"]) assert.equal(isRegistrationQrActive({status,expires_at:null},"submitted",now),false);
 assert.equal(isRegistrationQrActive({status:"active",expires_at:null},"cancelled",now),false);
 assert.equal(isRegistrationQrActive({status:"active",expires_at:"2026-09-05T11:00:00Z"},"submitted",now),false);
 assert.equal(isRegistrationQrActive(null,"submitted",now),false);
});
test("attendance expands legacy all-day choice and localizes all seven languages", () => {
 for (const locale of ["it","en","fr","de","es","nl","uk"] as const) {
   const copy=MANAGED_PARTICIPANT_COPY[locale];
   const summary=formatManagedAttendance([{day:"2026-10-01",day_part:null,choice:"yes"}],locale);
   assert.ok(summary.includes(copy.morning)); assert.ok(summary.includes(copy.afternoon));
   assert.equal(formatManagedAttendance([],locale),copy.unknown);
   assert.ok(Object.values(copy).every(value=>value.trim().length>0));
 }
});
test("auth lookup and account linking explicitly exclude legacy delegated contacts", () => {
 const source=readFileSync(new URL("../lib/registrations/public-flow.ts",import.meta.url),"utf8");
 const linking=source.split("export async function linkParticipantsToUserByEmail")[1]!.split("async function getCurrentPublicEvent")[0]!;
 assert.match(linking,/\.eq\("is_delegate_contact", false\)/);
 assert.match(linking,/\.is\("auth_user_id", null\)/);
 const creation=readFileSync(new URL("../app/actions.ts",import.meta.url),"utf8").split("export async function createGroupLeaderManualRegistration")[1]!.split("export async function updateGroupRegistrationLink")[0]!;
 assert.doesNotMatch(creation,/generateLink|ensureAuthUser|sendEmail/);
});
