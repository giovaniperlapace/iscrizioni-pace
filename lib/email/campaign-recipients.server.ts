import { getOperationalUserIdentities } from "@/lib/operational-users/identity";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type CampaignRecipientAudience = "participants" | "group_leaders";
export type CampaignRecipientType = "participant" | "group_leader";
export type CampaignDeliveryKind = "direct" | "delegated" | "leader";

export type CampaignRecipient = {
  recipientKey: string;
  recipientType: CampaignRecipientType;
  participantId: string | null;
  registrationId: string | null;
  recipientUserId: string | null;
  deliveryKind: CampaignDeliveryKind;
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
  audience?: CampaignRecipientAudience;
  groupId: string | null;
  tagId: string | null;
  serviceId: string | null;
  status: string;
};

type RegistrationRow = {
  id: string;
  participant_id: string;
  status: string;
};

const QUERY_PAGE_SIZE = 1000;
const QUERY_CHUNK_SIZE = 400;

export async function resolveCampaignRecipients(
  eventId: string,
  filters: CampaignRecipientFilters
) {
  if (filters.audience === "group_leaders") {
    return resolveGroupLeaderRecipients(eventId);
  }

  return resolveParticipantRecipients(eventId, filters.status);
}

async function resolveParticipantRecipients(eventId: string, status: string): Promise<CampaignRecipient[]> {
  const registrations = await loadEventRegistrations(eventId, status);
  if (!registrations.length) return [];

  const data = await loadRegistrationDeliveries(eventId);
  const allowedRegistrations = new Set(registrations.map((row) => row.id));
  return (data ?? []).filter((row: { registration_id: string }) => allowedRegistrations.has(row.registration_id))
    .map((row: { registration_id: string; participant_id: string; delivery_kind: "direct" | "delegated"; delegate_user_id: string | null }): CampaignRecipient => ({
      recipientKey: `participant:${row.participant_id}`, recipientType: "participant", participantId: row.participant_id,
      registrationId: row.registration_id, recipientUserId: null, deliveryKind: row.delivery_kind, delegateUserId: row.delegate_user_id,
    }));
}

async function resolveGroupLeaderRecipients(eventId: string) {
  const service = createSupabaseServiceClient();
  const { data: memberships, error } = await service
    .from("group_memberships")
    .select("group_id,user_id,is_primary,groups!inner(event_id,is_active)")
    .eq("role", "capogruppo")
    .eq("groups.event_id", eventId)
    .eq("groups.is_active", true)
    .order("is_primary", { ascending: false });
  if (error) throw new Error(error.message);

  const userIds = [...new Set((memberships ?? []).map((row) => row.user_id))];
  const identities = await getOperationalUserIdentities(service, userIds);

  return userIds.flatMap<CampaignRecipient>((userId) => {
    const identity = identities.get(userId);
    if (!identity?.email?.trim()) return [];
    return [
      {
        recipientKey: `leader:${userId}`,
        recipientType: "group_leader",
        participantId: identity.participantId,
        registrationId: null,
        recipientUserId: userId,
        deliveryKind: "leader",
        delegateUserId: null,
      },
    ];
  });
}

