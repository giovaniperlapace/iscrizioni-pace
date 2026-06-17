#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const eventSlug = process.env.GROUP_TREE_EVENT_SLUG || "assisi-2026-test";

const leaders = [
  {
    groupName: "Universitari",
    firstName: "Stefano",
    lastName: "Orlando",
    email: "stefano.orlando@dreamsantegidio.net",
  },
  {
    groupName: "Giovani per la pace scuole superiori",
    firstName: "Laura",
    lastName: "Guida",
    email: "lauraguida95@gmail.com",
  },
  {
    groupName: "Giovani per la pace scuole medie",
    firstName: "Alessandro",
    lastName: "Natali",
    email: "alessandronatali20@gmail.com",
  },
];

if (!supabaseUrl || !serviceRoleKey) {
  fail("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const event = await getEventBySlug(eventSlug);

for (const leader of leaders) {
  const fullName = `${leader.firstName} ${leader.lastName}`;
  const user = await ensureUser(leader.email, fullName);
  await ensureProfile(user.id, leader.email, fullName);
  const group = await getGroupByName(event.id, leader.groupName);

  await supabase
    .from("groups")
    .update({ primary_leader_name: fullName })
    .eq("id", group.id);

  await ensurePrimaryMembership({
    groupId: group.id,
    userId: user.id,
  });

  console.log(`Linked ${fullName} <${leader.email}> to ${leader.groupName}.`);
}

console.log(`Group leaders bootstrap completed for ${event.slug}.`);

async function getEventBySlug(slug) {
  const { data, error } = await supabase
    .from("events")
    .select("id,slug")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    fail(`Event '${slug}' not found. Apply the group tree migration first.`);
  }

  return data;
}

async function getGroupByName(eventId, groupName) {
  const { data, error } = await supabase
    .from("groups")
    .select("id,name")
    .eq("event_id", eventId)
    .eq("name", groupName)
    .maybeSingle();

  if (error || !data) {
    fail(`Group '${groupName}' not found. Apply the group tree migration first.`);
  }

  return data;
}

async function ensureUser(email, fullName) {
  const existing = await findUserByEmail(email);

  if (existing) {
    return existing;
  }

  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      group_leader_seed: true,
    },
  });

  if (error || !created.user) {
    fail(error?.message || `Could not create user ${email}.`);
  }

  return created.user;
}

async function findUserByEmail(email) {
  let page = 1;

  while (page < 50) {
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

async function ensurePrimaryMembership({ groupId, userId }) {
  const { error: clearError } = await supabase
    .from("group_memberships")
    .update({ is_primary: false })
    .eq("group_id", groupId)
    .eq("is_primary", true);

  if (clearError) {
    fail(clearError.message);
  }

  const { data: existing, error: selectError } = await supabase
    .from("group_memberships")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError) {
    fail(selectError.message);
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("group_memberships")
      .update({ role: "capogruppo", is_primary: true })
      .eq("id", existing.id);

    if (error) {
      fail(error.message);
    }

    return;
  }

  const { error } = await supabase.from("group_memberships").insert({
    group_id: groupId,
    user_id: userId,
    role: "capogruppo",
    is_primary: true,
  });

  if (error) {
    fail(error.message);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
