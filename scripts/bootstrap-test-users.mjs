#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const eventSlug = process.env.TEST_EVENT_SLUG || "assisi-2026-test";
const adminEmail = process.env.TEST_ADMIN_EMAIL;
const managerEmail = process.env.TEST_MANAGER_EMAIL;
const participantEmail = process.env.TEST_PARTICIPANT_EMAIL;

if (!supabaseUrl || !serviceRoleKey) {
  fail("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

if (!adminEmail || !managerEmail) {
  fail("Set TEST_ADMIN_EMAIL and TEST_MANAGER_EMAIL. TEST_PARTICIPANT_EMAIL is optional.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const event = await getEventBySlug(eventSlug);
const adminUser = await ensureUser(adminEmail, "Admin test");
const managerUser = await ensureUser(managerEmail, "Manager test");

await ensureProfile(adminUser.id, adminEmail, "Admin test");
await ensureProfile(managerUser.id, managerEmail, "Manager test");
await ensureRole({ userId: adminUser.id, eventId: null, role: "admin" });
await ensureRole({ userId: managerUser.id, eventId: event.id, role: "manager" });

if (participantEmail) {
  const participantUser = await ensureUser(participantEmail, "Partecipante test");
  await ensureProfile(participantUser.id, participantEmail, "Partecipante test");
}

console.log(`Bootstrap test users completed for ${event.slug}.`);
console.log(`Admin: ${adminEmail}`);
console.log(`Manager: ${managerEmail}`);
if (participantEmail) {
  console.log(`Participant: ${participantEmail}`);
}

async function getEventBySlug(slug) {
  const { data, error } = await supabase
    .from("events")
    .select("id,slug")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    fail(`Event '${slug}' not found. Apply the Milestone 5.5 migration first.`);
  }

  return data;
}

async function ensureUser(email, fullName) {
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      test_user: true,
    },
  });

  if (!error && created.user) {
    return created.user;
  }

  if (!isAlreadyRegisteredError(error)) {
    fail(error?.message || `Could not create user ${email}.`);
  }

  const existing = await findUserByEmail(email);

  if (!existing) {
    fail(`User ${email} already exists but could not be loaded.`);
  }

  return existing;
}

async function findUserByEmail(email) {
  let page = 1;

  while (page < 20) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      fail(error.message);
    }

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase()
    );

    if (user || data.users.length < 100) {
      return user ?? null;
    }

    page += 1;
  }

  return null;
}

async function ensureProfile(id, email, fullName) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id,
      email,
      full_name: fullName,
    },
    { onConflict: "id" }
  );

  if (error) {
    fail(error.message);
  }
}

async function ensureRole({ userId, eventId, role }) {
  const match = supabase
    .from("event_user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", role)
    .limit(1);

  const { data: existing, error: selectError } =
    eventId === null
      ? await match.is("event_id", null)
      : await match.eq("event_id", eventId);

  if (selectError) {
    fail(selectError.message);
  }

  if (existing?.length) {
    return;
  }

  const { error } = await supabase.from("event_user_roles").insert({
    user_id: userId,
    event_id: eventId,
    role,
  });

  if (error) {
    fail(error.message);
  }
}

function isAlreadyRegisteredError(error) {
  return error?.message?.toLowerCase().includes("already registered");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
