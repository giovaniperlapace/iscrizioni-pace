import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizePostmarkEvent,reportOutcome,emailHash,messageHash,csvCell} from '../lib/email/campaign-report.ts';
import {eventsFromDetails} from '../lib/email/postmark-reporting.ts';
process.env.EMAIL_DELIVERY_MODE='log';
const id='6b8406cd-a001-4d54-a776-67c9ab9652dd';
const base={MessageStream:'broadcast',MessageID:id,Recipient:'EXAMPLE@example.org',DeliveredAt:'2026-10-19T08:40:00Z'};
test('webhook accepts only target stream, known kinds and complete identities',()=>{
 const e=normalizePostmarkEvent({...base,RecordType:'Delivery'},'broadcast');assert.equal(e.email_hash,emailHash('example@example.org'));assert.equal(e.message_hash,messageHash(id));
 for(const patch of [{MessageStream:'outbound'},{RecordType:'Click'},{Recipient:'a@a.it,b@b.it'},{DeliveredAt:'bad'},{MessageID:'bad'}])assert.throws(()=>normalizePostmarkEvent({...base,RecordType:'Delivery',...patch},'broadcast'));
 assert.throws(()=>normalizePostmarkEvent({...base,RecordType:'SubscriptionChange',ChangedAt:base.DeliveredAt},'broadcast'));
});
test('normalization strips bodies, headers and arbitrary metadata; event identity stable',()=>{
 const one=normalizePostmarkEvent({...base,RecordType:'Delivery',HtmlBody:'secret',Metadata:{campaign_recipient_id:id,secret:'secret'}},'broadcast');
 const two=normalizePostmarkEvent({...base,RecordType:'Delivery',DeliveredAt:'2026-10-19T10:40:00+02:00'},'broadcast');
 assert.equal(one.event_key,two.event_key);assert.equal(one.recipient_id,id);assert.ok(!JSON.stringify(one).includes('secret'));
});
test('delivery evidence overrides acceptance/unknown; exclusions and suppression distinct',()=>{
 const event={message_hash:'x',kind:'Delivery',occurred_at:'2026-10-19',detail:'',retryable:false};
 assert.equal(reportOutcome({status:'sent'},[]).code,'accepted');assert.equal(reportOutcome({status:'unknown'},[event]).code,'delivered');
 assert.equal(reportOutcome({status:'skipped'},[]).code,'excluded');assert.equal(reportOutcome({status:'failed',error_code:'postmark_406'},[]).code,'blocked');
 assert.equal(reportOutcome({status:'sent'},[event,{...event,kind:'Bounce'}]).code,'bounced');
});
test('only definitive transient bounce or exact queue expiry can be recoverable',()=>{
 for(const [Type,Inactive,expected] of [['Transient',false,true],['SoftBounce',false,true],['HardBounce',false,false],['Transient',true,false],['Transient',undefined,false]] as const){
  assert.equal(normalizePostmarkEvent({...base,RecordType:'Bounce',Type,Inactive},'broadcast').retryable,expected);
 }
 const d={MessageID:id,MessageStream:'broadcast',MessageEvents:[{Type:'Bounced',Recipient:'a@example.org',ReceivedAt:base.DeliveredAt,Details:{Summary:'smtp;550 4.4.7 QUEUE.Expired; message expired'}}]};
 assert.equal(eventsFromDetails(d)[0].retryable,true);
 d.MessageEvents[0].Details.Summary='mailbox does not exist';assert.equal(eventsFromDetails(d)[0].retryable,false);
});
test('CSV escapes multiline quotes and spreadsheet formulas',()=>{
 assert.equal(csvCell('a"b\nc'),'"a""b\nc"');assert.equal(csvCell('=WEBSERVICE("bad")'),'"\'=WEBSERVICE(""bad"")"');assert.equal(csvCell(' @SUM(A1)'),'"\' @SUM(A1)"');
});
test('Postmark-compatible recipient metadata resolves the same recipient as the historical key',()=>{
 const modern=normalizePostmarkEvent({...base,RecordType:'Delivery',Metadata:{recipient_id:id}},'broadcast');
 const legacy=normalizePostmarkEvent({...base,RecordType:'Delivery',Metadata:{campaign_recipient_id:id}},'broadcast');
 assert.equal(modern.recipient_id,id);assert.deepEqual(modern,legacy);
 assert.equal(normalizePostmarkEvent({...base,RecordType:'Delivery',Metadata:{recipient_id:'invalid'}},'broadcast').recipient_id,null);
});
