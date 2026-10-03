import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { resolveRoleParticipant } from "../lib/operational-users/role-participant.ts";

function fixture({ registered = true, linked = true, account = true, raced = false } = {}) {
  const writes: Array<{path:string;body:unknown}> = [];
  const db = createClient("https://example.test", "synthetic-key", { global: { fetch: async(input, init) => {
    const url = new URL(String(input));
    const path = url.pathname;
    if (init?.method && init.method !== "GET") {
      writes.push({ path, body: JSON.parse(String(init.body)) });
      if(path === "/auth/v1/admin/users") return Response.json({ id: "new-account", email: "person@example.test" });
      return new Response(null,{status:204});
    }
    if(path.endsWith("/registrations")) {
      assert.equal(url.searchParams.get("event_id"),"eq.event");
      assert.equal(url.searchParams.get("deleted_at"),"is.null");
      return Response.json(registered ? { id:"registration",participants:{id:"participant",auth_user_id:linked?"account":null,first_name:"Participant",last_name:"Name",participant_contacts:[{email:"person@example.test",is_primary:true}]} } : null);
    }
    if(path === "/auth/v1/admin/users") return Response.json({users:account?[{id:"account",email:"person@example.test"}]:[]});
    if(path.endsWith("/participants")) return Response.json({auth_user_id:raced?"concurrent-account":account?"account":"new-account"});
    if(path.endsWith("/profiles")) return Response.json({id:account?"account":"new-account",email:"person@example.test",full_name:"Original account name"});
    throw Error(path);
  } } });
  return {db,writes};
}
test("resolves scoped linked participant without rewriting identity",async()=>{
 const f=fixture();assert.equal((await resolveRoleParticipant(f.db,"participant","event"))?.full_name,"Original account name");assert.deepEqual(f.writes,[]);
});
test("unregistered or out-of-scope target cannot create an account",async()=>{
 const f=fixture({registered:false});assert.equal(await resolveRoleParticipant(f.db,"participant","event"),null);assert.deepEqual(f.writes,[]);
});
test("existing email links the participant without renaming the account",async()=>{
 const f=fixture({linked:false});assert.equal((await resolveRoleParticipant(f.db,"participant","event"))?.id,"account");
 assert.deepEqual(f.writes,[{path:"/rest/v1/participants",body:{auth_user_id:"account"}}]);
});
test("assisted participant without account creates one and concurrent relinking is rejected",async()=>{
 const f=fixture({linked:false,account:false});assert.equal((await resolveRoleParticipant(f.db,"participant","event"))?.id,"new-account");
 assert.deepEqual(f.writes.map(w=>w.path),["/auth/v1/admin/users","/rest/v1/profiles","/rest/v1/participants"]);
 const race=fixture({linked:false,raced:true});assert.equal(await resolveRoleParticipant(race.db,"participant","event"),null);
});
