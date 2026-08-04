"use server";

import { headers } from "next/headers";

import { getCurrentAuthContext } from "@/lib/auth/session";
import { sendTransactionalEmail } from "@/lib/email/smtp";
import {
  PARTICIPANT_MESSAGE_RECIPIENT,
  renderParticipantOrganizerMessageEmail,
} from "@/lib/registrations/participant-messages.server";
import {
  parseParticipantMessage,
  type ParticipantMessageError,
} from "@/lib/registrations/participant-message-shared";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type ParticipantMessageActionState = {
  status: "idle" | "success" | "error";
  error: ParticipantMessageError | null;
};

type Related<T> = T | T[] | null;

type RegistrationMessageRow = {
  id: string;
  event_id: string;
  participant_id: string;
  participants: Related<{
    first_name: string | null;
    last_name: string | null;
    public_code: string | null;
  }>;
};

type AssignmentMessageRow = {
  group_id: string;
  groups: Related<{ name: string | null }>;
};

const PARTICIPANT_MESSAGE_RATE_LIMIT = {
  limit: 5,
  windowMs: 15 * 60 * 1_000,
};

export async function sendParticipantOrganizerMessage(
  _previousState: ParticipantMessageActionState,
  formData: FormData
): Promise<ParticipantMessageActionState> {
  const parsed = parseParticipantMessage(formData.get("message"));

  if (!parsed.ok) {
    return { status: "error", error: parsed.error };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "partecipante");

  if (!auth) {
    return { status: "error", error: "not-authenticated" };
  }

  const ipAddress = await getRequestIpAddress();

  if (
    !checkRateLimit(
      `participant-message:${auth.user.id}:${ipAddress}`,
      PARTICIPANT_MESSAGE_RATE_LIMIT
    )
  ) {
    return { status: "error", error: "rate-limit" };
  }

  const service = createSupabaseServiceClient();
  const { data: registrationData } = await service
    .from("registrations")
    .select(
      "id,event_id,participant_id,events!inner(is_current),participants!inner(auth_user_id,first_name,last_name,public_code)"
    )
    .eq("events.is_current", true)
    .eq("participants.auth_user_id", auth.user.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const registration = registrationData as RegistrationMessageRow | null;
  const participant = relatedOne(registration?.participants ?? null);

  if (!registration || !participant) {
    return { status: "error", error: "not-found" };
  }

  const [{ data: contactData }, { data: assignmentData }] = await Promise.all([
    service
      .from("participant_contacts")
      .select("email")
      .eq("participant_id", registration.participant_id)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from("participant_group_assignments")
      .select(
        "group_id,groups!participant_group_assignments_group_id_fkey(name)"
      )
      .eq("registration_id", registration.id)
      .eq("is_current", true)
      .limit(1)
      .maybeSingle(),
  ]);
  const assignment = assignmentData as AssignmentMessageRow | null;
  const group = relatedOne(assignment?.groups ?? null);
  const email =
    (contactData as { email: string | null } | null)?.email ??
    auth.user.email ??
    null;
  const participantReference =
    participant.public_code?.trim() || registration.participant_id;
  const renderedEmail = renderParticipantOrganizerMessageEmail({
    firstName: participant.first_name ?? "",
    lastName: participant.last_name ?? "",
    groupName: group?.name ?? null,
    participantId: participantReference,
    email,
    message: parsed.value,
  });

  try {
    await sendTransactionalEmail({
      to: PARTICIPANT_MESSAGE_RECIPIENT,
      ...renderedEmail,
    });
  } catch (error) {
    await writeMessageAudit(service, {
      eventId: registration.event_id,
      actorUserId: auth.user.id,
      registrationId: registration.id,
      action: "email.participant_message_failed",
      metadata: {
        group_id: assignment?.group_id ?? null,
        message_length: parsed.value.length,
        error:
          error instanceof Error
            ? error.message.slice(0, 300)
            : "Unknown email error",
      },
    });
    console.error("[email:participant-message]", error);
    return { status: "error", error: "delivery" };
  }

  await writeMessageAudit(service, {
    eventId: registration.event_id,
    actorUserId: auth.user.id,
    registrationId: registration.id,
    action: "email.participant_message_sent",
    metadata: {
      group_id: assignment?.group_id ?? null,
      message_length: parsed.value.length,
    },
  });

  return { status: "success", error: null };
}

async function getRequestIpAddress(): Promise<string> {
  const requestHeaders = await headers();

  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "local"
  );
}

async function writeMessageAudit(
  service: ReturnType<typeof createSupabaseServiceClient>,
  input: {
    eventId: string;
    actorUserId: string;
    registrationId: string;
    action: string;
    metadata: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await service.from("audit_logs").insert({
    event_id: input.eventId,
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_table: "registrations",
    entity_id: input.registrationId,
    metadata: input.metadata,
  });

  if (error) {
    console.warn(
      "participant_message_audit_failed",
      JSON.stringify({ action: input.action, message: error.message })
    );
  }
}

function relatedOne<T>(value: Related<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}
