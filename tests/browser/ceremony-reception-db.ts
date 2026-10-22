// Disposable PostgreSQL adapter: exercises original service reads without any
// application credentials or network database. Never imported by app routes.
import type { SupabaseClient } from '@supabase/supabase-js';
export function ceremonyReceptionDb(query: (sql:string)=>unknown, actor:string) {
 const literal=(v:unknown)=>v===null?'null':"'"+String(v).replaceAll("'","''")+"'";
 const identifier=(s:string)=>{if(!/^[a-z_]+$/.test(s))throw Error('identifier');return s;};
 return {
  auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},
  from(table:string){let columns='*',single=false,offset=0,limit=1000,order='';const filters:string[]=[];
   const q={select(s:string){columns=s.split(',').map(identifier).join(',');return q;},eq(k:string,v:unknown){filters.push(identifier(k)+'='+literal(v));return q;},is(k:string,v:unknown){if(v!==null)throw Error('null only');filters.push(identifier(k)+' is null');return q;},in(k:string,v:unknown[]){filters.push(identifier(k)+' in ('+v.map(literal).join(',')+')');return q;},order(k:string){order=identifier(k);return q;},range(a:number,b:number){offset=a;limit=b-a+1;return q;},maybeSingle(){single=true;return q;},then(resolve:(v:unknown)=>unknown){try{const data=query(`set role service_role;select coalesce(jsonb_agg(row_to_json(t)),'[]') from (select ${columns} from ${identifier(table)} ${filters.length?'where '+filters.join(' and '):''} ${order?'order by '+order:''} limit ${limit} offset ${offset}) t;`) as unknown[];return Promise.resolve({data:single?data[0]??null:data,error:null}).then(resolve);}catch{return Promise.resolve({data:null,error:{message:'fixture SQL error'}}).then(resolve);}}};return q;
  },
  rpc:async(name:string,args:Record<string,unknown>)=>{
   if(name!=='reception_group_check_in')throw Error('only group lookup');
   const params=Object.entries(args).map(([k,v])=>identifier(k)+'=>'+(Array.isArray(v)?'array['+v.map(literal).join(',')+']::uuid[]':literal(v))).join(',');
   return {data:query(`set role service_role;select ${name}(${params});`),error:null};
  },
 } as unknown as SupabaseClient;
}