export async function loadCampaignRecipientPreviews(
  recipients: CampaignRecipient[],
  selectedKeys: Set<string>,
  eventId: string
) {
  if (!recipients.length) return [];
  const service = createSupabaseServiceClient();
  if (recipients.some((recipient) => recipient.recipientType === "participant")) {
    const deliveries = await loadRegistrationDeliveries(eventId);
    const current = new Map<string, { delivery_kind: string; delegate_user_id: string | null }>(
      (deliveries ?? []).map((row: { registration_id: string; delivery_kind: string; delegate_user_id: string | null }) => [row.registration_id, row])
    );
    recipients = recipients.filter((recipient) => {
      if (recipient.recipientType === "group_leader") return true;
      const route = current.get(recipient.registrationId ?? "");
      return route?.delivery_kind === recipient.deliveryKind && route?.delegate_user_id === recipient.delegateUserId;
    });
  }
  const participantIds = [
    ...new Set(
      recipients.flatMap((recipient) =>
        recipient.participantId ? [recipient.participantId] : []
      )
    ),
  ];
  const registrationIds = recipients.flatMap((recipient) =>
    recipient.registrationId ? [recipient.registrationId] : []
  );
  const delegateUserIds = [
    ...new Set(
      recipients.flatMap((recipient) =>
        recipient.delegateUserId ? [recipient.delegateUserId] : []
      )
    ),
  ];
  const leaderUserIds = [
    ...new Set(
      recipients.flatMap((recipient) =>
        recipient.recipientUserId ? [recipient.recipientUserId] : []
      )
    ),
  ];

  const [
    participants,
    contacts,
    delegateIdentities,
    leaderIdentities,
    assignments,
    leaderMemberships,
    participantTags,
    participantServices,
  ] = await Promise.all([
    loadInChunks(participantIds, async (ids) => {
      const { data, error } = await service
        .from("participants")
        .select("id,first_name,last_name")
        .in("id", ids);
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
    loadInChunks(participantIds, async (ids) => {
      const { data, error } = await service
        .from("participant_contacts")
        .select("participant_id,email,is_primary")
        .eq("is_delegate_contact", false)
        .in("participant_id", ids)
        .order("is_primary", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
    getOperationalUserIdentities(service, delegateUserIds),
    getOperationalUserIdentities(service, leaderUserIds),
    loadInChunks(registrationIds, async (ids) => {
      const { data, error } = await service
        .from("participant_group_assignments")
        .select("registration_id,group_id")
        .eq("is_current", true)
        .in("registration_id", ids);
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
    loadInChunks(leaderUserIds, async (ids) => {
      const { data, error } = await service
        .from("group_memberships")
        .select("user_id,group_id,groups!inner(event_id)")
        .eq("role", "capogruppo")
        .eq("groups.event_id", eventId)
        .in("user_id", ids);
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
    loadInChunks(participantIds, async (ids) => {
      const { data, error } = await service
        .from("participant_operational_tags")
        .select("participant_id,tag_id")
        .in("participant_id", ids);
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
    loadInChunks(participantIds, async (ids) => {
      const { data, error } = await service
        .from("participant_event_services")
        .select("participant_id,service_id")
        .in("participant_id", ids);
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
  ]);

  const participantById = new Map(
    participants.map((participant) => [participant.id, participant])
  );
  const directEmailByParticipant = new Map<string, string>();
  for (const contact of contacts) {
    if (contact.email?.trim() && !directEmailByParticipant.has(contact.participant_id)) {
      directEmailByParticipant.set(contact.participant_id, contact.email.trim());
    }
  }
  const groupIdsByRegistration = collectRelationIds(
    assignments,
    "registration_id",
    "group_id"
  );
  const groupIdsByLeader = collectRelationIds(
    leaderMemberships,
    "user_id",
    "group_id"
  );
  const tagIdsByParticipant = collectRelationIds(
    participantTags,
    "participant_id",
    "tag_id"
  );
  const serviceIdsByParticipant = collectRelationIds(
    participantServices,
    "participant_id",
    "service_id"
  );

  const previews = recipients.flatMap<CampaignRecipientPreview>((recipient) => {
    if (recipient.recipientType === "group_leader" && recipient.recipientUserId) {
      const identity = leaderIdentities.get(recipient.recipientUserId);
      if (!identity?.email?.trim()) return [];
      return [
        {
          ...recipient,
          fullName: identity.fullName ?? identity.email,
          destinationEmail: identity.email.trim(),
          selected: selectedKeys.has(recipient.recipientKey),
          groupIds: groupIdsByLeader.get(recipient.recipientUserId) ?? [],
          tagIds: [],
          serviceIds: [],
        },
      ];
    }

    const participant = recipient.participantId
      ? participantById.get(recipient.participantId)
      : null;
    const destinationEmail =
      recipient.deliveryKind === "direct" && recipient.participantId
        ? directEmailByParticipant.get(recipient.participantId)
        : recipient.delegateUserId
          ? delegateIdentities.get(recipient.delegateUserId)?.email
          : null;
    if (!participant || !destinationEmail?.trim() || !recipient.participantId) {
      return [];
    }
    return [
      {
        ...recipient,
        fullName: `${participant.first_name} ${participant.last_name}`.trim(),
        destinationEmail: destinationEmail.trim(),
        selected: selectedKeys.has(recipient.recipientKey),
        groupIds: recipient.registrationId
          ? groupIdsByRegistration.get(recipient.registrationId) ?? []
          : [],
        tagIds: tagIdsByParticipant.get(recipient.participantId) ?? [],
        serviceIds: serviceIdsByParticipant.get(recipient.participantId) ?? [],
      },
    ];
  });

  return previews.sort((left, right) =>
    left.fullName.localeCompare(right.fullName, "it", { sensitivity: "base" })
  );
}

async function loadEventRegistrations(eventId: string, status: string) {
  const service = createSupabaseServiceClient();
  const result: RegistrationRow[] = [];

  for (let from = 0; ; from += QUERY_PAGE_SIZE) {
    let query = service
      .from("registrations")
      .select("id,participant_id,status")
      .eq("event_id", eventId)
      .order("submitted_at", { ascending: true });
    if (status !== "all") {
      query =
        status === "active"
          ? query.neq("status", "cancelled")
          : query.eq("status", status);
    }
    const { data, error } = await query.range(from, from + QUERY_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    result.push(...((data ?? []) as RegistrationRow[]));
    if ((data ?? []).length < QUERY_PAGE_SIZE) break;
  }

  return result;
}

async function loadInChunks<Row>(
  ids: string[],
  loader: (ids: string[]) => Promise<Row[]>
): Promise<Row[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const result: Row[] = [];
  for (let index = 0; index < uniqueIds.length; index += QUERY_CHUNK_SIZE) {
    result.push(...(await loader(uniqueIds.slice(index, index + QUERY_CHUNK_SIZE))));
  }
  return result;
}

function collectRelationIds<
  Row extends Record<Key | Value, string>,
  Key extends string,
  Value extends string,
>(rows: Row[], key: Key, value: Value) {
  const result = new Map<string, string[]>();
  for (const row of rows) {
    const current = result.get(row[key]) ?? [];
    if (!current.includes(row[value])) current.push(row[value]);
    result.set(row[key], current);
  }
  return result;
}

type RegistrationDelivery = { registration_id: string; participant_id: string; delivery_kind: "direct" | "delegated"; delegate_user_id: string | null };
async function loadRegistrationDeliveries(eventId: string): Promise<RegistrationDelivery[]> {
  const service = createSupabaseServiceClient();
  const result: RegistrationDelivery[] = [];
  for (let from = 0; ; from += QUERY_PAGE_SIZE) {
    const { data, error } = await service.rpc("resolve_registration_deliveries", { target_event_id: eventId })
      .order("registration_id").range(from, from + QUERY_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    result.push(...((data ?? []) as RegistrationDelivery[]));
    if ((data ?? []).length < QUERY_PAGE_SIZE) return result;
  }
}
