import assert from "node:assert/strict";
import test from "node:test";
import { isDutyAvailable, nextDutyWindow, nextDutyBoundary, formatDutyWindowTime } from "../lib/reception/duty-windows.ts";
import type { DutyOption } from "../lib/reception/event-duties.ts";
const duty=(key:string,from:string,until:string):DutyOption=>({key,title:key,room:null,kind:"panel",availableFrom:from,availableUntil:until});
const morning=duty("morning","2026-10-26T07:30:00+01:00","2026-10-26T13:30:00+01:00");
const laterMorning={...morning,key:"starts-at-ten"};
const afternoon=duty("afternoon","2026-10-26T13:30:00+01:00","2026-10-26T20:30:00+01:00");
const t=(value:string)=>Date.parse(value);
test("all morning duties open together at 07:30, even a later Forum",()=>{
 for(const item of [morning,laterMorning]) {
  assert.equal(isDutyAvailable(item,t("2026-10-26T07:29:59+01:00")),false);
  assert.equal(isDutyAvailable(item,t("2026-10-26T07:30:00+01:00")),true);
 }
});
test("13:30 is an exact handover with no overlap or gap",()=>{
 const all=[morning,laterMorning,afternoon];
 assert.deepEqual(all.filter(x=>isDutyAvailable(x,t("2026-10-26T13:29:59+01:00"))).map(x=>x.key),["morning","starts-at-ten"]);
 assert.deepEqual(all.filter(x=>isDutyAvailable(x,t("2026-10-26T13:30:00+01:00"))).map(x=>x.key),["afternoon"]);
 assert.equal(isDutyAvailable(afternoon,t("2026-10-26T20:30:00+01:00")),false);
});
test("ceremonies are scoped to their day, including the Rome DST transition",()=>{
 const opening=duty("opening","2026-10-25T13:30:00+01:00","2026-10-25T20:30:00+01:00");
 const closing=duty("closing","2026-10-27T13:30:00+01:00","2026-10-28T00:00:00+01:00");
 assert.equal(isDutyAvailable(opening,t("2026-10-25T12:29:59Z")),false);
 assert.equal(isDutyAvailable(opening,t("2026-10-25T12:30:00Z")),true);
 assert.equal(isDutyAvailable(closing,t("2026-10-26T13:30:00+01:00")),false);
 assert.equal(isDutyAvailable(closing,t("2026-10-27T13:30:00+01:00")),true);
 assert.match(formatDutyWindowTime(t("2026-10-25T12:30:00Z")),/13:30/);
});
test("missing or invalid windows never reveal all assignments",()=>{
 for(const item of [{...morning,availableFrom:null},{...morning,availableUntil:undefined},duty("bad","x","y"),duty("reverse",morning.availableUntil!,morning.availableFrom!)]) {
  assert.equal(isDutyAvailable(item,t("2026-10-26T09:00:00+01:00")),false);
  assert.equal(nextDutyWindow([item],0),null);
 }
});
test("next opening and timer boundary advance through days and close cleanly",()=>{
 const now=t("2026-10-26T07:00:00+01:00");
 assert.equal(nextDutyWindow([afternoon,morning],now)?.duty.key,"morning");
 assert.equal(nextDutyBoundary([morning,afternoon],now),t(morning.availableFrom!));
 assert.equal(nextDutyBoundary([morning,afternoon],t(morning.availableFrom!)),t(afternoon.availableFrom!));
 assert.equal(nextDutyBoundary([morning,afternoon],t(afternoon.availableUntil!)),null);
 assert.equal(nextDutyWindow([],now),null);
});
