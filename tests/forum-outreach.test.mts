import test from 'node:test';
import assert from 'node:assert/strict';
import { findPeopleWithoutForum, parseForumOutreach, findPanelCampaignTargets } from '../lib/panels/forum-outreach.ts';
import { findWaitlistedWithoutBooking } from '../lib/panels/waitlist-statistics.ts';
import { isPanelCampaign } from '../lib/panels/management-access.ts';

test('no Forum counts unique nominal people and selects the adult contact for uncovered children', () => {
  const registrations = [{id:'r',registration_children:[{id:'a'},{id:'b'}]}, {id:'other',registration_children:null}];
  const booking={registrationId:'r',choice:'yes',registrationStatus:'confirmed',sectionId:'s',selectedChildIds:['a']};
  const result=findPeopleWithoutForum(registrations,[booking,booking]);
  assert.equal(result.peopleCount,2);
  assert.deepEqual([...result.registrationIds],['r','other']);
  assert.equal(findPeopleWithoutForum(registrations,[{...booking,selectedChildIds:['a','b']}]).peopleCount,1);
  for(const change of [{choice:'no'},{sectionId:null},{registrationStatus:'cancelled'}])
    assert.equal(findPeopleWithoutForum(registrations,[{...booking,...change}]).peopleCount,4);
});
test('uncovered waitlist selects adult contact only when a nominal person lacks a same-slot seat', () => {
  const panels=[{id:'p',startsAt:'2026-10-26T09:00:00Z'},{id:'q',startsAt:'2026-10-26T10:00:00Z'}];
  const queue=[{panel_id:'p',registration_id:'r',status:'waiting',expires_at:null,reserved_seats:null,registrations:{status:'submitted',deleted_at:null,registration_children:[{id:'child'}]}}];
  const selection=[{panel_id:'p',registration_id:'r',child_ids:['child']}];
  const booking={panelId:'q',registrationId:'r',choice:'yes',registrationStatus:'confirmed',sectionId:'s',selectedChildIds:[] as string[]};
  const result=findWaitlistedWithoutBooking(panels,[booking],queue,selection);
  assert.equal(result.peopleCount,1);
  assert.deepEqual([...result.registrationIds],['r']);
  assert.equal(findWaitlistedWithoutBooking(panels,[{...booking,selectedChildIds:['child']}],queue,selection).registrationIds.size,0);
});
test('both outreach modes require Forum campaign authorization and reject unknown modes', () => {
  for(const mode of ['without_forum','waiting_without_booking','panel_confirmed','panel_waiting','panel_both']) {
    assert.equal(parseForumOutreach(mode),mode);
    assert.equal(isPanelCampaign({forumOutreach:mode}),true);
  }
  assert.equal(parseForumOutreach('all'),null);
});

test('panel campaigns distinguish confirmed, queue and union with expired offers excluded', () => {
  const booking = {panelId:'p', registrationId:'booked', choice:'yes', sectionId:'s', registrationStatus:'confirmed'};
  const waiting = {panel_id:'p', registration_id:'waiting', status:'waiting', expires_at:null, registrations:{status:'confirmed',deleted_at:null}};
  const queue = [waiting, {...waiting,registration_id:'booked'}, {...waiting,registration_id:'offer',status:'offered',expires_at:'2026-10-22T11:00:00Z'}, {...waiting,registration_id:'expired',status:'offered',expires_at:'2026-10-22T09:00:00Z'}, {...waiting,registration_id:'deleted',registrations:{status:'confirmed',deleted_at:'2026-10-21'}}, {...waiting,registration_id:'other',panel_id:'q'}, {...waiting,registration_id:'cancelled',registrations:{status:'cancelled',deleted_at:null}}];
  const choices = [booking, {...booking,registrationId:'cancelled',choice:'no'}, {...booking,registrationId:'other',panelId:'q'}];
  const now = Date.parse('2026-10-22T10:00:00Z');
  assert.deepEqual([...findPanelCampaignTargets('p','panel_confirmed',choices,queue,now)], ['booked']);
  assert.deepEqual([...findPanelCampaignTargets('p','panel_waiting',choices,queue,now)], ['waiting','booked','offer']);
  assert.deepEqual([...findPanelCampaignTargets('p','panel_both',choices,queue,now)], ['booked','waiting','offer']);
});
