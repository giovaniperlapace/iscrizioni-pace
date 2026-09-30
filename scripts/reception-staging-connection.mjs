import fs from 'node:fs';
import {parseEnv} from 'node:util';
import {execFileSync} from 'node:child_process';
export const env=parseEnv(fs.readFileSync('.env.staging.local','utf8'));
if(env.DEPLOYMENT_ENVIRONMENT!=='staging'||env.EMAIL_DELIVERY_MODE!=='log'||env.SUPABASE_DB_CONTAINER!=='supabase-db-jiio6ou5wzmma2xwas53cf1d') throw Error('Wrong environment');
export function sql(query){return execFileSync('ssh',['-i',env.SERVER_SSH_KEY,'-o','BatchMode=yes','-o','IdentitiesOnly=yes','-p',env.SERVER_SSH_PORT,`${env.SERVER_SSH_USER}@${env.SERVER_SSH_HOST}`,`docker exec -i ${env.SUPABASE_DB_CONTAINER} psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1`],{input:query,encoding:'utf8'}).trim();}
export async function api(path,body){try { const url=new URL(env.SUPABASE_URL);const out=execFileSync('curl',['--silent','--show-error','--connect-timeout','10','--max-time','30','--fail-with-body','--resolve',`${url.hostname}:443:${env.SERVER_SSH_HOST}`,'-X',body?'POST':'GET',`${url.origin}/auth/v1/${path}`,'-H',`apikey: ${env.SUPABASE_SERVICE_ROLE_KEY}`,'-H',`Authorization: Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'-H','Content-Type: application/json',...(body?['--data-binary','@-']:[])],{input:body?JSON.stringify(body):undefined,encoding:'utf8'});return JSON.parse(out); } catch { throw new Error('Staging Auth request failed; credentials omitted.'); }}
