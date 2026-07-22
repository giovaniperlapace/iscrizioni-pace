import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type CampaignRecipient = {
  participantId: string;
  registrationId: string;
  deliveryKind: "direct" | "delegated";
  delegateUserId: string | null;
};

export type CampaignRecipientPreview = CampaignRecipient & {
  fullName: string;
  destinationEmail: string;
  selected: boolean;
  groupIds: string[];
  tagIds: string[];
  serviceIds: string[];
};

export type CampaignRecipientFilters = {
  groupId: string | null;
  tagId: string | null;
  serviceId: string | null;
  status: string;
};

export async function resolveCampaignRecipients(
  eventId: string,
  filters: CampaignRecipientFilters
) {
  const service = createSupabaseServiceClient();
  let query = service
    .from("registrations")
    .select("id,participant_id,status")
    .eq("event_id", eventId)
    .limit(1000);
  if (filters.status !== "all") {
    query = filters.status === "active"
      ? query.neq("status", "cancelled")
      : query.eq("status", filters.status);
  }
  const { data: registrations, error: registrationError } = await query;
  if (registrationError) throw new Error(registrationError.message);

  let allowed = new Set((registrations ?? []).map((row) => row.id));
  if (filters.groupId && allowed.size) {
    const { data } = await service
      .from("participant_group_assignments")
      .select("registration_id")
      .eq("group_id", filters.groupId)
      .eq("is_current", true)
      .in("registration_id", [...allowed]);
    allowed = new Set((data ?? []).map((row) => row.registration_id));
  }
  if (filters.tagId && allowed.size) {
    const participantIds = (registrations ?? [])
      .filter((row) => allowed.has(row.id))
      .map((row) => row.participant_id);
    const { data } = await service
      .from("participant_operational_tags")
      .select("participant_id")
      .eq("tag_id", filters.tagId)
      .in("participant_id", participantIds);
    const tagged = new Set((data ?? []).map((row) => row.participant_id));
    allowed = new Set(
      (registrations ?? [])
        .filter((row) => allowed.has(row.id) && tagged.has(row.participant_id))
        .map((row) => row.id)
    );
  }
  if (filters.serviceId && allowed.size) {
    const participantIds = (registrations ?? [])
      .filter((row) => allowed.has(row.id))
      .map((row) => row.participant_id);
    const { data } = await service
      .from("participant_event_services")
      .select("participant_id")
      .eq("event_id", eventId)
      .eq("service_id", filters.serviceId)
      .in("participant_id", participantIds);
    const withService = new Set((data ?? []).map((row) => row.participant_id));
    allowed = new Set(
      (registrations ?? [])
        .filter((row) => allowed.has(row.id) && withService.has(row.participant_id))
        .map((row) => row.id)
    );
  }

  const selected = (registrations ?? []).filter((row) => allowed.has(row.id));
  if (!selected.length) return [];
  const participantIds = selected.map((row) => row.participant_id);
  const { data: contacts } = await service
    .from("participant_contacts")
    .select("participant_id,email,is_primary")
    .in("participant_id", participantIds)
    .order("is_primary", { ascending: false });
  const direct = new Set(
    (contacts ?? [])
      .filter((row) => Boolean(row.email?.trim()))
      .map((row) => row.participant_id)
  );
  const missingIds = participantIds.filter((id) => !direct.has(id));
  const delegates = new Map<string, string>();

  if (missingIds.length) {
    const missingRegistrations = selected.filter((row) => missingIds.includes(row.participant_id));
    const { data: assignments } = await service
      .from("participant_group_assignments")
      .select("registration_id,group_id")
      .eq("is_current", true)
      .in("registration_id", missingRegistrations.map((row) => row.id));
    const registrationParticipant = new Map(
      missingRegistrations.map((row) => [row.id, row.participant_id])
    );
    const groupParticipant = new Map(
      (assignments ?? []).map((row) => [row.group_id, registrationParticipant.get(row.registration_id)!])
    );
    if (groupParticipant.size) {
      const { data: memberships } = await service
        .from("group_memberships")
        .select("group_id,user_id,is_primary")
        .eq("role", "capogruppo")
        .in("group_id", [...groupParticipant.keys()])
        .order("is_primary", { ascending: false });
      const userIds = [...new Set((memberships ?? []).map((row) => row.user_id))];
      const { data: profiles } = userIds.length
        ? await service.from("profiles").select("id,email").in("id", userIds)
        : { data: [] };
      const validUsers = new Set(
        (profiles ?? []).filter((row) => Boolean(row.email?.trim())).map((row) => row.id)
      );
      for (const membership of memberships ?? []) {
        const participantId = groupParticipant.get(membership.group_id);
        if (participantId && validUsers.has(membership.user_id) && !delegates.has(participantId)) {
          delegates.set(participantId, membership.user_id);
        }
      }
    }
  }

  return selected.flatMap<CampaignRecipient>((row) =>
    direct.has(row.participant_id)
      ? [{ participantId: row.participant_id, registrationId: row.id, deliveryKind: "direct", delegateUserId: null }]
      : delegates.has(row.participant_id)
        ? [{ participantId: row.participant_id, registrationId: row.id, deliveryKind: "delegated", delegateUserId: delegates.get(row.participant_id)! }]
        : []
  );
}

