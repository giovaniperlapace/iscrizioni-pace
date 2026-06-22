import type { SupabaseClient } from "@supabase/supabase-js";

export type OperationalUserIdentity = {
  userId: string;
  email: string | null;
  fullName: string | null;
  participantId: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type ParticipantRow = {
  id: string;
  auth_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ContactRow = {
  participant_id: string;
  email: string | null;
  is_primary: boolean | null;
};

export function buildFullName(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || null;
}

export function splitFullName(fullName: string | null): {
  firstName: string;
  lastName: string;
} {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return { firstName: parts[0] ?? "", lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? "",
  };
}

export async function getOperationalUserIdentities(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, OperationalUserIdentity>> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  if (uniqueUserIds.length === 0) {
    return new Map();
  }

  const [{ data: profiles }, { data: linkedParticipants }] = await Promise.all([
    supabase.from("profiles").select("id,email,full_name").in("id", uniqueUserIds),
    supabase
      .from("participants")
      .select("id,auth_user_id,first_name,last_name")
      .in("auth_user_id", uniqueUserIds),
  ]);
  const profileById = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );
  const linkedParticipantRows = (linkedParticipants ?? []) as ParticipantRow[];
  const linkedParticipantIds = linkedParticipantRows.map((participant) => participant.id);
  const profileEmails = Array.from(
    new Set(
      Array.from(profileById.values())
        .map((profile) => profile.email?.toLowerCase() ?? null)
        .filter((email): email is string => Boolean(email))
    )
  );
  const [{ data: linkedContacts }, { data: fallbackContacts }] = await Promise.all([
    linkedParticipantIds.length > 0
      ? supabase
          .from("participant_contacts")
          .select("participant_id,email,is_primary")
          .in("participant_id", linkedParticipantIds)
      : Promise.resolve({ data: [] }),
    profileEmails.length > 0
      ? supabase
          .from("participant_contacts")
          .select("participant_id,email,is_primary")
          .in("email", profileEmails)
      : Promise.resolve({ data: [] }),
  ]);
  const fallbackParticipantIds = Array.from(
    new Set(((fallbackContacts ?? []) as ContactRow[]).map((contact) => contact.participant_id))
  );
  const { data: fallbackParticipants } =
    fallbackParticipantIds.length > 0
      ? await supabase
          .from("participants")
          .select("id,auth_user_id,first_name,last_name")
          .in("id", fallbackParticipantIds)
      : { data: [] };
  const participantById = new Map(
    [...linkedParticipantRows, ...((fallbackParticipants ?? []) as ParticipantRow[])].map(
      (participant) => [participant.id, participant]
    )
  );
  const contactByParticipantId = pickPreferredContact(
    [...((linkedContacts ?? []) as ContactRow[]), ...((fallbackContacts ?? []) as ContactRow[])]
  );
  const participantByUserId = new Map<string, ParticipantRow>();
  const participantByEmail = new Map<string, ParticipantRow>();

  for (const participant of participantById.values()) {
    if (participant.auth_user_id && !participantByUserId.has(participant.auth_user_id)) {
      participantByUserId.set(participant.auth_user_id, participant);
    }

    const email = contactByParticipantId
      .get(participant.id)
      ?.email?.toLowerCase();

    if (email && !participantByEmail.has(email)) {
      participantByEmail.set(email, participant);
    }
  }

  return new Map(
    uniqueUserIds.map((userId) => {
      const profile = profileById.get(userId);
      const profileEmail = profile?.email?.toLowerCase() ?? null;
      const participant =
        participantByUserId.get(userId) ??
        (profileEmail ? participantByEmail.get(profileEmail) : undefined) ??
        null;
      const participantContact = participant
        ? contactByParticipantId.get(participant.id)
        : null;
      const participantName = participant
        ? buildFullName(participant.first_name, participant.last_name)
        : null;

      return [
        userId,
        {
          userId,
          email: profile?.email ?? participantContact?.email ?? null,
          fullName: participantName ?? profile?.full_name ?? null,
          participantId: participant?.id ?? null,
        },
      ];
    })
  );
}

export async function getOperationalRegistrationSuggestion(
  supabase: SupabaseClient,
  email: string
): Promise<{ firstName: string; lastName: string } | null> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("email", normalizedEmail)
    .maybeSingle();
  const profileName = (profile as { full_name: string | null } | null)?.full_name ?? null;

  if (profileName) {
    const split = splitFullName(profileName);

    if (split.firstName || split.lastName) {
      return split;
    }
  }

  const { data: contact } = await supabase
    .from("participant_contacts")
    .select("participant_id")
    .eq("email", normalizedEmail)
    .order("is_primary", { ascending: false })
    .limit(1);
  const participantId =
    ((contact ?? []) as Array<{ participant_id: string }>)[0]?.participant_id ?? null;

  if (!participantId) {
    return null;
  }

  const { data: participant } = await supabase
    .from("participants")
    .select("first_name,last_name")
    .eq("id", participantId)
    .maybeSingle();
  const participantRow = participant as
    | { first_name: string | null; last_name: string | null }
    | null;

  if (!participantRow) {
    return null;
  }

  return {
    firstName: participantRow.first_name ?? "",
    lastName: participantRow.last_name ?? "",
  };
}

export async function syncOperationalIdentityByEmail(
  supabase: SupabaseClient,
  input: {
    email: string;
    firstName: string;
    lastName: string;
    userId?: string | null;
    participantId?: string | null;
  }
): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const fullName = buildFullName(input.firstName, input.lastName);

  if (!email || !fullName) {
    return;
  }

  const profileQuery = supabase
    .from("profiles")
    .update({ full_name: fullName, email })
    .eq(input.userId ? "id" : "email", input.userId ?? email);

  await profileQuery;

  const participantIds = new Set<string>();

  if (input.participantId) {
    participantIds.add(input.participantId);
  }

  if (input.userId) {
    const { data: linkedParticipants } = await supabase
      .from("participants")
      .select("id")
      .eq("auth_user_id", input.userId);

    for (const participant of (linkedParticipants ?? []) as Array<{ id: string }>) {
      participantIds.add(participant.id);
    }
  }

  const { data: contacts } = await supabase
    .from("participant_contacts")
    .select("participant_id")
    .eq("email", email);

  for (const contact of (contacts ?? []) as Array<{ participant_id: string }>) {
    participantIds.add(contact.participant_id);
  }

  if (participantIds.size === 0) {
    return;
  }

  const participantUpdates: {
    first_name: string;
    last_name: string;
    auth_user_id?: string;
  } = {
    first_name: input.firstName,
    last_name: input.lastName,
  };

  if (input.userId) {
    participantUpdates.auth_user_id = input.userId;
  }

  await supabase
    .from("participants")
    .update(participantUpdates)
    .in("id", Array.from(participantIds));
}

function pickPreferredContact(rows: ContactRow[]): Map<string, ContactRow> {
  const contactByParticipantId = new Map<string, ContactRow>();

  for (const row of rows) {
    const current = contactByParticipantId.get(row.participant_id);

    if (!current || (!current.is_primary && row.is_primary)) {
      contactByParticipantId.set(row.participant_id, row);
    }
  }

  return contactByParticipantId;
}
