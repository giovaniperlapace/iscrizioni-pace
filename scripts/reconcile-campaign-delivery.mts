// Provider reads + reporting evidence only. Never sends, reactivates or schedules mail.
// node --env-file=.env.local --env-file=.env.postmark.local scripts/reconcile-campaign-delivery.mts --apply [--campaign=UUID]
import {createClient} from '@supabase/supabase-js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {getEmailConfig} from '../lib/email/config.ts';
import {messageHash,normalizePostmarkEvent} from '../lib/email/campaign-report.ts';
import {eventsFromDetails,postmarkRead} from '../lib/email/postmark-reporting.ts';
const apply=process.argv.includes('--apply');const campaign=process.argv.find(a=>a.startsWith('--campaign='))?.slice(11);
const config=getEmailConfig();if(config.deliveryMode!=='postmark')throw Error('Postmark required');
const s=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
const rows: {id:string;campaign_id:string;provider_message_id:string;delivery_email_snapshot:string|null}[]=[];
for(let from=0;;from+=500){let q=s.from('email_campaign_recipients').select('id,campaign_id,provider_message_id,delivery_email_snapshot').not('provider_message_id','is',null).order('id').range(from,from+499);if(campaign)q=q.eq('campaign_id',campaign);const r=await q;if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<500)break;}
const wanted=new Map(rows.map(r=>[r.provider_message_id,r]));
const cacheDir='output/campaign-delivery-reconciliation';mkdirSync(cacheDir,{recursive:true});const cachePath=cacheDir+'/evidence.json';
type Evidence={hash:string;email:string;events:ReturnType<typeof eventsFromDetails>};
let cache:Record<string,Evidence>={};try{cache=JSON.parse(readFileSync(cachePath,'utf8'));}catch{}
const found=new Map<string,{MessageID:string;Recipients:string[]}>();
let offset=0;for(;;offset+=500){const d=await postmarkRead(`/messages/outbound?messagestream=${encodeURIComponent(config.broadcastStream)}&count=500&offset=${offset}`);
 if(!Array.isArray(d.Messages))throw Error('Invalid listing');for(const m of d.Messages){const hash=messageHash(m.MessageID);if(wanted.has(hash))found.set(hash,m);}
 if(offset+d.Messages.length>=d.TotalCount)break;if(offset>=9500)throw Error('Provider result limit reached: narrow the reconciliation window');}
let saved=0,unavailable=0;
const entries=[...found];let index=0;
await Promise.all(Array.from({length:4},async()=>{while(index<entries.length){const [hash,message]=entries[index++];let evidence=cache[hash];
 if(!evidence?.events.length){try{const d=await postmarkRead(`/messages/outbound/${message.MessageID}/details`);const events=eventsFromDetails(d);evidence={hash,email:message.Recipients[0],events};if(message.Recipients.length!==1)throw Error('Multiple recipients');cache[hash]=evidence;writeFileSync(cachePath,JSON.stringify(cache));}catch{unavailable++;continue;}}
 if(apply){const row=wanted.get(hash)!;
  // An address is historical only when read from the provider and matched to the stored message hash.
  const r=await s.from('email_campaign_recipients').update({delivery_email_snapshot:evidence.email}).eq('id',row.id).eq('provider_message_id',hash).is('delivery_email_snapshot',null);if(r.error)throw r.error;
  for(const event of evidence.events){const result=await s.rpc('record_campaign_delivery_event',{p_event:event});if(result.error)throw result.error;}
 }
 saved++;if(saved%50===0)console.log('Evidence processed:',saved);
}}));
const suppressions=await postmarkRead(`/message-streams/${encodeURIComponent(config.broadcastStream)}/suppressions/dump`);
if(!Array.isArray(suppressions.Suppressions))throw Error('Invalid suppression response');
if(apply)for(const r of suppressions.Suppressions){const e=normalizePostmarkEvent({RecordType:'SubscriptionChange',MessageStream:config.broadcastStream,Recipient:r.EmailAddress,ChangedAt:r.CreatedAt,SuppressionReason:r.SuppressionReason,Origin:r.Origin,SuppressSending:true},config.broadcastStream);const result=await s.rpc('record_campaign_delivery_event',{p_event:e});if(result.error)throw result.error;}
console.log(JSON.stringify({apply,storedMessages:rows.length,providerMatches:found.size,evidenceProcessed:saved,unavailable,notInProviderWindow:rows.length-found.size,suppressions:suppressions.Suppressions.length}));