export async function loadCampaignRecipientPreviews(
  recipients: CampaignRecipient[],
  selectedIds: Set<string>
) {
  if (!recipients.length) return [];
  const service = createSupabaseServiceClient();
  const participantIds = recipients.map((recipient) => recipient.participantId);
  const registrationIds = recipients.map((recipient) => recipient.registrationId);
  const delegateUserIds = [
    ...new Set(
      recipients.flatMap((recipient) =>
        recipient.delegateUserId ? [recipient.delegateUserId] : []
      )
    ),
  ];
  const [
    { data: participants },
    { data: contacts },
    { data: delegates },
    { data: assignments },
    { data: participantTags },
    { data: participantServices },
  ] = await Promise.all([
    service.from("participants").select("id,first_name,last_name").in("id", participantIds),
    service
      .from("participant_contacts")
      .select("participant_id,email,is_primary")
      .in("participant_id", participantIds)
      .order("is_primary", { ascending: false }),
    delegateUserIds.length
      ? service.from("profiles").select("id,email").in("id", delegateUserIds)
      : Promise.resolve({ data: [] as { id: string; email: string | null }[] }),
    service
      .from("participant_group_assignments")
      .select("registration_id,group_id")
      .eq("is_current", true)
      .in("registration_id", registrationIds),
    service
      .from("participant_operational_tags")
      .select("participant_id,tag_id")
      .in("participant_id", participantIds),
    service
      .from("participant_event_services")
      .select("participant_id,service_id")
      .in("participant_id", participantIds),
  ]);

  const participantById = new Map(
    (participants ?? []).map((participant) => [participant.id, participant])
  );
  const directEmailByParticipant = new Map<string, string>();
  for (const contact of contacts ?? []) {
    if (contact.email?.trim() && !directEmailByParticipant.has(contact.participant_id)) {
      directEmailByParticipant.set(contact.participant_id, contact.email.trim());
    }
  }
  const delegateEmailByUser = new Map(
    (delegates ?? []).flatMap((delegate) =>
      delegate.email?.trim() ? [[delegate.id, delegate.email.trim()] as const] : []
    )
  );
  const groupIdsByRegistration = collectRelationIds(assignments ?? [], "registration_id", "group_id");
  const tagIdsByParticipant = collectRelationIds(participantTags ?? [], "participant_id", "tag_id");
  const serviceIdsByParticipant = collectRelationIds(participantServices ?? [], "participant_id", "service_id");

  const previews = recipients.flatMap<CampaignRecipientPreview>((recipient) => {
    const participant = participantById.get(recipient.participantId);
    const destinationEmail = recipient.deliveryKind === "direct"
      ? directEmailByParticipant.get(recipient.participantId)
      : recipient.delegateUserId
        ? delegateEmailByUser.get(recipient.delegateUserId)
        : null;
    if (!participant || !destinationEmail) return [];
    return [{
      ...recipient,
      fullName: `${participant.first_name} ${participant.last_name}`.trim(),
      destinationEmail,
      selected: selectedIds.has(recipient.participantId),
      groupIds: groupIdsByRegistration.get(recipient.registrationId) ?? [],
      tagIds: tagIdsByParticipant.get(recipient.participantId) ?? [],
      serviceIds: serviceIdsByParticipant.get(recipient.participantId) ?? [],
    }];
  });

  return previews.sort((left, right) =>
    left.fullName.localeCompare(right.fullName, "it", { sensitivity: "base" })
  );
}

function collectRelationIds<Row extends Record<Key | Value, string>, Key extends string, Value extends string>(
  rows: Row[],
  key: Key,
  value: Value
) {
  const result = new Map<string, string[]>();
  for (const row of rows) {
    const current = result.get(row[key]) ?? [];
    if (!current.includes(row[value])) current.push(row[value]);
    result.set(row[key], current);
  }
  return result;
}
