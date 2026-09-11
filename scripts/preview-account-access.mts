import { createClient } from "@supabase/supabase-js";
import { loadAccountAccessCandidates } from "../lib/email/account-access-candidates.ts";

// Deliberately read-only: this command cannot send mail or create accounts.
const args = process.argv.slice(2);
if (args.length > 1 || args[0]?.startsWith("--")) throw new Error("Usage: node --env-file=.env.local scripts/preview-account-access.mts [event-id]");
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase configuration");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const query = db.from("events").select("id,title");
const { data: event, error } = await (args[0] ? query.eq("id", args[0]) : query.eq("is_current", true)).single();
if (error || !event) throw new Error("Cannot identify the event");
const result = await loadAccountAccessCandidates(db, event.id);
console.log(JSON.stringify({ mode: "read-only", event: event.title, eligible: result.candidates.length, excluded: result.excluded }, null, 2));
