import assert from 'node:assert/strict';
import test from 'node:test';
import { forumRemindersEnabled } from '../lib/panels/reminder-status.ts';
function db(enabled: boolean, code?: string) {
 const query={select(){return query;},eq(key:string,value:unknown){assert.equal(key,'enabled');assert.equal(value,true);return query;},limit:async()=>({data:enabled?[{event_id:'event'}]:[],error:code?{code}:null})};
 return {from(name:string){assert.equal(name,'forum_reminder_settings');return query;}} as unknown as Parameters<typeof forumRemindersEnabled>[0];
}
test('prepared reminders stay dormant before database installation and explicit activation', async()=>{
 for(const code of ['PGRST205','42P01'])assert.equal(await forumRemindersEnabled(db(false,code)),false);
 assert.equal(await forumRemindersEnabled(db(false)),false);
 assert.equal(await forumRemindersEnabled(db(true)),true);
});
test('operational database failures remain errors rather than hiding an active reminder queue',async()=>{
 for(const code of ['42501','PGRST000'])await assert.rejects(forumRemindersEnabled(db(false,code)),/settings_unavailable/);
});
