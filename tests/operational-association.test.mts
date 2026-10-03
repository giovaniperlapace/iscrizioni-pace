import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { loadAssociations } from "../lib/registrations/association.server.ts";
import { parseTablePreferences } from "../lib/registrations/operations-table.ts";
import { leaderPreferences } from "../lib/groups/leader-table.ts";

test("association loader keeps latest empty declaration and uses only authorized IDs", async () => {
 const db=createClient("https://example.test","test",{global:{fetch:async input=>{
  const url=new URL(String(input));assert.equal(url.searchParams.get("registration_id"),"in.(r1,r2)");
  assert.equal(url.searchParams.get("order"),"created_at.desc,id.desc");assert.ok(!url.searchParams.get("select")?.includes("answers,"));
  return Response.json([{registration_id:"r1",association:null},{registration_id:"r2",association:" Associazione A "},{registration_id:"r1",association:"Old"}]);
 }}});
 assert.deepEqual([...await loadAssociations(db,["r1","r2"])],[["r1",null],["r2","Associazione A"]]);
 assert.ok(parseTablePreferences({columns:["name","association"]}).columns.includes("association"));
 assert.ok(!leaderPreferences(new URLSearchParams("columns=name,association&sort=association")).columns.includes("association"));
});

test("association action uses session actor, restricts roles and preserves errors without refresh",async()=>{
 const source=readFileSync("app/dashboard/operational-registration-actions.ts","utf8");
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/import[\s\S]*?from ["'][^"']+["'];/g,"").replace(/export /g,"");
 for(const role of ["admin","manager","manager_viewer","capogruppo",null])for(const conflict of [false,true]){
  const calls:Record<string,unknown>[]=[];const paths:string[]=[];
  const deps={formFailure:(issues:unknown)=>({status:"error",issues}),revalidatePath:(p:string)=>paths.push(p),getCurrentAuthContext:async()=>role?{user:{id:"actor"},eventRoles:[{role,eventId:"event"}]}:null,createSupabaseServerClient:async()=>({}),createSupabaseServiceClient:()=>({rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,...args});return {data:{association:"Nuova",questionnaireId:"q"},error:conflict?{code:"PT409"}:null};}})};
  const run=new Function(...Object.keys(deps),`${code};return updateOperationalAssociation;`)(...Object.values(deps));
  const form=new FormData();form.set("registrationId","11111111-1111-4111-8111-111111111111");form.set("actorUserId","forged");form.set("expected",'{"association":"Vecchia","questionnaireId":"q"}');form.set("association"," Nuova ");
  const result=await run(form);const authorized=role==="admin"||role==="manager";
  assert.equal(result.status,authorized&&!conflict?"success":"error");assert.equal(paths.length,authorized&&!conflict?4:0);
  if(authorized){assert.equal(calls[0].p_actor_user_id,"actor");assert.equal(calls[0].p_value,"Nuova");assert.deepEqual(calls[0].p_expected,{association:"Vecchia",questionnaireId:"q"});}else assert.equal(calls.length,0);
  form.set("association","x".repeat(201));assert.equal((await run(form)).status,"error");
 }
});

test("association export loads only the selected field for the authorized selection", async () => {
 const {writeVisibleParticipantsWorkbook}=await import("../lib/data-quality/workbook.ts");
 const ExcelJS=(await import("exceljs")).default;
 const {NextResponse}=await import("next/server.js");
 const source=readFileSync("app/dashboard/participants/data-quality/api/route.ts","utf8").split("// Enforce an actual body budget")[0];
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/import[\s\S]*?from ["'][^"']+["'];/g,"").replace(/export /g,"");
 for(const canWrite of [true,false]) for(const selected of [true,false]) {
  let reads=0;
  const deps={qualityAccess:async()=>({db:{},auth:{user:{id:"actor"}},event:{id:"event"},isAdmin:false,canWrite}),loadCatalog:async()=>({services:[],tags:[],groups:[]}),filteredExportPeople:async()=>({people:[{id:"authorized-registration",name:"Anna",children:[]}]}),parseTablePreferences,writeVisibleParticipantsWorkbook,loadAssociations:async(_db:unknown,ids:string[])=>{assert.deepEqual(ids,["authorized-registration"]);reads++;return new Map([[ids[0],"Comunità di Sant’Egidio"]]);},createSupabaseServiceClient:()=>({from:()=>({insert:async()=>({error:null})})}),NextResponse};
  const handler=new Function(...Object.keys(deps),`${code};return GET;`)(...Object.values(deps));
  const response=await handler({nextUrl:new URL(`http://localhost/?kind=export&columns=${selected?"name,association":"name"}`)});
  assert.equal(response.status,200);assert.equal(reads,selected?1:0);
  const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
  assert.equal(JSON.stringify(book.worksheets[0].getRow(1).values).includes("Associazione / organizzazione"),selected);
  assert.equal(JSON.stringify(book.worksheets[0].getRow(2).values).includes("Comunità di Sant’Egidio"),selected);
 }
});
