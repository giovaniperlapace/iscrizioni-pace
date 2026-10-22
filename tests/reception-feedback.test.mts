import test from 'node:test';
import assert from 'node:assert/strict';
import { receptionFeedbackTone } from '../lib/reception/feedback.ts';
import { parseReceptionCommand } from '../lib/reception/contracts.ts';

test('reception feedback distinguishes routing, absent reservations, tickets and general reception', () => {
  assert.equal(receptionFeedbackTone({problem:'not_booked',wrongForum:true}),'yellow');
  assert.equal(receptionFeedbackTone({problem:'not_booked',wrongForum:false}),'orange');
  assert.equal(receptionFeedbackTone({missingTicket:true}),'orange');
  assert.equal(receptionFeedbackTone({missingEventEntry:true}),'yellow');
  assert.equal(receptionFeedbackTone({problem:'event_entry_required'}),'yellow');
  assert.equal(receptionFeedbackTone({problem:'invalid'}),'red');
  assert.equal(receptionFeedbackTone({}),'green');
});
test('missing general reception override is restricted to explicit Forum entry', () => {
  const command={duty:'panel_entry',panelId:'11111111-1111-4111-8111-111111111111',lookup:{kind:'code',value:'TEST'},action:'enter',requestId:'22222222-2222-4222-8222-222222222222',reason:'event_entry_override'};
  assert.ok(parseReceptionCommand(command));
  for(const action of ['inspect','correct','cancel']) assert.equal(parseReceptionCommand({...command,action,expectedRevision:0}),null);
  assert.equal(parseReceptionCommand({...command,duty:'event_entry',panelId:undefined}),null);
  assert.equal(parseReceptionCommand({...command,duty:'ceremony_entry',panelId:'opening'}),null);
});
