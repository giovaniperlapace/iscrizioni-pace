import assert from "node:assert/strict";
import test from "node:test";
import { isDutyAvailable, nextDutyBoundary } from "../lib/reception/duty-windows.ts";
import type { DutyOption } from "../lib/reception/event-duties.ts";
const morning: DutyOption = {key:"morning",title:"Forum mattina",room:null,kind:"panel",availableFrom:"2026-10-25T18:25:00+01:00",availableUntil:"2026-10-26T13:30:00+01:00"};
const opening: DutyOption = {key:"opening",title:"Apertura",room:null,kind:"ceremony",availableFrom:"2026-10-25T13:30:00+01:00",availableUntil:"2026-10-25T20:30:00+01:00"};
test("early morning duties coexist with opening, survive midnight and end at the original boundary",()=>{
 const at=(time:string)=>Date.parse(time);
 assert.equal(isDutyAvailable(morning,at("2026-10-25T18:24:59+01:00")),false);
 for(const time of ["2026-10-25T18:25:00+01:00","2026-10-25T20:29:59+01:00"]){
  assert.equal(isDutyAvailable(morning,at(time)),true);
  assert.equal(isDutyAvailable(opening,at(time)),true);
 }
 assert.equal(nextDutyBoundary([morning,opening],at("2026-10-25T18:25:00+01:00")),at(opening.availableUntil!));
 assert.equal(isDutyAvailable(opening,at("2026-10-25T20:30:00+01:00")),false);
 for(const time of ["2026-10-26T00:00:00+01:00","2026-10-26T07:30:00+01:00","2026-10-26T13:29:59+01:00"])
  assert.equal(isDutyAvailable(morning,at(time)),true);
 assert.equal(isDutyAvailable(morning,at("2026-10-26T13:30:00+01:00")),false);
 assert.equal(nextDutyBoundary([morning,opening],at("2026-10-26T13:30:00+01:00")),null);
});
