import type { SupabaseClient } from "@supabase/supabase-js";

type ParticipantIdRow = {
  id: string;
};

type PersonalRegistrationRow = {
  id: string;
  event_id: string;
  status: string | null;
  submitted_at: string | null;
  events:
    | { title: string | null; starts_on: string | null }
    | Array<{ title: string | null; starts_on: string | null }>
    | null;
};

export type PersonalRegistrationSummary = {
  hasRegistration: boolean;
  eventTitle: string | null;
  submittedAt: string | null;
};

export async function getPersonalRegistrationSummary(
  supabase: SupabaseClient,
  userId: string,
  eventIds?: string[]
): Promise<PersonalRegistrationSummary> {
  if (eventIds && eventIds.length === 0) {
    return emptySummary();
  }

  const { data: participants, error: participantError } = await supabase
    .from("participants")
    .select("id")
    .eq("auth_user_id", userId)
    .limit(50);

  if (participantError || !participants?.length) {
    return emptySummary();
  }

  const participantIds = (participants as ParticipantIdRow[]).map(
    (participant) => participant.id
  );
  let query = supabase
    .from("registrations")
    .select("id,event_id,status,submitted_at,events(title,starts_on)")
    .in("participant_id", participantIds)
    .neq("status", "cancelled")
    .order("submitted_at", { ascending: false })
    .limit(1);

  if (eventIds?.length) {
    query = query.in("event_id", eventIds);
  }

  const { data: registrations, error: registrationError } = await query;

  if (registrationError || !registrations?.length) {
    return emptySummary();
  }

  const registration = (registrations as PersonalRegistrationRow[])[0];
  const event = relatedOne(registration.events);

  return {
    hasRegistration: true,
    eventTitle: event?.title ?? null,
    submittedAt: registration.submitted_at,
  };
}

function emptySummary(): PersonalRegistrationSummary {
  return {
    hasRegistration: false,
    eventTitle: null,
    submittedAt: null,
  };
}

function relatedOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}
