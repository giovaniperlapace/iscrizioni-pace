import assert from "node:assert/strict";
import test from "node:test";
import { parseDemographics, DEMOGRAPHICS_COPY } from "../lib/registrations/assisted-demographics.ts";
import { loadInternalSexes, loadNationalities } from "../lib/registrations/assisted-demographics.server.ts";
import { parseManualRegistrationForm, buildManualRegistrationQuestionnaireAnswers } from "../lib/registrations/manual-registration.ts";
import { parseTablePreferences } from "../lib/registrations/operations-table.ts";

function manual() {
 const form = new FormData();
 for (const [key,value] of Object.entries({groupId:"11111111-1111-4111-8111-111111111111",firstName:"Anna",lastName:"Rossi",birthDate:"1990-01-01",cityOther:"Roma",useLeaderEmail:"on",availabilityUnknown:"on",consentConfirmed:"on"})) form.set(key,value);
 return form;
}
test("assisted fields are optional, explicit, validated and sex never enters questionnaire", () => {
 const form=manual();
 assert.equal(parseManualRegistrationForm(form).ok,true);
 form.set("nationality"," Italian ");form.set("birthPlace","France");form.set("country","Germany");form.set("internalSex","female");
 const parsed=parseManualRegistrationForm(form); assert.ok(parsed.ok);
 assert.equal(parsed.value.nationality,"Italian");assert.equal(parsed.value.internalSex,"female");
 for (const role of ["manager","capogruppo","admin"] as const) {
 const answers=buildManualRegistrationQuestionnaireAnswers(parsed.value,{id:"group",name:"Group"},"actor",role);
 assert.equal(answers.nationality,"Italian");assert.equal(answers.birthPlace,"France");assert.equal(answers.residence.countryOther,"Germany");
 assert.doesNotMatch(JSON.stringify(answers), /internalSex|female|"sex"/);
 }
 form.set("internalSex","other");assert.equal(parseManualRegistrationForm(form).ok,false);
 form.set("internalSex","");form.set("nationality","x".repeat(201));assert.equal(parseManualRegistrationForm(form).ok,false);
});
test("demographics preserve absent/blank values without inferring citizenship or birthplace", () => {
 assert.deepEqual(parseDemographics(new FormData()),{nationality:null,birthPlace:null,country:null});
 for (const copy of Object.values(DEMOGRAPHICS_COPY)) assert.ok(copy.sex && copy.nationality && copy.internal && copy.country);
 assert.deepEqual(parseTablePreferences({columns:["nationality","sex"]}).columns,["name","nationality","sex"]);
});
test("internal reads batch and deduplicate IDs, fail closed on a later batch",async () => {
 const calls: string[][]=[];
 const db={rpc:async(name:string,args:{p_registration_ids:string[],p_actor_user_id:string})=>{
 assert.equal(name,"get_operational_registration_sexes");assert.equal(args.p_actor_user_id,"session");calls.push(args.p_registration_ids);
 return {data:args.p_registration_ids.map(registration_id=>({registration_id,sex:"male"})),error:null};
 }};
 const ids=Array.from({length:405},(_,i)=>String(i));
 const values=await loadInternalSexes(db as never,[...ids,ids[0]],"session");
 assert.equal(Object.keys(values).length,405);assert.deepEqual(calls.map(c=>c.length),[200,200,5]);
 let n=0;
 await assert.rejects(()=>loadInternalSexes({rpc:async()=>++n===1?{data:[],error:null}:{error:{code:"42501"}}} as never,ids,"session"));
});
test("nationality reads only the projected answer and latest snapshot, including explicit null",async () => {
 const selections:string[]=[];
 const db={from:(table:string)=>{assert.equal(table,"registration_questionnaire_answers");return {
 select(value:string){selections.push(value);return this;},in(){return this;},order(){return this;},range(){return Promise.resolve({data:[{registration_id:"r",nationality:null},{registration_id:"r",nationality:"old"},{registration_id:"s",nationality:"French"}],error:null});}
 };}};
 const values=await loadNationalities(db as never,["r","s"]);
 assert.equal(values.get("r"),null);assert.equal(values.get("s"),"French");assert.ok(selections.every(value=>!value.includes("sex") && value.includes("answers->>nationality")));
});

