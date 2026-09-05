import type {
  OperationsDashboardFilters,
  OperationsStatisticsFilterSummary,
} from "@/lib/registrations/operations-dashboard";
import type {
  EventServiceOption,
  ParticipantEventService,
} from "@/lib/registrations/event-services";
import type {
  OperationalTagOption,
  ParticipantOperationalTag,
} from "@/lib/registrations/operational-tags";

export type OperationsRegistrationChild = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  position: number;
};

export type OperationsGroupOption = {
  id: string;
  eventId: string;
  name: string;
};

export type OperationsParticipantRow = {
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletedByName?: string | null;
  deletionReason?: string | null;
  registrationId: string;
  eventId: string;
  eventTitle: string;
  participantId: string;
  authUserId: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string;
  publicCode: string | null;
  birthDate: string | null;
  country: string | null;
  city: string | null;
  place: string;
  email: string | null;
  phone: string | null;
  registrationStatus: string | null;
  submittedAt: string | null;
  currentGroupId: string | null;
  currentGroupName: string | null;
  currentGroupStatus: string | null;
  currentServiceId: string | null;
  currentServiceStatus: string | null;
  service: ParticipantEventService | null;
  tagIds: string[];
  tags: ParticipantOperationalTag[];
  childrenCount: number;
  children: OperationsRegistrationChild[];
};

export type OperationsParticipantsSnapshot = {
  participants: OperationsParticipantRow[];
  allParticipants: OperationsParticipantRow[];
  groupOptions: OperationsGroupOption[];
  operationalTags: OperationalTagOption[];
  eventServices: EventServiceOption[];
  filters: OperationsDashboardFilters;
  statisticsFilter?: OperationsStatisticsFilterSummary | null;
};
