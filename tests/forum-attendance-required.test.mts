import test from 'node:test';
import assert from 'node:assert/strict';
import { groupBookingError } from '../lib/panels/group-bookings.ts';
import { FORUM_ATTENDANCE_COPY } from '../lib/panels/attendance-copy.ts';
test('attendance refusal reaches group UI as a dedicated actionable message in every language',()=>{
 assert.deepEqual(groupBookingError({code:'PFA01',message:'forum attendance required'}),{error:'attendance'});
 for(const locale of ['it','en','fr','de','es','nl','uk'] as const){
  assert.ok(FORUM_ATTENDANCE_COPY[locale].error.length>60);
  assert.ok(FORUM_ATTENDANCE_COPY[locale].leaderError.length>60);
  assert.ok(FORUM_ATTENDANCE_COPY[locale].edit.length>5);
 }
});