test("internal values are absent from ordinary public/personal projections", async () => {
 const {readFileSync}=await import("node:fs");
 for(const path of ["app/dashboard/partecipante/page.tsx","lib/questionnaire/registration.ts","lib/registrations/participant-dashboard.ts","lib/registrations/event-statistics.server.ts","lib/groups/leader-data.server.ts","app/dashboard/manager/page.tsx","app/dashboard/admin/page.tsx"]){
  assert.doesNotMatch(readFileSync(path,"utf8"),/registration_internal_demographics|get_operational_registration_sexes|loadInternalSexes/,path);
 }
});

test("demographic actions use session actor, pass expected snapshot and do not revalidate on failure",async()=>{
 const {readFileSync}=await import("node:fs");const ts=(await import("typescript")).default;
 const source=readFileSync("app/dashboard/operational-registration-actions.ts","utf8");
 const ast=ts.createSourceFile("actions.ts",source,ts.ScriptTarget.Latest,true);
 const body=ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(ast).replace(/^export /,"")).join("\n");
 const code=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 for(const scenario of ["ok","anonymous","forbidden","conflict","network"]){
  const calls:Record<string,unknown>[]=[];const paths:string[]=[];
  const deps={parseDemographics,loadInternalSexes,formFailure:(issues:unknown)=>({status:"error",issues}),revalidatePath:(path:string)=>paths.push(path),getCurrentAuthContext:async()=>scenario==="anonymous"?null:{user:{id:"session-actor"}},createSupabaseServerClient:async()=>({}),createSupabaseServiceClient:()=>({rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,...args});if(scenario==="network")throw Error("offline");return {data:{nationality:"Italian"},error:scenario==="forbidden"?{code:"42501"}:scenario==="conflict"?{code:"PT409"}:null};}})};
  const actions=new Function(...Object.keys(deps),`${code};return {getOperationalDemographics,updateOperationalDemographics,getVisibleInternalSexes};`)(...Object.values(deps));
  const form=new FormData();form.set("registrationId","11111111-1111-4111-8111-111111111111");form.set("expected",'{"nationality":null}');form.set("nationality","Italian");form.set("actorUserId","forged");
  const result=await actions.updateOperationalDemographics(form);
  assert.equal(result.status,scenario==="ok"?"success":"error");assert.equal(paths.length,scenario==="ok"?4:0);
  if(scenario==="anonymous")assert.equal(calls.length,0);else {assert.equal(calls[0].p_actor_user_id,"session-actor");assert.deepEqual(calls[0].p_expected,{nationality:null});}
  const before=calls.length;await actions.getVisibleInternalSexes(["invalid"]);assert.equal(calls.length,before);
 }
});

test("table exports include nationality and internal sex only when selected, and reject Viewer sex requests",async()=>{
 const {readFileSync}=await import("node:fs");const ts=(await import("typescript")).default;
 const {writeVisibleParticipantsWorkbook}=await import("../lib/data-quality/workbook.ts");
 const ExcelJS=(await import("exceljs")).default;
 const {NextResponse}=await import("next/server.js");
 const source=readFileSync("app/dashboard/participants/data-quality/api/route.ts","utf8").split("// Enforce an actual body budget")[0];
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/import[\s\S]*?from ["'][^"']+["'];/g,"").replace(/export /g,"");
 for(const canWrite of [true,false])for(const selected of [true,false]){
  let sexReads=0;
  const deps={qualityAccess:async()=>({db:{},auth:{user:{id:"actor"}},event:{id:"event"},isAdmin:false,canWrite}),loadCatalog:async()=>({services:[],tags:[],groups:[]}),filteredExportPeople:async()=>({people:[{id:"r",name:"Anna",children:[]}]}),parseTablePreferences,writeVisibleParticipantsWorkbook,loadNationalities:async()=>new Map([["r","Italian"]]),loadInternalSexes:async()=>{sexReads++;return {r:"female"};},createSupabaseServiceClient:()=>({from:()=>({insert:async()=>({error:null})})}),NextResponse};
  const handler=new Function(...Object.keys(deps),`${code}; return GET;`)(...Object.values(deps));
  const response=await handler({nextUrl:new URL(`http://localhost/?kind=export&columns=${selected?"name,nationality,sex":"name"}`)});
  assert.equal(sexReads,selected&&canWrite?1:0);
  if(selected&&!canWrite){assert.ok(response.status>=400);continue;}
  assert.equal(response.status,200);
  const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
  const header=JSON.stringify(book.worksheets[0].getRow(1).values),row=JSON.stringify(book.worksheets[0].getRow(2).values);
  assert.equal(header.includes("Sesso"),selected);assert.equal(row.includes("Femmina"),selected);assert.equal(row.includes("Italia"),selected);
 }
});
