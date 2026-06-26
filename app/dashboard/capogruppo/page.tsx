import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  createGroupLeaderManualRegistration,
  createGroupRegistrationLink,
  revokeGroupRegistrationLink,
  updateGroupLeaderAssignment,
  updateParticipantOperationalTags,
} from "@/app/actions";
import {
  DashboardAreaDescription,
  DashboardRoleTabs,
} from "@/app/dashboard/role-tabs";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ManualAccessibilityFields } from "@/app/dashboard/capogruppo/manual-accessibility-fields";
import { ManualAttendanceFields } from "@/app/dashboard/capogruppo/manual-attendance-fields";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { getCurrentOperationalEventId } from "@/lib/events/current";
import {
  collectDescendantGroupIds,
  matchesGroupLeaderFilter,
  parseGroupLeaderReviewFilter,
  type GroupLeaderReviewFilter,
  type GroupTreeNode,
} from "@/lib/groups/capogruppo-dashboard";
import {
  buildGroupRegistrationUrl,
  getGroupRegistrationLinkStatus,
} from "@/lib/groups/registration-links";
import { LANGUAGE_OPTIONS, type SupportedLocale } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import type {
  OperationalTagOption,
  ParticipantOperationalTag,
} from "@/lib/registrations/operational-tags";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type CapogruppoPageProps = {
  searchParams: Promise<{
    filter?: string;
    error?: string;
    saved?: string;
    groupLinkError?: string;
    groupLinkSaved?: string;
    groupLinkToken?: string;
    groupLinkGroupId?: string;
    manualError?: string;
    manualSaved?: string;
    q?: string;
    sort?: string;
    tool?: string;
    groupId?: string;
    assignmentId?: string;
  }>;
};

type GroupMembershipRow = {
  group_id: string | null;
};

type GroupRow = {
  id: string;
  event_id: string;
  name: string;
  parent_group_id: string | null;
  node_type: string | null;
  is_assignable: boolean | null;
  is_public_catalog: boolean | null;
  is_active: boolean | null;
  public_label: string | null;
  primary_leader_name: string | null;
  events:
    | { title: string | null; starts_on: string | null; ends_on: string | null }
    | Array<{ title: string | null; starts_on: string | null; ends_on: string | null }>
    | null;
};

type GroupLinkRow = {
  id: string;
  event_id: string;
  group_id: string;
  public_label: string | null;
  internal_label: string | null;
  use_count: number | null;
  max_uses: number | null;
  created_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

type GroupLinkView = {
  id: string;
  eventId: string;
  groupId: string;
  publicLabel: string | null;
  internalLabel: string | null;
  useCount: number;
  maxUses: number | null;
  createdAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
};

type ScopedGroupView = {
  id: string;
  eventId: string;
  eventTitle: string;
  name: string;
  nodeType: string | null;
  isActive: boolean;
  isAssignable: boolean;
  isPublicCatalog: boolean;
  publicLabel: string | null;
  primaryLeaderName: string | null;
  eventStartsOn: string | null;
  eventEndsOn: string | null;
};

type AssignmentRow = {
  id: string;
  registration_id: string;
  group_id: string;
  status: string | null;
  source: string | null;
  confidence: number | null;
  is_current: boolean | null;
  assignment_reason: string | null;
  escalation_depth: number | null;
  leader_internal_note: string | null;
  leader_notification_read_at: string | null;
  leader_decision_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  groups:
    | {
        id: string;
        name: string | null;
        node_type: string | null;
        parent_group_id: string | null;
      }
    | Array<{
        id: string;
        name: string | null;
        node_type: string | null;
        parent_group_id: string | null;
      }>
    | null;
  registrations:
    | {
        id: string;
        event_id: string;
        status: string | null;
        submitted_at: string | null;
        participants:
          | {
              id: string;
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
              birth_date: string | null;
              country_other: string | null;
              city_other: string | null;
              participant_contacts:
                | Array<{
                    email: string | null;
                    phone: string | null;
                    is_primary: boolean | null;
                  }>
                | null;
              countries:
                | { name_it: string | null }
                | Array<{ name_it: string | null }>
                | null;
              cities:
                | { name: string | null }
                | Array<{ name: string | null }>
                | null;
              participates_with_group: boolean | null;
              participant_operational_tags:
                | Array<{
                    assigned_at: string | null;
                    operational_tags:
                      | {
                          id: string;
                          event_id: string;
                          label: string;
                          color: string;
                        }
                      | Array<{
                          id: string;
                          event_id: string;
                          label: string;
                          color: string;
                        }>
                      | null;
                  }>
                | null;
            }
          | Array<{
              id: string;
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
              birth_date: string | null;
              country_other: string | null;
              city_other: string | null;
              participant_contacts:
                | Array<{
                    email: string | null;
                    phone: string | null;
                    is_primary: boolean | null;
                  }>
                | null;
              countries:
                | { name_it: string | null }
                | Array<{ name_it: string | null }>
                | null;
              cities:
                | { name: string | null }
                | Array<{ name: string | null }>
                | null;
              participates_with_group: boolean | null;
              participant_operational_tags:
                | Array<{
                    assigned_at: string | null;
                    operational_tags:
                      | {
                          id: string;
                          event_id: string;
                          label: string;
                          color: string;
                        }
                      | Array<{
                          id: string;
                          event_id: string;
                          label: string;
                          color: string;
                        }>
                      | null;
                  }>
                | null;
            }>
          | null;
      }
    | Array<{
        id: string;
        event_id: string;
        status: string | null;
        submitted_at: string | null;
        participants:
          | {
              id: string;
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
              birth_date: string | null;
              country_other: string | null;
              city_other: string | null;
              participant_contacts:
                | Array<{
                    email: string | null;
                    phone: string | null;
                    is_primary: boolean | null;
                  }>
                | null;
              countries:
                | { name_it: string | null }
                | Array<{ name_it: string | null }>
                | null;
              cities:
                | { name: string | null }
                | Array<{ name: string | null }>
                | null;
              participates_with_group: boolean | null;
              participant_operational_tags:
                | Array<{
                    assigned_at: string | null;
                    operational_tags:
                      | {
                          id: string;
                          event_id: string;
                          label: string;
                          color: string;
                        }
                      | Array<{
                          id: string;
                          event_id: string;
                          label: string;
                          color: string;
                        }>
                      | null;
                  }>
                | null;
            }
          | Array<{
              id: string;
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
              birth_date: string | null;
              country_other: string | null;
              city_other: string | null;
              participant_contacts:
                | Array<{
                    email: string | null;
                    phone: string | null;
                    is_primary: boolean | null;
                  }>
                | null;
              countries:
                | { name_it: string | null }
                | Array<{ name_it: string | null }>
                | null;
              cities:
                | { name: string | null }
                | Array<{ name: string | null }>
                | null;
              participates_with_group: boolean | null;
              participant_operational_tags:
                | Array<{
                    assigned_at: string | null;
                    operational_tags:
                      | {
                          id: string;
                          event_id: string;
                          label: string;
                          color: string;
                        }
                      | Array<{
                          id: string;
                          event_id: string;
                          label: string;
                          color: string;
                        }>
                      | null;
                  }>
                | null;
            }>
          | null;
      }>
    | null;
};

type AssignmentView = {
  id: string;
  registrationId: string;
  eventId: string;
  participantId: string;
  groupId: string;
  groupName: string;
  groupNodeType: string | null;
  participantName: string;
  participantCode: string | null;
  participantEmail: string | null;
  participantPhone: string | null;
  participantPlace: string;
  participatesWithGroup: boolean | null;
  birthDate: string | null;
  registrationStatus: string | null;
  submittedAt: string | null;
  status: string | null;
  source: string | null;
  confidence: number | null;
  isCurrent: boolean;
  assignmentReason: string | null;
  escalationDepth: number;
  leaderInternalNote: string | null;
  leaderNotificationReadAt: string | null;
  leaderDecisionAt: string | null;
  updatedAt: string | null;
  tags: ParticipantOperationalTag[];
  tagIds: string[];
};
type DashboardTool = "link" | "manual";

const ASSIGNMENT_SORT_VALUES = ["name", "updated", "submitted", "status"] as const;
type AssignmentSort = (typeof ASSIGNMENT_SORT_VALUES)[number];
const DAY_IN_MS = 24 * 60 * 60 * 1000;
type GroupLeaderCopy = {
  srTitle: string;
  areaDescription: string;
  saved: string;
  errorPrefix: string;
  yourGroups: string;
  yourGroupsHelp: string;
  registrableCount: (count: number) => string;
  canRegister: string;
  cannotRegister: string;
  publicVisible: string;
  publicHidden: string;
  leader: string;
  generateLink: string;
  addParticipant: string;
  inactiveGroupHelp: string;
  noGroups: string;
  close: string;
  participantsTitle: string;
  participantsHelp: string;
  linkTitle: string;
  linkHelp: string;
  visibleInForm: string;
  hidden: string;
  leaderMissing: string;
  formPublicName: string;
  notSet: string;
  eventFallback: string;
  groupFallback: string;
  participantFallback: string;
  notProvided: string;
  justCreatedLink: string;
  unlabeledLink: string;
  uses: string;
  revoke: string;
  noActiveLinks: string;
  publicLabel: string;
  publicLabelHelp: string;
  internalLabel: string;
  internalLabelPlaceholder: string;
  internalLabelHelp: string;
  noRegistrableGroups: string;
  manualTitle: string;
  manualHelp: string;
  group: string;
  selectGroup: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  language: string;
  internalNote: string;
  consent: string;
  filters: {
    search: string;
    searchPlaceholder: string;
    status: string;
    sort: string;
    apply: string;
    reset: string;
    empty: string;
  };
  filterLabels: Record<GroupLeaderReviewFilter, string>;
  sortLabels: Record<AssignmentSort, string>;
  table: {
    participant: string;
    contacts: string;
    group: string;
    origin: string;
    registration: string;
    status: string;
    actions: string;
    withoutCode: string;
    bornOn: (date: string) => string;
    emailMissing: string;
    phoneMissing: string;
    updated: (date: string) => string;
    unread: string;
    openCard: string;
    openCardAria: (name: string, code: string | null) => string;
    manage: string;
    manageAria: (name: string, code: string | null) => string;
    saveNote: string;
    confirm: string;
    reject: string;
    markRead: string;
  };
  detail: {
    title: string;
    identity: string;
    contacts: string;
    group: string;
    assignment: string;
    notes: string;
    noNote: string;
    publicCode: string;
    registrationStatus: string;
    submittedAt: string;
    updatedAt: string;
    decisionAt: string;
    escalationDepth: string;
    participatesWithGroup: string;
    yes: string;
    no: string;
    unknown: string;
  };
  attendance: {
    title: string;
    help: string;
    noDates: string;
    unknown: string;
  };
  accessibility: {
    title: string;
    help: string;
    question: string;
    unknown: string;
    no: string;
    yes: string;
    needsSupport: string;
    notes: string;
  };
  statusLabels: {
    confirmed: string;
    rejected: string;
    superseded: string;
    probable: string;
    active: (date: string) => string;
    expired: string;
    revoked: string;
    exhausted: string;
  };
  sourceLabels: {
    participantSelected: string;
    rule: string;
    capogruppo: string;
    manager: string;
    admin: string;
  };
  assignmentReasonLabels: {
    participantSelectedGroup: string;
    groupRegistrationLink: string;
    newcomerTerritorialFallback: string;
    participantCannotFindLeader: string;
    santegidioTerritorialFallback: string;
    groupLeaderRejectedEscalatedToParent: string;
    groupLeaderManualEntry: string;
    adminUpdatedGroup: string;
    managerUpdatedGroup: string;
    capogruppoUpdatedGroup: string;
  };
};

const IT_GROUP_LEADER_COPY: GroupLeaderCopy = {
  srTitle: "Dashboard capogruppo",
  areaDescription:
    "In questa area puoi verificare le assegnazioni dei tuoi gruppi, confermare i partecipanti o rimandarli al livello superiore.",
  saved: "Aggiornamento salvato.",
  errorPrefix: "Operazione non completata",
  yourGroups: "I tuoi gruppi",
  yourGroupsHelp: "Questi sono i gruppi collegati al tuo account capogruppo.",
  registrableCount: (count) => `${count} iscrivibili`,
  canRegister: "Può ricevere iscrizioni",
  cannotRegister: "Non disponibile per iscrizioni",
  publicVisible: "Visibile nel form pubblico",
  publicHidden: "Non visibile nel form pubblico",
  leader: "referente",
  generateLink: "Genera link",
  addParticipant: "Inserisci partecipante",
  inactiveGroupHelp:
    "Questo gruppo è collegato al tuo account, ma non è attivo nel catalogo operativo. Prima di usare link o inserimenti manuali serve un intervento di un manager/admin per riattivarlo o collegarti al gruppo corretto.",
  noGroups: "Nessun gruppo collegato al tuo account.",
  close: "Chiudi",
  participantsTitle: "Partecipanti del gruppo",
  participantsHelp:
    "Qui trovi le persone collegate ai gruppi che gestisci. Le decisioni sul gruppo sono interne e non inviano comunicazioni automatiche al partecipante.",
  linkTitle: "Link iscrizione gruppo",
  linkHelp:
    "Puoi generare link riservati solo per i gruppi che gestisci. I link non rendono il gruppo visibile nel menu pubblico.",
  visibleInForm: "Visibile nel form",
  hidden: "Nascosto",
  leaderMissing: "da assegnare",
  formPublicName: "Nome mostrato nel form",
  notSet: "non impostata",
  eventFallback: "Evento",
  groupFallback: "Gruppo senza nome",
  participantFallback: "Partecipante senza nome",
  notProvided: "Non indicata",
  justCreatedLink: "Link appena generato",
  unlabeledLink: "Link senza etichetta",
  uses: "usi",
  revoke: "Revoca",
  noActiveLinks: "Nessun link attivo.",
  publicLabel: "Nome mostrato a chi si iscrive",
  publicLabelHelp:
    "Opzionale. Se compilato, chi apre questo link vedrà questo nome invece del nome interno del gruppo.",
  internalLabel: "Promemoria per te",
  internalLabelPlaceholder: "Per esempio: link mandato su WhatsApp",
  internalLabelHelp:
    "Non viene mostrato ai partecipanti. Serve solo a riconoscere questo link in dashboard.",
  noRegistrableGroups: "Nessun gruppo gestito può ricevere iscrizioni in questo momento.",
  manualTitle: "Inserimento manuale",
  manualHelp:
    "Aggiungi una persona direttamente a uno dei gruppi che gestisci. La persona risulta subito confermata nel gruppo scelto.",
  group: "Gruppo",
  selectGroup: "Seleziona gruppo",
  firstName: "Nome",
  lastName: "Cognome",
  email: "Email",
  phone: "Telefono",
  birthDate: "Data di nascita",
  language: "Lingua",
  internalNote: "Nota interna",
  consent: "Ho il consenso della persona iscritta al trattamento dei dati per questa iscrizione.",
  filters: {
    search: "Cerca partecipante",
    searchPlaceholder: "Nome, email, telefono, codice",
    status: "Stato",
    sort: "Ordina per",
    apply: "Applica",
    reset: "Azzera",
    empty: "Nessun partecipante con questi filtri.",
  },
  filterLabels: {
    all: "Tutti",
    "to-review": "Da verificare",
    probable: "Probabili",
    confirmed: "Confermati",
    rejected: "Rifiutati",
  },
  sortLabels: {
    name: "Nome",
    updated: "Aggiornamento recente",
    submitted: "Iscrizione recente",
    status: "Stato",
  },
  table: {
    participant: "Partecipante",
    contacts: "Contatti",
    group: "Gruppo",
    origin: "Provenienza",
    registration: "Iscrizione",
    status: "Stato",
    actions: "Azioni",
    withoutCode: "Senza codice",
    bornOn: (date) => `nato/a il ${date}`,
    emailMissing: "Email non indicata",
    phoneMissing: "Telefono non indicato",
    updated: (date) => `aggiornata ${date}`,
    unread: "Da leggere",
    openCard: "Scheda",
    openCardAria: (name, code) => `Apri scheda di ${name}${code ? ` ${code}` : ""}`,
    manage: "Gestisci",
    manageAria: (name, code) => `Gestisci ${name}${code ? ` ${code}` : ""}`,
    saveNote: "Salva nota",
    confirm: "Conferma",
    reject: "Non riconosciuto",
    markRead: "Segna letta",
  },
  detail: {
    title: "Scheda partecipante",
    identity: "Identità",
    contacts: "Contatti",
    group: "Gruppo",
    assignment: "Assegnazione",
    notes: "Note interne",
    noNote: "Nessuna nota interna.",
    publicCode: "Codice",
    registrationStatus: "Stato iscrizione",
    submittedAt: "Iscrizione",
    updatedAt: "Ultimo aggiornamento",
    decisionAt: "Decisione",
    escalationDepth: "Passaggi di risalita",
    participatesWithGroup: "Dichiara di partecipare con un gruppo",
    yes: "Sì",
    no: "No",
    unknown: "Non indicato",
  },
  attendance: {
    title: "Presenza",
    help: "Se conosci già i giorni di presenza, selezionali. Altrimenti lascia indicato che saranno confermati più avanti.",
    noDates: "Date dell'evento non disponibili.",
    unknown: "Non lo so ancora, sarà confermato più avanti",
  },
  accessibility: {
    title: "Accessibilità e supporto",
    help: "Compila solo le informazioni che conosci. Potranno essere completate più avanti.",
    question: "La persona ha bisogni di accessibilità?",
    unknown: "Non so / da verificare",
    no: "No",
    yes: "Sì",
    needsSupport: "Serve ricontattare la persona o organizzare un supporto pratico.",
    notes: "Indicazioni pratiche",
  },
  statusLabels: {
    confirmed: "Confermato",
    rejected: "Rifiutato",
    superseded: "Superato",
    probable: "Probabile",
    active: (date) => `Attivo dal ${date}`,
    expired: "Scaduto",
    revoked: "Revocato",
    exhausted: "Usi esauriti",
  },
  sourceLabels: {
    participantSelected: "Scelta partecipante",
    rule: "Regola",
    capogruppo: "Referente",
    manager: "Manager",
    admin: "Admin",
  },
  assignmentReasonLabels: {
    participantSelectedGroup: "gruppo indicato nel form",
    groupRegistrationLink: "link riservato di iscrizione",
    newcomerTerritorialFallback: "nuovo partecipante assegnato per territorio",
    participantCannotFindLeader: "referente non trovato nel form",
    santegidioTerritorialFallback: "assegnazione territoriale probabile",
    groupLeaderRejectedEscalatedToParent: "rifiuto risalito al nodo superiore",
    groupLeaderManualEntry: "inserimento manuale del referente",
    adminUpdatedGroup: "assegnato da admin",
    managerUpdatedGroup: "assegnato da manager",
    capogruppoUpdatedGroup: "assegnato dal referente",
  },
};

const EN_GROUP_LEADER_COPY: GroupLeaderCopy = {
  ...IT_GROUP_LEADER_COPY,
  srTitle: "Group leader dashboard",
  areaDescription:
    "In this area you can review the assignments for your groups, confirm participants or send them back to the higher level.",
  saved: "Update saved.",
  errorPrefix: "Operation not completed",
  yourGroups: "Your groups",
  yourGroupsHelp: "These are the groups linked to your group leader account.",
  registrableCount: (count) => `${count} can receive registrations`,
  canRegister: "Can receive registrations",
  cannotRegister: "Not available for registrations",
  publicVisible: "Visible in the public form",
  publicHidden: "Not visible in the public form",
  leader: "contact person",
  generateLink: "Generate link",
  addParticipant: "Add participant",
  inactiveGroupHelp:
    "This group is linked to your account, but it is not active in the operational catalogue. Before using links or manual entries, a manager/admin needs to reactivate it or connect you to the correct group.",
  noGroups: "No group is linked to your account.",
  close: "Close",
  participantsTitle: "Group participants",
  participantsHelp:
    "Here you can find the people linked to the groups you manage. Group decisions are internal and do not send automatic messages to the participant.",
  linkTitle: "Group registration link",
  linkHelp:
    "You can generate reserved links only for the groups you manage. These links do not make the group visible in the public menu.",
  visibleInForm: "Visible in the form",
  hidden: "Hidden",
  leaderMissing: "to be assigned",
  formPublicName: "Name shown in the form",
  notSet: "not set",
  eventFallback: "Event",
  groupFallback: "Unnamed group",
  participantFallback: "Unnamed participant",
  notProvided: "Not provided",
  justCreatedLink: "Newly generated link",
  unlabeledLink: "Unlabelled link",
  uses: "uses",
  revoke: "Revoke",
  noActiveLinks: "No active link.",
  publicLabel: "Name shown to registrants",
  publicLabelHelp:
    "Optional. If filled in, people opening this link will see this name instead of the internal group name.",
  internalLabel: "Reminder for you",
  internalLabelPlaceholder: "For example: link sent on WhatsApp",
  internalLabelHelp:
    "It is not shown to participants. It only helps you recognise this link in the dashboard.",
  noRegistrableGroups: "None of the groups you manage can receive registrations right now.",
  manualTitle: "Manual entry",
  manualHelp:
    "Add a person directly to one of the groups you manage. The person is immediately confirmed in the selected group.",
  group: "Group",
  selectGroup: "Select group",
  firstName: "First name",
  lastName: "Last name",
  phone: "Phone",
  birthDate: "Date of birth",
  language: "Language",
  internalNote: "Internal note",
  consent: "I have the registered person's consent to process data for this registration.",
  filters: {
    search: "Search participant",
    searchPlaceholder: "Name, email, phone, code",
    status: "Status",
    sort: "Sort by",
    apply: "Apply",
    reset: "Reset",
    empty: "No participant matches these filters.",
  },
  filterLabels: {
    all: "All",
    "to-review": "To review",
    probable: "Probable",
    confirmed: "Confirmed",
    rejected: "Rejected",
  },
  sortLabels: {
    name: "Name",
    updated: "Recently updated",
    submitted: "Recent registration",
    status: "Status",
  },
  table: {
    participant: "Participant",
    contacts: "Contacts",
    group: "Group",
    origin: "Origin",
    registration: "Registration",
    status: "Status",
    actions: "Actions",
    withoutCode: "No code",
    bornOn: (date) => `born on ${date}`,
    emailMissing: "Email not provided",
    phoneMissing: "Phone not provided",
    updated: (date) => `updated ${date}`,
    unread: "Unread",
    openCard: "Card",
    openCardAria: (name, code) => `Open ${name}${code ? ` ${code}` : ""} card`,
    manage: "Manage",
    manageAria: (name, code) => `Manage ${name}${code ? ` ${code}` : ""}`,
    saveNote: "Save note",
    confirm: "Confirm",
    reject: "Not recognised",
    markRead: "Mark as read",
  },
  detail: {
    title: "Participant card",
    identity: "Identity",
    contacts: "Contacts",
    group: "Group",
    assignment: "Assignment",
    notes: "Internal notes",
    noNote: "No internal note.",
    publicCode: "Code",
    registrationStatus: "Registration status",
    submittedAt: "Registration",
    updatedAt: "Last update",
    decisionAt: "Decision",
    escalationDepth: "Escalation steps",
    participatesWithGroup: "Says they participate with a group",
    yes: "Yes",
    no: "No",
    unknown: "Not provided",
  },
  attendance: {
    title: "Attendance",
    help: "If you already know the attendance days, select them. Otherwise leave the indication that they will be confirmed later.",
    noDates: "Event dates are not available.",
    unknown: "I do not know yet; it will be confirmed later",
  },
  accessibility: {
    title: "Accessibility and support",
    help: "Fill in only the information you know. It can be completed later.",
    question: "Does the person have accessibility needs?",
    unknown: "I do not know / to be checked",
    no: "No",
    yes: "Yes",
    needsSupport: "The person should be contacted again or practical support should be organised.",
    notes: "Practical notes",
  },
  statusLabels: {
    confirmed: "Confirmed",
    rejected: "Rejected",
    superseded: "Superseded",
    probable: "Probable",
    active: (date) => `Active since ${date}`,
    expired: "Expired",
    revoked: "Revoked",
    exhausted: "Uses exhausted",
  },
  sourceLabels: {
    participantSelected: "Participant choice",
    rule: "Rule",
    capogruppo: "Group leader",
    manager: "Manager",
    admin: "Admin",
  },
  assignmentReasonLabels: {
    participantSelectedGroup: "group indicated in the form",
    groupRegistrationLink: "reserved registration link",
    newcomerTerritorialFallback: "new participant assigned by territory",
    participantCannotFindLeader: "contact person not found in the form",
    santegidioTerritorialFallback: "probable territorial assignment",
    groupLeaderRejectedEscalatedToParent: "rejection escalated to the parent node",
    groupLeaderManualEntry: "manual entry by the group leader",
    adminUpdatedGroup: "assigned by admin",
    managerUpdatedGroup: "assigned by manager",
    capogruppoUpdatedGroup: "assigned by the group leader",
  },
};

const GROUP_LEADER_COPY: Record<SupportedLocale, GroupLeaderCopy> = {
  it: IT_GROUP_LEADER_COPY,
  en: EN_GROUP_LEADER_COPY,
  fr: {
    ...EN_GROUP_LEADER_COPY,
    srTitle: "Dashboard responsable de groupe",
    areaDescription:
      "Dans cet espace, tu peux vérifier les affectations de tes groupes, confirmer les participants ou les renvoyer au niveau supérieur.",
    yourGroups: "Tes groupes",
    yourGroupsHelp: "Voici les groupes reliés à ton compte de responsable de groupe.",
    registrableCount: (count) => `${count} peuvent recevoir des inscriptions`,
    canRegister: "Peut recevoir des inscriptions",
    cannotRegister: "Non disponible pour les inscriptions",
    publicVisible: "Visible dans le formulaire public",
    publicHidden: "Non visible dans le formulaire public",
    leader: "référent",
    participantsTitle: "Participants du groupe",
    participantsHelp:
      "Tu trouves ici les personnes reliées aux groupes que tu gères. Les décisions sur le groupe sont internes et n'envoient pas de message automatique au participant.",
    generateLink: "Générer un lien",
    addParticipant: "Ajouter un participant",
    inactiveGroupHelp:
      "Ce groupe est relié à ton compte, mais il n'est pas actif dans le catalogue opérationnel. Avant d'utiliser des liens ou des ajouts manuels, un manager/admin doit le réactiver ou te relier au bon groupe.",
    noGroups: "Aucun groupe n'est relié à ton compte.",
    manualTitle: "Ajout manuel",
    manualHelp:
      "Ajoute une personne directement à l'un des groupes que tu gères. La personne est immédiatement confirmée dans le groupe choisi.",
    linkTitle: "Lien d'inscription du groupe",
    linkHelp:
      "Tu peux générer des liens réservés uniquement pour les groupes que tu gères. Ces liens ne rendent pas le groupe visible dans le menu public.",
    close: "Fermer",
    saved: "Modification enregistrée.",
    errorPrefix: "Opération non terminée",
    visibleInForm: "Visible dans le formulaire",
    hidden: "Masqué",
    leaderMissing: "à attribuer",
    formPublicName: "Nom affiché dans le formulaire",
    notSet: "non défini",
    eventFallback: "Événement",
    groupFallback: "Groupe sans nom",
    participantFallback: "Participant sans nom",
    notProvided: "Non indiqué",
    justCreatedLink: "Lien tout juste généré",
    unlabeledLink: "Lien sans libellé",
    uses: "utilisations",
    revoke: "Révoquer",
    noActiveLinks: "Aucun lien actif.",
    publicLabel: "Nom affiché à la personne qui s'inscrit",
    publicLabelHelp:
      "Optionnel. Si ce champ est rempli, les personnes qui ouvrent ce lien verront ce nom à la place du nom interne du groupe.",
    internalLabel: "Mémo pour toi",
    internalLabelPlaceholder: "Par exemple : lien envoyé sur WhatsApp",
    internalLabelHelp:
      "Il n'est pas affiché aux participants. Il sert seulement à reconnaître ce lien dans le tableau de bord.",
    noRegistrableGroups: "Aucun des groupes que tu gères ne peut recevoir d'inscriptions pour le moment.",
    group: "Groupe",
    selectGroup: "Sélectionner un groupe",
    firstName: "Prénom",
    lastName: "Nom",
    phone: "Téléphone",
    birthDate: "Date de naissance",
    language: "Langue",
    internalNote: "Note interne",
    consent: "J'ai le consentement de la personne inscrite pour traiter les données de cette inscription.",
    filters: {
      search: "Chercher un participant",
      searchPlaceholder: "Nom, email, téléphone, code",
      status: "État",
      sort: "Trier par",
      apply: "Appliquer",
      reset: "Réinitialiser",
      empty: "Aucun participant avec ces filtres.",
    },
    filterLabels: {
      all: "Tous",
      "to-review": "À vérifier",
      probable: "Probables",
      confirmed: "Confirmés",
      rejected: "Refusés",
    },
    sortLabels: {
      name: "Nom",
      updated: "Mise à jour récente",
      submitted: "Inscription récente",
      status: "État",
    },
    table: {
      ...EN_GROUP_LEADER_COPY.table,
      participant: "Participant",
      contacts: "Contacts",
      group: "Groupe",
      origin: "Provenance",
      registration: "Inscription",
      status: "État",
      actions: "Actions",
      withoutCode: "Sans code",
      bornOn: (date) => `né(e) le ${date}`,
      emailMissing: "Email non indiqué",
      phoneMissing: "Téléphone non indiqué",
      updated: (date) => `mise à jour ${date}`,
      unread: "À lire",
      manage: "Gérer",
      manageAria: (name, code) => `Gérer ${name}${code ? ` ${code}` : ""}`,
      saveNote: "Enregistrer la note",
      confirm: "Confirmer",
      reject: "Non reconnu",
      markRead: "Marquer comme lu",
    },
    attendance: {
      title: "Présence",
      help: "Si tu connais déjà les jours de présence, sélectionne-les. Sinon laisse indiqué qu'ils seront confirmés plus tard.",
      noDates: "Dates de l'événement non disponibles.",
      unknown: "Je ne sais pas encore, ce sera confirmé plus tard",
    },
    accessibility: {
      title: "Accessibilité et support",
      help: "Remplis seulement les informations que tu connais. Elles pourront être complétées plus tard.",
      question: "La personne a-t-elle des besoins d'accessibilité ?",
      unknown: "Je ne sais pas / à vérifier",
      no: "Non",
      yes: "Oui",
      needsSupport: "Il faut recontacter la personne ou organiser un support pratique.",
      notes: "Indications pratiques",
    },
    statusLabels: {
      confirmed: "Confirmé",
      rejected: "Refusé",
      superseded: "Remplacé",
      probable: "Probable",
      active: (date) => `Actif depuis ${date}`,
      expired: "Expiré",
      revoked: "Révoqué",
      exhausted: "Utilisations épuisées",
    },
    sourceLabels: {
      participantSelected: "Choix du participant",
      rule: "Règle",
      capogruppo: "Responsable de groupe",
      manager: "Manager",
      admin: "Admin",
    },
    assignmentReasonLabels: {
      participantSelectedGroup: "groupe indiqué dans le formulaire",
      groupRegistrationLink: "lien réservé d'inscription",
      newcomerTerritorialFallback: "nouveau participant affecté par territoire",
      participantCannotFindLeader: "référent non trouvé dans le formulaire",
      santegidioTerritorialFallback: "affectation territoriale probable",
      groupLeaderRejectedEscalatedToParent: "refus remonté au niveau supérieur",
      groupLeaderManualEntry: "ajout manuel par le responsable",
      adminUpdatedGroup: "affecté par l'admin",
      managerUpdatedGroup: "affecté par le manager",
      capogruppoUpdatedGroup: "affecté par le responsable",
    },
  },
  de: {
    ...EN_GROUP_LEADER_COPY,
    srTitle: "Dashboard Gruppenleitung",
    areaDescription:
      "In diesem Bereich kannst du die Zuordnungen deiner Gruppen prüfen, Teilnehmende bestätigen oder an die höhere Ebene zurückgeben.",
    yourGroups: "Deine Gruppen",
    yourGroupsHelp: "Das sind die Gruppen, die mit deinem Gruppenleitungs-Konto verbunden sind.",
    registrableCount: (count) => `${count} können Anmeldungen erhalten`,
    canRegister: "Kann Anmeldungen erhalten",
    cannotRegister: "Nicht für Anmeldungen verfügbar",
    publicVisible: "Im öffentlichen Formular sichtbar",
    publicHidden: "Im öffentlichen Formular nicht sichtbar",
    leader: "Kontaktperson",
    participantsTitle: "Teilnehmende der Gruppe",
    participantsHelp:
      "Hier findest du die Personen, die mit den von dir verwalteten Gruppen verbunden sind. Gruppenentscheidungen sind intern und senden keine automatischen Nachrichten an die teilnehmende Person.",
    generateLink: "Link erstellen",
    addParticipant: "Teilnehmende Person hinzufügen",
    inactiveGroupHelp:
      "Diese Gruppe ist mit deinem Konto verbunden, aber im operativen Katalog nicht aktiv. Bevor Links oder manuelle Einträge verwendet werden, muss ein Manager/Admin sie reaktivieren oder dich mit der richtigen Gruppe verbinden.",
    noGroups: "Mit deinem Konto ist keine Gruppe verbunden.",
    manualTitle: "Manuelle Eingabe",
    manualHelp:
      "Füge eine Person direkt zu einer der Gruppen hinzu, die du verwaltest. Die Person ist sofort in der ausgewählten Gruppe bestätigt.",
    linkTitle: "Gruppen-Anmeldelink",
    linkHelp:
      "Du kannst reservierte Links nur für die Gruppen erstellen, die du verwaltest. Diese Links machen die Gruppe nicht im öffentlichen Menü sichtbar.",
    close: "Schließen",
    saved: "Änderung gespeichert.",
    errorPrefix: "Vorgang nicht abgeschlossen",
    visibleInForm: "Im Formular sichtbar",
    hidden: "Ausgeblendet",
    leaderMissing: "zuzuweisen",
    formPublicName: "Im Formular angezeigter Name",
    notSet: "nicht gesetzt",
    eventFallback: "Veranstaltung",
    groupFallback: "Gruppe ohne Namen",
    participantFallback: "Teilnehmende Person ohne Namen",
    notProvided: "Nicht angegeben",
    justCreatedLink: "Gerade erstellter Link",
    unlabeledLink: "Link ohne Bezeichnung",
    uses: "Nutzungen",
    revoke: "Widerrufen",
    noActiveLinks: "Kein aktiver Link.",
    publicLabel: "Name für die anmeldende Person",
    publicLabelHelp:
      "Optional. Wenn ausgefüllt, sehen Personen, die diesen Link öffnen, diesen Namen statt des internen Gruppennamens.",
    internalLabel: "Notiz für dich",
    internalLabelPlaceholder: "Zum Beispiel: Link per WhatsApp gesendet",
    internalLabelHelp:
      "Wird den Teilnehmenden nicht angezeigt. Hilft nur, diesen Link im Dashboard wiederzuerkennen.",
    noRegistrableGroups: "Keine der von dir verwalteten Gruppen kann derzeit Anmeldungen erhalten.",
    group: "Gruppe",
    selectGroup: "Gruppe auswählen",
    firstName: "Vorname",
    lastName: "Nachname",
    phone: "Telefon",
    birthDate: "Geburtsdatum",
    language: "Sprache",
    internalNote: "Interne Notiz",
    consent: "Ich habe die Zustimmung der angemeldeten Person zur Datenverarbeitung für diese Anmeldung.",
    filters: {
      search: "Teilnehmende suchen",
      searchPlaceholder: "Name, E-Mail, Telefon, Code",
      status: "Status",
      sort: "Sortieren nach",
      apply: "Anwenden",
      reset: "Zurücksetzen",
      empty: "Keine Teilnehmenden mit diesen Filtern.",
    },
    filterLabels: {
      all: "Alle",
      "to-review": "Zu prüfen",
      probable: "Wahrscheinlich",
      confirmed: "Bestätigt",
      rejected: "Abgelehnt",
    },
    sortLabels: {
      name: "Name",
      updated: "Kürzlich aktualisiert",
      submitted: "Neueste Anmeldung",
      status: "Status",
    },
    table: {
      ...EN_GROUP_LEADER_COPY.table,
      participant: "Teilnehmende Person",
      contacts: "Kontakte",
      group: "Gruppe",
      origin: "Herkunft",
      registration: "Anmeldung",
      status: "Status",
      actions: "Aktionen",
      withoutCode: "Ohne Code",
      bornOn: (date) => `geboren am ${date}`,
      emailMissing: "E-Mail nicht angegeben",
      phoneMissing: "Telefon nicht angegeben",
      updated: (date) => `aktualisiert ${date}`,
      unread: "Zu lesen",
      manage: "Verwalten",
      manageAria: (name, code) => `${name}${code ? ` ${code}` : ""} verwalten`,
      saveNote: "Notiz speichern",
      confirm: "Bestätigen",
      reject: "Nicht erkannt",
      markRead: "Als gelesen markieren",
    },
    attendance: {
      title: "Anwesenheit",
      help: "Wenn du die Anwesenheitstage bereits kennst, wähle sie aus. Andernfalls lasse angegeben, dass sie später bestätigt werden.",
      noDates: "Veranstaltungsdaten nicht verfügbar.",
      unknown: "Ich weiß es noch nicht, es wird später bestätigt",
    },
    accessibility: {
      title: "Barrierefreiheit und Unterstützung",
      help: "Fülle nur die Informationen aus, die du kennst. Sie können später ergänzt werden.",
      question: "Hat die Person Barrierefreiheitsbedarfe?",
      unknown: "Ich weiß es nicht / zu prüfen",
      no: "Nein",
      yes: "Ja",
      needsSupport: "Die Person sollte erneut kontaktiert oder praktische Unterstützung organisiert werden.",
      notes: "Praktische Hinweise",
    },
    statusLabels: {
      confirmed: "Bestätigt",
      rejected: "Abgelehnt",
      superseded: "Überholt",
      probable: "Wahrscheinlich",
      active: (date) => `Aktiv seit ${date}`,
      expired: "Abgelaufen",
      revoked: "Widerrufen",
      exhausted: "Nutzungen ausgeschöpft",
    },
    sourceLabels: {
      participantSelected: "Auswahl der teilnehmenden Person",
      rule: "Regel",
      capogruppo: "Gruppenleitung",
      manager: "Manager",
      admin: "Admin",
    },
    assignmentReasonLabels: {
      participantSelectedGroup: "im Formular angegebene Gruppe",
      groupRegistrationLink: "reservierter Anmeldelink",
      newcomerTerritorialFallback: "neue teilnehmende Person nach Gebiet zugeordnet",
      participantCannotFindLeader: "Kontaktperson im Formular nicht gefunden",
      santegidioTerritorialFallback: "wahrscheinliche territoriale Zuordnung",
      groupLeaderRejectedEscalatedToParent: "Ablehnung an die übergeordnete Ebene weitergegeben",
      groupLeaderManualEntry: "manuelle Eingabe durch die Gruppenleitung",
      adminUpdatedGroup: "vom Admin zugeordnet",
      managerUpdatedGroup: "vom Manager zugeordnet",
      capogruppoUpdatedGroup: "von der Gruppenleitung zugeordnet",
    },
  },
  es: {
    ...EN_GROUP_LEADER_COPY,
    srTitle: "Panel responsable de grupo",
    areaDescription:
      "En esta área puedes revisar las asignaciones de tus grupos, confirmar participantes o devolverlos al nivel superior.",
    yourGroups: "Tus grupos",
    yourGroupsHelp: "Estos son los grupos vinculados a tu cuenta de responsable de grupo.",
    registrableCount: (count) => `${count} pueden recibir inscripciones`,
    canRegister: "Puede recibir inscripciones",
    cannotRegister: "No disponible para inscripciones",
    publicVisible: "Visible en el formulario público",
    publicHidden: "No visible en el formulario público",
    leader: "referente",
    participantsTitle: "Participantes del grupo",
    participantsHelp:
      "Aquí encuentras las personas vinculadas a los grupos que gestionas. Las decisiones sobre el grupo son internas y no envían mensajes automáticos al participante.",
    generateLink: "Generar enlace",
    addParticipant: "Añadir participante",
    inactiveGroupHelp:
      "Este grupo está vinculado a tu cuenta, pero no está activo en el catálogo operativo. Antes de usar enlaces o entradas manuales, un manager/admin debe reactivarlo o conectarte al grupo correcto.",
    noGroups: "Ningún grupo está vinculado a tu cuenta.",
    manualTitle: "Entrada manual",
    manualHelp:
      "Añade una persona directamente a uno de los grupos que gestionas. La persona queda inmediatamente confirmada en el grupo elegido.",
    linkTitle: "Enlace de inscripción del grupo",
    linkHelp:
      "Puedes generar enlaces reservados solo para los grupos que gestionas. Estos enlaces no hacen que el grupo sea visible en el menú público.",
    close: "Cerrar",
    saved: "Cambios guardados.",
    errorPrefix: "Operación no completada",
    visibleInForm: "Visible en el formulario",
    hidden: "Oculto",
    leaderMissing: "por asignar",
    formPublicName: "Nombre mostrado en el formulario",
    notSet: "no indicado",
    eventFallback: "Evento",
    groupFallback: "Grupo sin nombre",
    participantFallback: "Participante sin nombre",
    notProvided: "No indicado",
    justCreatedLink: "Enlace recién generado",
    unlabeledLink: "Enlace sin etiqueta",
    uses: "usos",
    revoke: "Revocar",
    noActiveLinks: "Ningún enlace activo.",
    publicLabel: "Nombre mostrado a quien se inscribe",
    publicLabelHelp:
      "Opcional. Si se completa, quien abra este enlace verá este nombre en lugar del nombre interno del grupo.",
    internalLabel: "Recordatorio para ti",
    internalLabelPlaceholder: "Por ejemplo: enlace enviado por WhatsApp",
    internalLabelHelp:
      "No se muestra a los participantes. Sirve solo para reconocer este enlace en el panel.",
    noRegistrableGroups: "Ninguno de los grupos que gestionas puede recibir inscripciones en este momento.",
    group: "Grupo",
    selectGroup: "Selecciona grupo",
    firstName: "Nombre",
    lastName: "Apellidos",
    phone: "Teléfono",
    birthDate: "Fecha de nacimiento",
    language: "Idioma",
    internalNote: "Nota interna",
    consent: "Tengo el consentimiento de la persona inscrita para tratar los datos de esta inscripción.",
    filters: {
      search: "Buscar participante",
      searchPlaceholder: "Nombre, email, teléfono, código",
      status: "Estado",
      sort: "Ordenar por",
      apply: "Aplicar",
      reset: "Restablecer",
      empty: "Ningún participante con estos filtros.",
    },
    filterLabels: {
      all: "Todos",
      "to-review": "Por revisar",
      probable: "Probables",
      confirmed: "Confirmados",
      rejected: "Rechazados",
    },
    sortLabels: {
      name: "Nombre",
      updated: "Actualización reciente",
      submitted: "Inscripción reciente",
      status: "Estado",
    },
    table: {
      ...EN_GROUP_LEADER_COPY.table,
      participant: "Participante",
      contacts: "Contactos",
      group: "Grupo",
      origin: "Procedencia",
      registration: "Inscripción",
      status: "Estado",
      actions: "Acciones",
      withoutCode: "Sin código",
      bornOn: (date) => `nacido/a el ${date}`,
      emailMissing: "Email no indicado",
      phoneMissing: "Teléfono no indicado",
      updated: (date) => `actualizada ${date}`,
      unread: "Por leer",
      manage: "Gestionar",
      manageAria: (name, code) => `Gestionar ${name}${code ? ` ${code}` : ""}`,
      saveNote: "Guardar nota",
      confirm: "Confirmar",
      reject: "No reconocido",
      markRead: "Marcar como leída",
    },
    attendance: {
      title: "Presencia",
      help: "Si ya conoces los días de presencia, selecciónalos. Si no, deja indicado que se confirmarán más adelante.",
      noDates: "Fechas del evento no disponibles.",
      unknown: "Todavía no lo sé, se confirmará más adelante",
    },
    accessibility: {
      title: "Accesibilidad y apoyo",
      help: "Completa solo la información que conoces. Podrá completarse más adelante.",
      question: "¿La persona tiene necesidades de accesibilidad?",
      unknown: "No lo sé / por verificar",
      no: "No",
      yes: "Sí",
      needsSupport: "Hay que volver a contactar a la persona u organizar apoyo práctico.",
      notes: "Indicaciones prácticas",
    },
    statusLabels: {
      confirmed: "Confirmado",
      rejected: "Rechazado",
      superseded: "Sustituido",
      probable: "Probable",
      active: (date) => `Activo desde ${date}`,
      expired: "Caducado",
      revoked: "Revocado",
      exhausted: "Usos agotados",
    },
    sourceLabels: {
      participantSelected: "Elección del participante",
      rule: "Regla",
      capogruppo: "Responsable de grupo",
      manager: "Manager",
      admin: "Admin",
    },
    assignmentReasonLabels: {
      participantSelectedGroup: "grupo indicado en el formulario",
      groupRegistrationLink: "enlace reservado de inscripción",
      newcomerTerritorialFallback: "nuevo participante asignado por territorio",
      participantCannotFindLeader: "referente no encontrado en el formulario",
      santegidioTerritorialFallback: "asignación territorial probable",
      groupLeaderRejectedEscalatedToParent: "rechazo elevado al nivel superior",
      groupLeaderManualEntry: "entrada manual del responsable",
      adminUpdatedGroup: "asignado por admin",
      managerUpdatedGroup: "asignado por manager",
      capogruppoUpdatedGroup: "asignado por el responsable",
    },
  },
  nl: {
    ...EN_GROUP_LEADER_COPY,
    srTitle: "Dashboard groepsleider",
    areaDescription:
      "In deze omgeving kun je de toewijzingen van je groepen controleren, deelnemers bevestigen of terugsturen naar het hogere niveau.",
    yourGroups: "Je groepen",
    yourGroupsHelp: "Dit zijn de groepen die aan je groepsleidersaccount zijn gekoppeld.",
    registrableCount: (count) => `${count} kunnen inschrijvingen ontvangen`,
    canRegister: "Kan inschrijvingen ontvangen",
    cannotRegister: "Niet beschikbaar voor inschrijvingen",
    publicVisible: "Zichtbaar in het publieke formulier",
    publicHidden: "Niet zichtbaar in het publieke formulier",
    leader: "contactpersoon",
    participantsTitle: "Deelnemers van de groep",
    participantsHelp:
      "Hier vind je de mensen die gekoppeld zijn aan de groepen die je beheert. Beslissingen over de groep zijn intern en sturen geen automatische berichten naar de deelnemer.",
    generateLink: "Link genereren",
    addParticipant: "Deelnemer toevoegen",
    inactiveGroupHelp:
      "Deze groep is gekoppeld aan je account, maar is niet actief in de operationele catalogus. Voordat je links of handmatige invoer gebruikt, moet een manager/admin de groep opnieuw activeren of je aan de juiste groep koppelen.",
    noGroups: "Er is geen groep aan je account gekoppeld.",
    manualTitle: "Handmatige invoer",
    manualHelp:
      "Voeg een persoon rechtstreeks toe aan een van de groepen die je beheert. De persoon is meteen bevestigd in de gekozen groep.",
    linkTitle: "Inschrijflink groep",
    linkHelp:
      "Je kunt alleen gereserveerde links genereren voor groepen die je beheert. Deze links maken de groep niet zichtbaar in het publieke menu.",
    close: "Sluiten",
    saved: "Wijziging opgeslagen.",
    errorPrefix: "Bewerking niet voltooid",
    visibleInForm: "Zichtbaar in het formulier",
    hidden: "Verborgen",
    leaderMissing: "toe te wijzen",
    formPublicName: "Naam getoond in het formulier",
    notSet: "niet ingesteld",
    eventFallback: "Evenement",
    groupFallback: "Groep zonder naam",
    participantFallback: "Deelnemer zonder naam",
    notProvided: "Niet opgegeven",
    justCreatedLink: "Zojuist gegenereerde link",
    unlabeledLink: "Link zonder label",
    uses: "gebruiken",
    revoke: "Intrekken",
    noActiveLinks: "Geen actieve link.",
    publicLabel: "Naam getoond aan wie zich inschrijft",
    publicLabelHelp:
      "Optioneel. Als dit is ingevuld, zien mensen die deze link openen deze naam in plaats van de interne groepsnaam.",
    internalLabel: "Herinnering voor jou",
    internalLabelPlaceholder: "Bijvoorbeeld: link gestuurd via WhatsApp",
    internalLabelHelp:
      "Wordt niet aan deelnemers getoond. Het helpt alleen om deze link in het dashboard te herkennen.",
    noRegistrableGroups: "Geen van de groepen die je beheert kan momenteel inschrijvingen ontvangen.",
    group: "Groep",
    selectGroup: "Selecteer groep",
    firstName: "Voornaam",
    lastName: "Achternaam",
    phone: "Telefoon",
    birthDate: "Geboortedatum",
    language: "Taal",
    internalNote: "Interne notitie",
    consent: "Ik heb toestemming van de ingeschreven persoon om gegevens voor deze inschrijving te verwerken.",
    filters: {
      search: "Deelnemer zoeken",
      searchPlaceholder: "Naam, e-mail, telefoon, code",
      status: "Status",
      sort: "Sorteren op",
      apply: "Toepassen",
      reset: "Wissen",
      empty: "Geen deelnemer met deze filters.",
    },
    filterLabels: {
      all: "Alle",
      "to-review": "Te controleren",
      probable: "Waarschijnlijk",
      confirmed: "Bevestigd",
      rejected: "Afgewezen",
    },
    sortLabels: {
      name: "Naam",
      updated: "Recent bijgewerkt",
      submitted: "Recente inschrijving",
      status: "Status",
    },
    table: {
      ...EN_GROUP_LEADER_COPY.table,
      participant: "Deelnemer",
      contacts: "Contacten",
      group: "Groep",
      origin: "Herkomst",
      registration: "Inschrijving",
      status: "Status",
      actions: "Acties",
      withoutCode: "Zonder code",
      bornOn: (date) => `geboren op ${date}`,
      emailMissing: "E-mail niet opgegeven",
      phoneMissing: "Telefoon niet opgegeven",
      updated: (date) => `bijgewerkt ${date}`,
      unread: "Te lezen",
      manage: "Beheren",
      manageAria: (name, code) => `${name}${code ? ` ${code}` : ""} beheren`,
      saveNote: "Notitie opslaan",
      confirm: "Bevestigen",
      reject: "Niet herkend",
      markRead: "Markeer als gelezen",
    },
    attendance: {
      title: "Aanwezigheid",
      help: "Als je de aanwezigheidsdagen al kent, selecteer ze. Laat anders staan dat ze later worden bevestigd.",
      noDates: "Evenementdata niet beschikbaar.",
      unknown: "Ik weet het nog niet, het wordt later bevestigd",
    },
    accessibility: {
      title: "Toegankelijkheid en ondersteuning",
      help: "Vul alleen de informatie in die je kent. Die kan later worden aangevuld.",
      question: "Heeft de persoon toegankelijkheidsbehoeften?",
      unknown: "Ik weet het niet / te controleren",
      no: "Nee",
      yes: "Ja",
      needsSupport: "De persoon moet opnieuw worden gecontacteerd of praktische ondersteuning moet worden georganiseerd.",
      notes: "Praktische aanwijzingen",
    },
    statusLabels: {
      confirmed: "Bevestigd",
      rejected: "Afgewezen",
      superseded: "Vervangen",
      probable: "Waarschijnlijk",
      active: (date) => `Actief sinds ${date}`,
      expired: "Verlopen",
      revoked: "Ingetrokken",
      exhausted: "Gebruikslimiet bereikt",
    },
    sourceLabels: {
      participantSelected: "Keuze van de deelnemer",
      rule: "Regel",
      capogruppo: "Groepsleider",
      manager: "Manager",
      admin: "Admin",
    },
    assignmentReasonLabels: {
      participantSelectedGroup: "groep aangegeven in het formulier",
      groupRegistrationLink: "gereserveerde inschrijflink",
      newcomerTerritorialFallback: "nieuwe deelnemer toegewezen op basis van gebied",
      participantCannotFindLeader: "contactpersoon niet gevonden in het formulier",
      santegidioTerritorialFallback: "waarschijnlijke territoriale toewijzing",
      groupLeaderRejectedEscalatedToParent: "afwijzing doorgestuurd naar hoger niveau",
      groupLeaderManualEntry: "handmatige invoer door de groepsleider",
      adminUpdatedGroup: "toegewezen door admin",
      managerUpdatedGroup: "toegewezen door manager",
      capogruppoUpdatedGroup: "toegewezen door de groepsleider",
    },
  },
  uk: {
    ...EN_GROUP_LEADER_COPY,
    srTitle: "Панель керівника групи",
    areaDescription:
      "У цій зоні можна перевірити призначення ваших груп, підтвердити учасників або повернути їх на вищий рівень.",
    yourGroups: "Ваші групи",
    yourGroupsHelp: "Це групи, пов'язані з вашим обліковим записом керівника групи.",
    registrableCount: (count) => `${count} можуть приймати реєстрації`,
    canRegister: "Може приймати реєстрації",
    cannotRegister: "Недоступно для реєстрацій",
    publicVisible: "Видно в публічній формі",
    publicHidden: "Не видно в публічній формі",
    leader: "відповідальна особа",
    participantsTitle: "Учасники групи",
    participantsHelp:
      "Тут можна знайти людей, пов'язаних із групами, якими ви керуєте. Рішення щодо групи є внутрішніми і не надсилають автоматичних повідомлень учаснику.",
    generateLink: "Створити посилання",
    addParticipant: "Додати учасника",
    inactiveGroupHelp:
      "Ця група пов'язана з вашим обліковим записом, але не активна в робочому каталозі. Перед використанням посилань або ручного додавання manager/admin має повторно активувати її або прив'язати вас до правильної групи.",
    noGroups: "До вашого облікового запису не прив'язано жодної групи.",
    manualTitle: "Ручне додавання",
    manualHelp:
      "Додайте людину безпосередньо до однієї з груп, якими ви керуєте. Людина одразу буде підтверджена у вибраній групі.",
    linkTitle: "Посилання для реєстрації групи",
    linkHelp:
      "Ви можете створювати зарезервовані посилання лише для груп, якими керуєте. Ці посилання не роблять групу видимою в публічному меню.",
    close: "Закрити",
    saved: "Зміни збережено.",
    errorPrefix: "Операцію не завершено",
    visibleInForm: "Видно у формі",
    hidden: "Приховано",
    leaderMissing: "потрібно призначити",
    formPublicName: "Назва, показана у формі",
    notSet: "не вказано",
    eventFallback: "Подія",
    groupFallback: "Група без назви",
    participantFallback: "Учасник без імені",
    notProvided: "Не вказано",
    justCreatedLink: "Щойно створене посилання",
    unlabeledLink: "Посилання без мітки",
    uses: "використань",
    revoke: "Відкликати",
    noActiveLinks: "Немає активних посилань.",
    publicLabel: "Назва, показана тому, хто реєструється",
    publicLabelHelp:
      "Необов'язково. Якщо заповнити, люди, які відкриють це посилання, побачать цю назву замість внутрішньої назви групи.",
    internalLabel: "Нагадування для вас",
    internalLabelPlaceholder: "Наприклад: посилання надіслано у WhatsApp",
    internalLabelHelp:
      "Не показується учасникам. Потрібно лише для розпізнавання цього посилання на панелі.",
    noRegistrableGroups: "Жодна з груп, якими ви керуєте, зараз не може приймати реєстрації.",
    group: "Група",
    selectGroup: "Виберіть групу",
    firstName: "Ім'я",
    lastName: "Прізвище",
    phone: "Телефон",
    birthDate: "Дата народження",
    language: "Мова",
    internalNote: "Внутрішня нотатка",
    consent: "Я маю згоду зареєстрованої особи на обробку даних для цієї реєстрації.",
    filters: {
      search: "Шукати учасника",
      searchPlaceholder: "Ім'я, email, телефон, код",
      status: "Стан",
      sort: "Сортувати за",
      apply: "Застосувати",
      reset: "Скинути",
      empty: "Немає учасників за цими фільтрами.",
    },
    filterLabels: {
      all: "Усі",
      "to-review": "Перевірити",
      probable: "Ймовірні",
      confirmed: "Підтверджені",
      rejected: "Відхилені",
    },
    sortLabels: {
      name: "Ім'я",
      updated: "Нещодавно оновлені",
      submitted: "Нещодавня реєстрація",
      status: "Стан",
    },
    table: {
      ...EN_GROUP_LEADER_COPY.table,
      participant: "Учасник",
      contacts: "Контакти",
      group: "Група",
      origin: "Походження",
      registration: "Реєстрація",
      status: "Стан",
      actions: "Дії",
      withoutCode: "Без коду",
      bornOn: (date) => `народж. ${date}`,
      emailMissing: "Email не вказано",
      phoneMissing: "Телефон не вказано",
      updated: (date) => `оновлено ${date}`,
      unread: "Прочитати",
      manage: "Керувати",
      manageAria: (name, code) => `Керувати ${name}${code ? ` ${code}` : ""}`,
      saveNote: "Зберегти нотатку",
      confirm: "Підтвердити",
      reject: "Не розпізнано",
      markRead: "Позначити як прочитане",
    },
    attendance: {
      title: "Присутність",
      help: "Якщо ви вже знаєте дні присутності, виберіть їх. Інакше залиште позначку, що їх буде підтверджено пізніше.",
      noDates: "Дати події недоступні.",
      unknown: "Я ще не знаю, буде підтверджено пізніше",
    },
    accessibility: {
      title: "Доступність і підтримка",
      help: "Заповніть лише ту інформацію, яку знаєте. Її можна буде доповнити пізніше.",
      question: "Чи має особа потреби доступності?",
      unknown: "Не знаю / потрібно перевірити",
      no: "Ні",
      yes: "Так",
      needsSupport: "Потрібно повторно зв'язатися з особою або організувати практичну підтримку.",
      notes: "Практичні вказівки",
    },
    statusLabels: {
      confirmed: "Підтверджено",
      rejected: "Відхилено",
      superseded: "Замінено",
      probable: "Ймовірно",
      active: (date) => `Активне з ${date}`,
      expired: "Минув термін",
      revoked: "Відкликано",
      exhausted: "Використання вичерпано",
    },
    sourceLabels: {
      participantSelected: "Вибір учасника",
      rule: "Правило",
      capogruppo: "Керівник групи",
      manager: "Manager",
      admin: "Admin",
    },
    assignmentReasonLabels: {
      participantSelectedGroup: "групу вказано у формі",
      groupRegistrationLink: "зарезервоване реєстраційне посилання",
      newcomerTerritorialFallback: "нового учасника призначено за територією",
      participantCannotFindLeader: "відповідальну особу не знайдено у формі",
      santegidioTerritorialFallback: "ймовірне територіальне призначення",
      groupLeaderRejectedEscalatedToParent: "відмову передано на вищий рівень",
      groupLeaderManualEntry: "ручне додавання керівником групи",
      adminUpdatedGroup: "призначено admin",
      managerUpdatedGroup: "призначено manager",
      capogruppoUpdatedGroup: "призначено керівником групи",
    },
  },
};

export default async function CapogruppoDashboardPage({
  searchParams,
}: CapogruppoPageProps) {
  const locale = await getRequestLocale();
  const copy = GROUP_LEADER_COPY[locale] ?? GROUP_LEADER_COPY.en;
  const params = await searchParams;
  const filter = params.filter
    ? parseGroupLeaderReviewFilter(params.filter)
    : "all";
  const query = normalizeSearchQuery(params.q);
  const sort = parseAssignmentSort(params.sort);
  const activeTool =
    params.groupLinkToken || params.groupLinkGroupId
      ? "link"
      : parseDashboardTool(params.tool);
  const activeGroupId = params.groupLinkGroupId ?? params.groupId ?? null;
  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "capogruppo");

  if (!auth || auth.dashboardRole !== "capogruppo") {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const currentEventId = await getCurrentOperationalEventId(serviceSupabase);

  if (!currentEventId) {
    redirect("/login");
  }

  const { data: memberships } = await serviceSupabase
    .from("group_memberships")
    .select("group_id")
    .eq("user_id", auth.user.id);
  const rootGroupIds = ((memberships ?? []) as GroupMembershipRow[])
    .map((membership) => membership.group_id)
    .filter((groupId): groupId is string => Boolean(groupId));
  const { data: groups } = await serviceSupabase
    .from("groups")
    .select(
      "id,event_id,name,parent_group_id,node_type,is_assignable,is_public_catalog,is_active,public_label,primary_leader_name,events(title,starts_on,ends_on)"
    )
    .eq("event_id", currentEventId);
  const groupRows = (groups ?? []) as GroupRow[];
  const activeGroupRows = groupRows.filter((group) => group.is_active ?? true);
  const groupNodes = activeGroupRows.map<GroupTreeNode>((group) => ({
    id: group.id,
    parentGroupId: group.parent_group_id,
  }));
  const scopedGroupIds = collectDescendantGroupIds(groupNodes, rootGroupIds);

  const assignments = await getAssignments([...scopedGroupIds]);
  const operationalTags = await getOperationalTags();
  const assignedGroups = groupRows
    .filter((group) => rootGroupIds.includes(group.id))
    .map((group) => toScopedGroupView(group, copy));
  const scopedGroups = activeGroupRows
    .filter((group) => scopedGroupIds.has(group.id))
    .map((group) => toScopedGroupView(group, copy));
  const groupLinks = await getGroupLinks([...scopedGroupIds]);
  const filteredAssignments = sortAssignments(
    assignments.filter(
      (assignment) =>
        matchesGroupLeaderFilter(assignment, filter) &&
        matchesAssignmentQuery(assignment, query)
    ),
    sort,
    locale
  );
  const selectedAssignment =
    params.assignmentId
      ? assignments.find((assignment) => assignment.id === params.assignmentId) ?? null
      : null;

  return (
    <main className="app-page text-[var(--peace-ink)]">
      <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-8 sm:px-8">
        <header className="grid gap-3">
          <h1 className="sr-only">{copy.srTitle}</h1>
          <DashboardRoleTabs
            activeRole="capogruppo"
            eventRoles={auth.eventRoles}
          />
          <DashboardAreaDescription>
            {copy.areaDescription}
          </DashboardAreaDescription>
        </header>

        <StatusMessage
          error={params.error ?? params.groupLinkError}
          saved={params.saved ?? params.groupLinkSaved ?? params.manualSaved}
          copy={copy}
        />

        <StatusMessage error={params.manualError} saved={undefined} copy={copy} />

        <AssignedScopeSection
          assignedGroups={assignedGroups}
          assignableGroups={scopedGroups.filter(
            (group) => group.isActive && group.isAssignable
          )}
          copy={copy}
        />

        <section
          id="assegnazioni-gruppo"
          className="rounded-lg border border-[var(--peace-border)] bg-white p-5"
        >
          <div>
            <div>
              <h2 className="text-lg font-semibold">{copy.participantsTitle}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--peace-muted)]">
                {copy.participantsHelp}
              </p>
            </div>
          </div>

          <AssignmentFilters
            filter={filter}
            query={query}
            sort={sort}
            copy={copy}
          />

          <AssignmentsTable
            assignments={filteredAssignments}
            locale={locale}
            copy={copy}
          />
        </section>

        {activeTool ? (
          <DashboardToolOverlay title={dashboardToolTitle(activeTool, copy)} copy={copy}>
            {activeTool === "link" ? (
              <GroupLeaderLinksSection
                groups={scopedGroups}
                links={groupLinks}
                selectedGroupId={activeGroupId}
                createdGroupId={params.groupLinkGroupId ?? null}
                createdUrl={
                  params.groupLinkToken
                    ? buildGroupRegistrationUrl({
                        appUrl: getAppUrl(),
                        token: params.groupLinkToken,
                      })
                    : null
                }
                locale={locale}
                copy={copy}
              />
            ) : (
              <ManualRegistrationSection
                groups={scopedGroups}
                selectedGroupId={activeGroupId}
                eventDays={getManualRegistrationEventDays(scopedGroups, locale)}
                locale={locale}
                copy={copy}
              />
            )}
          </DashboardToolOverlay>
        ) : null}

        {selectedAssignment ? (
          <DashboardToolOverlay title={copy.detail.title} copy={copy}>
            <AssignmentDetailCard
              assignment={selectedAssignment}
              tagOptions={operationalTags}
              locale={locale}
              copy={copy}
            />
          </DashboardToolOverlay>
        ) : null}

      </section>
    </main>
  );

  async function getAssignments(groupIds: string[]): Promise<AssignmentView[]> {
    if (groupIds.length === 0) {
      return [];
    }

    const { data, error } = await serviceSupabase
      .from("participant_group_assignments")
      .select(
        "id,registration_id,group_id,status,source,confidence,is_current,assignment_reason,escalation_depth,leader_internal_note,leader_notification_read_at,leader_decision_at,created_at,updated_at,groups!participant_group_assignments_group_id_fkey(id,name,node_type,parent_group_id),registrations!inner(id,event_id,status,submitted_at,participants(id,first_name,last_name,public_code,birth_date,country_other,city_other,participant_contacts(email,phone,is_primary),countries(name_it),cities(name),participates_with_group,participant_operational_tags(assigned_at,operational_tags(id,event_id,label,color))))"
      )
      .in("group_id", groupIds)
      .eq("registrations.event_id", currentEventId)
      .eq("is_current", true)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[capogruppo:assignments]", error.message);
      return [];
    }

    return ((data ?? []) as AssignmentRow[])
      .map((row) => toAssignmentView(row, copy))
      .filter((assignment): assignment is AssignmentView => Boolean(assignment));
  }

  async function getGroupLinks(groupIds: string[]): Promise<GroupLinkView[]> {
    if (groupIds.length === 0) {
      return [];
    }

    const { data } = await serviceSupabase
      .from("group_registration_links")
      .select(
        "id,event_id,group_id,public_label,internal_label,use_count,max_uses,created_at,expires_at,revoked_at"
      )
      .in("group_id", groupIds)
      .eq("event_id", currentEventId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    return ((data ?? []) as GroupLinkRow[]).map((link) => ({
      id: link.id,
      eventId: link.event_id,
      groupId: link.group_id,
      publicLabel: link.public_label,
      internalLabel: link.internal_label,
      useCount: link.use_count ?? 0,
      maxUses: link.max_uses,
      createdAt: link.created_at,
      expiresAt: link.expires_at,
      revokedAt: link.revoked_at,
    }));
  }

  async function getOperationalTags(): Promise<OperationalTagOption[]> {
    const { data } = await serviceSupabase
      .from("operational_tags")
      .select("id,event_id,label,color")
      .eq("event_id", currentEventId)
      .order("label", { ascending: true });

    return ((data ?? []) as Array<{
      id: string;
      event_id: string;
      label: string;
      color: string;
    }>).map((tag) => ({
      id: tag.id,
      eventId: tag.event_id,
      label: tag.label,
      color: tag.color,
    }));
  }
}

function toScopedGroupView(
  group: GroupRow,
  copy: GroupLeaderCopy
): ScopedGroupView {
  return {
    id: group.id,
    eventId: group.event_id,
    eventTitle: relatedOne(group.events)?.title ?? copy.eventFallback,
    name: group.name ?? copy.groupFallback,
    nodeType: group.node_type,
    isActive: group.is_active ?? true,
    isAssignable: group.is_assignable ?? true,
    isPublicCatalog: group.is_public_catalog ?? true,
    publicLabel: group.public_label,
    primaryLeaderName: group.primary_leader_name,
    eventStartsOn: relatedOne(group.events)?.starts_on ?? null,
    eventEndsOn: relatedOne(group.events)?.ends_on ?? null,
  };
}

function AssignedScopeSection({
  assignedGroups,
  assignableGroups,
  copy,
}: {
  assignedGroups: ScopedGroupView[];
  assignableGroups: ScopedGroupView[];
  copy: GroupLeaderCopy;
}) {
  return (
    <section className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{copy.yourGroups}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--peace-muted)]">
            {copy.yourGroupsHelp}
          </p>
        </div>
        <span className="rounded-full border border-[var(--peace-border-strong)] px-3 py-1 text-sm font-semibold text-[var(--peace-blue-800)]">
          {copy.registrableCount(assignableGroups.length)}
        </span>
      </div>

      {assignedGroups.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {assignedGroups.map((group) => (
            <div
              key={group.id}
              className="rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-[var(--peace-ink)]">{group.name}</h3>
                    <ScopeBadge
                      label={
                        group.isActive && group.isAssignable
                          ? copy.canRegister
                          : copy.cannotRegister
                      }
                      tone={group.isActive ? "green" : "red"}
                    />
                    <ScopeBadge
                      label={
                        group.isPublicCatalog
                          ? copy.publicVisible
                          : copy.publicHidden
                      }
                    />
                  </div>
                  <p className="mt-2 text-sm text-[var(--peace-muted)]">
                    {group.eventTitle}
                    {group.primaryLeaderName
                      ? ` - ${copy.leader} ${group.primaryLeaderName}`
                      : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/capogruppo?tool=link&groupId=${encodeURIComponent(group.id)}`}
                    className="min-h-9 rounded-md border border-[var(--peace-border-strong)] px-3 py-2 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
                  >
                    {copy.generateLink}
                  </Link>
                  <Link
                    href={`/dashboard/capogruppo?tool=manual&groupId=${encodeURIComponent(group.id)}`}
                    className="min-h-9 rounded-md bg-[var(--peace-blue-800)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]"
                  >
                    {copy.addParticipant}
                  </Link>
                </div>
              </div>
              {!group.isActive ? (
                <p className="mt-3 rounded-md border border-[#e8c2bd] bg-[#fff6f4] p-3 text-sm leading-6 text-[#8a3f35]">
                  {copy.inactiveGroupHelp}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--peace-muted)]">
          {copy.noGroups}
        </p>
      )}
    </section>
  );
}

function DashboardToolOverlay({
  title,
  copy,
  children,
}: {
  title: string;
  copy: GroupLeaderCopy;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center modal-backdrop px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-[var(--peace-border)] bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold text-[var(--peace-ink)]">{title}</h2>
          <Link
            href="/dashboard/capogruppo"
            className="inline-flex h-10 min-w-10 items-center justify-center rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
            aria-label={copy.close}
          >
            {copy.close}
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

function GroupLeaderLinksSection({
  groups,
  links,
  selectedGroupId,
  createdGroupId,
  createdUrl,
  locale,
  copy,
}: {
  groups: ScopedGroupView[];
  links: GroupLinkView[];
  selectedGroupId: string | null;
  createdGroupId: string | null;
  createdUrl: string | null;
  locale: SupportedLocale;
  copy: GroupLeaderCopy;
}) {
  const assignableGroups = groups.filter((group) => group.isAssignable);
  const visibleGroups =
    selectedGroupId && assignableGroups.some((group) => group.id === selectedGroupId)
      ? assignableGroups.filter((group) => group.id === selectedGroupId)
      : assignableGroups;
  const linksByGroupId = new Map<string, GroupLinkView[]>();

  for (const link of links) {
    const groupLinks = linksByGroupId.get(link.groupId) ?? [];
    groupLinks.push(link);
    linksByGroupId.set(link.groupId, groupLinks);
  }

  return (
    <section>
      <div>
        <h2 className="text-lg font-semibold">{copy.linkTitle}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--peace-muted)]">
          {copy.linkHelp}
        </p>
      </div>

      <div className="mt-5 grid gap-4">
        {visibleGroups.map((group) => {
          const groupLinks = linksByGroupId.get(group.id) ?? [];

          return (
            <article
              key={group.id}
              className="rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4"
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-[var(--peace-ink)]">{group.name}</h3>
                    <span className="rounded-full border border-[var(--peace-border-strong)] px-2 py-1 text-xs font-semibold text-[var(--peace-blue-800)]">
                      {group.isPublicCatalog ? copy.visibleInForm : copy.hidden}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--peace-muted)]">
                    {group.eventTitle} - {copy.leader}{" "}
                    {group.primaryLeaderName ?? copy.leaderMissing}
                  </p>
                  <p className="mt-2 text-sm text-[var(--peace-ink)]">
                    {copy.formPublicName}:{" "}
                    <span className="font-medium">
                      {group.publicLabel ?? copy.notSet}
                    </span>
                  </p>

                  {createdUrl && createdGroupId === group.id ? (
                    <label className="mt-4 grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
                      {copy.justCreatedLink}
                      <input
                        readOnly
                        className="field bg-white font-mono text-xs"
                        value={createdUrl}
                      />
                    </label>
                  ) : null}

                  <div className="mt-4 grid gap-2">
                    {groupLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex flex-col gap-2 rounded-md border border-[var(--peace-border)] bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium text-[var(--peace-ink)]">
                            {link.internalLabel ?? link.publicLabel ?? copy.unlabeledLink}
                          </p>
                          <p className="mt-1 text-xs text-[var(--peace-muted)]">
                            {groupLinkStatusLabel(link, locale, copy)} - {copy.uses} {link.useCount}
                            {link.maxUses ? `/${link.maxUses}` : ""}
                          </p>
                        </div>
                        <form action={revokeGroupRegistrationLink}>
                          <input type="hidden" name="sourceDashboard" value="capogruppo" />
                          <input type="hidden" name="linkId" value={link.id} />
                          <PendingSubmitButton className="min-h-9 rounded-md border border-[#d1a7a0] px-3 text-xs font-semibold text-[#8a3f35] transition hover:bg-[#fff0ee]">
                            {copy.revoke}
                          </PendingSubmitButton>
                        </form>
                      </div>
                    ))}
                    {groupLinks.length === 0 ? (
                      <p className="text-sm text-[var(--peace-muted)]">{copy.noActiveLinks}</p>
                    ) : null}
                  </div>
                </div>

                <form action={createGroupRegistrationLink} className="grid gap-3">
                  <input type="hidden" name="sourceDashboard" value="capogruppo" />
                  <input type="hidden" name="groupId" value={group.id} />
                  <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
                    {copy.publicLabel}
                    <input
                      name="publicLabel"
                      className="field"
                      defaultValue={group.publicLabel ?? ""}
                      placeholder={group.name}
                    />
                    <span className="text-xs font-normal leading-5 text-[var(--peace-muted)]">
                      {copy.publicLabelHelp}
                    </span>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
                    {copy.internalLabel}
                    <input
                      name="internalLabel"
                      className="field"
                      placeholder={copy.internalLabelPlaceholder}
                    />
                    <span className="text-xs font-normal leading-5 text-[var(--peace-muted)]">
                      {copy.internalLabelHelp}
                    </span>
                  </label>
                  <PendingSubmitButton className="min-h-10 rounded-md bg-[var(--peace-blue-800)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
                    {copy.generateLink}
                  </PendingSubmitButton>
                </form>
              </div>
            </article>
          );
        })}
      </div>

      {assignableGroups.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--peace-muted)]">
          {copy.noRegistrableGroups}
        </p>
      ) : null}
    </section>
  );
}

function ManualRegistrationSection({
  groups,
  selectedGroupId,
  eventDays,
  locale,
  copy,
}: {
  groups: ScopedGroupView[];
  selectedGroupId: string | null;
  eventDays: Array<{ value: string; label: string }>;
  locale: SupportedLocale;
  copy: GroupLeaderCopy;
}) {
  const assignableGroups = groups.filter((group) => group.isAssignable);
  const defaultGroupId =
    selectedGroupId && assignableGroups.some((group) => group.id === selectedGroupId)
      ? selectedGroupId
      : "";

  return (
    <section>
      <div>
        <h2 className="text-lg font-semibold">{copy.manualTitle}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--peace-muted)]">
          {copy.manualHelp}
        </p>
      </div>

      {assignableGroups.length > 0 ? (
        <form
          action={createGroupLeaderManualRegistration}
          className="mt-5 grid gap-4 lg:grid-cols-2"
        >
          <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)] lg:col-span-2">
            {copy.group}
            <select name="groupId" required className="field" defaultValue={defaultGroupId}>
              <option value="">{copy.selectGroup}</option>
              {assignableGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
            {copy.firstName}
            <input name="firstName" required minLength={2} className="field" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
            {copy.lastName}
            <input name="lastName" required minLength={2} className="field" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
            {copy.email}
            <input name="email" type="email" className="field" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
            {copy.phone}
            <input name="phone" className="field" placeholder="+393331234567" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
            {copy.birthDate}
            <input name="birthDate" type="date" className="field" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
            {copy.language}
            <select name="preferredLocale" className="field" defaultValue="it">
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.nativeLabel}
                </option>
              ))}
            </select>
          </label>
          <ManualAttendanceFields eventDays={eventDays} copy={copy.attendance} />
          <ManualAccessibilityFields
            locale={locale}
            copy={copy.accessibility}
          />
          <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)] lg:col-span-2">
            {copy.internalNote}
            <textarea
              name="leaderNote"
              rows={3}
              className="min-h-20 rounded-md border border-[var(--peace-border-strong)] bg-white px-3 py-2 text-sm font-normal text-[var(--peace-ink)] outline-none transition focus:border-[var(--peace-sky-400)]"
            />
          </label>
          <label className="flex gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-3 text-sm font-medium text-[var(--peace-ink)] lg:col-span-2">
            <input
              name="consentConfirmed"
              type="checkbox"
              required
              className="mt-1 h-4 w-4 accent-[var(--peace-blue-800)]"
            />
            {copy.consent}
          </label>
          <div className="lg:col-span-2">
            <PendingSubmitButton className="min-h-10 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
              {copy.addParticipant}
            </PendingSubmitButton>
          </div>
        </form>
      ) : (
        <p className="mt-4 text-sm text-[var(--peace-muted)]">
          {copy.noRegistrableGroups}
        </p>
      )}
    </section>
  );
}

function AssignmentFilters({
  filter,
  query,
  sort,
  copy,
}: {
  filter: GroupLeaderReviewFilter;
  query: string;
  sort: AssignmentSort;
  copy: GroupLeaderCopy;
}) {
  return (
    <form
      method="get"
      action="/dashboard/capogruppo"
      className="mt-5 grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4 lg:grid-cols-[1fr_190px_210px_auto]"
    >
      <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
        {copy.filters.search}
        <input
          name="q"
          defaultValue={query}
          className="field bg-white"
          placeholder={copy.filters.searchPlaceholder}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
        {copy.filters.status}
        <select name="filter" defaultValue={filter} className="field bg-white">
          {Object.entries(copy.filterLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
        {copy.filters.sort}
        <select name="sort" defaultValue={sort} className="field bg-white">
          {ASSIGNMENT_SORT_VALUES.map((value) => (
            <option key={value} value={value}>
              {copy.sortLabels[value]}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-2">
        <PendingSubmitButton className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
          {copy.filters.apply}
        </PendingSubmitButton>
        <Link
          href="/dashboard/capogruppo#assegnazioni-gruppo"
          className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
        >
          {copy.filters.reset}
        </Link>
      </div>
    </form>
  );
}

function AssignmentsTable({
  assignments,
  locale,
  copy,
}: {
  assignments: AssignmentView[];
  locale: SupportedLocale;
  copy: GroupLeaderCopy;
}) {
  if (assignments.length === 0) {
    return (
      <div className="mt-5 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4 text-sm text-[var(--peace-muted)]">
        {copy.filters.empty}
      </div>
    );
  }

  return (
    <div className="mt-5 overflow-x-auto rounded-md border border-[var(--peace-border)]">
      <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--peace-border)] bg-[#f7fbfe] text-xs uppercase tracking-wide text-[#6f7f91]">
            <th className="py-3 pl-4 pr-4 font-semibold">{copy.table.participant}</th>
            <th className="py-3 pr-4 font-semibold">{copy.table.contacts}</th>
            <th className="py-3 pr-4 font-semibold">{copy.table.group}</th>
            <th className="py-3 pr-4 font-semibold">{copy.table.origin}</th>
            <th className="py-3 pr-4 font-semibold">{copy.table.registration}</th>
            <th className="py-3 pr-4 font-semibold">{copy.table.status}</th>
            <th className="py-3 pr-4 font-semibold">{copy.table.actions}</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((assignment) => (
            <AssignmentRowView
              key={assignment.id}
              assignment={assignment}
              locale={locale}
              copy={copy}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssignmentRowView({
  assignment,
  locale,
  copy,
}: {
  assignment: AssignmentView;
  locale: SupportedLocale;
  copy: GroupLeaderCopy;
}) {
  const canDecide = assignment.isCurrent && assignment.status === "probable";
  const manageLabel = copy.table.manageAria(
    assignment.participantName,
    assignment.participantCode
  );
  const cardLabel = copy.table.openCardAria(
    assignment.participantName,
    assignment.participantCode
  );

  return (
    <tr className="border-b border-[var(--peace-border)] align-top transition hover:bg-[#f7fbfe] last:border-b-0">
      <td className="py-4 pl-4 pr-4">
        <Link
          href={`/dashboard/capogruppo?assignmentId=${encodeURIComponent(assignment.id)}`}
          aria-label={cardLabel}
          className="font-semibold text-[var(--peace-blue-800)] underline-offset-4 hover:underline"
        >
          {assignment.participantName}
        </Link>
        <p className="mt-1 text-xs text-[var(--peace-muted)]">
          {assignment.participantCode ?? copy.table.withoutCode}
          {assignment.birthDate
            ? ` - ${copy.table.bornOn(formatDate(assignment.birthDate, locale))}`
            : ""}
        </p>
      </td>
      <td className="py-4 pr-4 text-[var(--peace-ink)]">
        <p>{assignment.participantEmail ?? copy.table.emailMissing}</p>
        <p className="mt-1 text-xs text-[var(--peace-muted)]">
          {assignment.participantPhone ?? copy.table.phoneMissing}
        </p>
      </td>
      <td className="py-4 pr-4">
        <p className="font-medium text-[var(--peace-ink)]">{assignment.groupName}</p>
        <p className="mt-1 text-xs text-[var(--peace-muted)]">
          {assignment.assignmentReason
            ? assignmentReasonLabel(assignment.assignmentReason, copy)
            : sourceLabel(assignment.source, copy)}
        </p>
      </td>
      <td className="py-4 pr-4 text-[var(--peace-ink)]">{assignment.participantPlace}</td>
      <td className="py-4 pr-4 text-[var(--peace-ink)]">
        <p>{formatDateTime(assignment.submittedAt, locale, copy.notProvided)}</p>
        <p className="mt-1 text-xs text-[var(--peace-muted)]">
          {copy.table.updated(formatDateTime(assignment.updatedAt, locale, copy.notProvided))}
        </p>
      </td>
      <td className="py-4 pr-4">
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge
            status={assignment.status}
            isCurrent={assignment.isCurrent}
            copy={copy}
          />
          {!assignment.leaderNotificationReadAt && canDecide ? (
            <span className="rounded-full bg-[#fff1c2] px-2.5 py-1 text-xs font-semibold text-[#6b5214]">
              {copy.table.unread}
            </span>
          ) : null}
        </div>
      </td>
      <td className="py-4 pr-4">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/capogruppo?assignmentId=${encodeURIComponent(assignment.id)}`}
            aria-label={cardLabel}
            className="inline-flex min-h-9 items-center rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
          >
            {copy.table.openCard}
          </Link>
          {canDecide ? (
            <>
              <form action={updateGroupLeaderAssignment}>
                <input type="hidden" name="assignmentId" value={assignment.id} />
                <PendingSubmitButton
                  name="intent"
                  value="confirm"
                  className="min-h-9 rounded-md bg-[var(--peace-blue-800)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]"
                >
                  {copy.table.confirm}
                </PendingSubmitButton>
              </form>
              <form action={updateGroupLeaderAssignment}>
                <input type="hidden" name="assignmentId" value={assignment.id} />
                <PendingSubmitButton
                  name="intent"
                  value="reject"
                  className="min-h-9 rounded-md border border-[#d1a7a0] px-3 text-sm font-semibold text-[#8a3f35] transition hover:bg-[#fff0ee]"
                >
                  {copy.table.reject}
                </PendingSubmitButton>
              </form>
            </>
          ) : null}
        </div>
        <details className="group mt-2">
          <summary
            aria-label={manageLabel}
            className="inline-flex min-h-10 cursor-pointer list-none items-center rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
          >
            {copy.table.manage}
          </summary>
          <form
            action={updateGroupLeaderAssignment}
            className="mt-3 grid min-w-[260px] gap-2 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-3"
          >
            <input type="hidden" name="assignmentId" value={assignment.id} />
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[#6f7f91]">
              {copy.internalNote}
              <textarea
                name="leaderInternalNote"
                defaultValue={assignment.leaderInternalNote ?? ""}
                rows={3}
                className="min-h-20 rounded-md border border-[var(--peace-border-strong)] bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[var(--peace-ink)] outline-none transition focus:border-[var(--peace-sky-400)]"
              />
            </label>
            <PendingSubmitButton
              name="intent"
              value="note"
              className="min-h-9 rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
            >
              {copy.table.saveNote}
            </PendingSubmitButton>
            {canDecide ? (
              <>
                <PendingSubmitButton
                  name="intent"
                  value="confirm"
                  className="min-h-9 rounded-md bg-[var(--peace-blue-800)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]"
                >
                  {copy.table.confirm}
                </PendingSubmitButton>
                <PendingSubmitButton
                  name="intent"
                  value="reject"
                  className="min-h-9 rounded-md border border-[#d1a7a0] px-3 text-sm font-semibold text-[#8a3f35] transition hover:bg-[#fff0ee]"
                >
                  {copy.table.reject}
                </PendingSubmitButton>
                <PendingSubmitButton
                  name="intent"
                  value="read"
                  className="min-h-9 rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-muted)] transition hover:bg-[var(--peace-sky-100)]"
                >
                  {copy.table.markRead}
                </PendingSubmitButton>
              </>
            ) : null}
          </form>
        </details>
      </td>
    </tr>
  );
}

function AssignmentDetailCard({
  assignment,
  tagOptions,
  locale,
  copy,
}: {
  assignment: AssignmentView;
  tagOptions: OperationalTagOption[];
  locale: SupportedLocale;
  copy: GroupLeaderCopy;
}) {
  const canDecide = assignment.isCurrent && assignment.status === "probable";

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 border-b border-[var(--peace-border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-[var(--peace-ink)]">
            {assignment.participantName}
          </h3>
          <p className="mt-1 text-sm text-[var(--peace-muted)]">
            {copy.detail.publicCode}:{" "}
            <span className="font-mono font-semibold">
              {assignment.participantCode ?? copy.table.withoutCode}
            </span>
          </p>
        </div>
        <StatusBadge
          status={assignment.status}
          isCurrent={assignment.isCurrent}
          copy={copy}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailBlock title={copy.detail.identity}>
          <DetailLine label={copy.birthDate}>
            {assignment.birthDate
              ? formatDate(assignment.birthDate, locale)
              : copy.notProvided}
          </DetailLine>
          <DetailLine label={copy.table.origin}>{assignment.participantPlace}</DetailLine>
          <DetailLine label={copy.detail.participatesWithGroup}>
            {formatOptionalBoolean(assignment.participatesWithGroup, copy)}
          </DetailLine>
        </DetailBlock>

        <DetailBlock title={copy.detail.contacts}>
          <DetailLine label={copy.email}>
            {assignment.participantEmail ?? copy.table.emailMissing}
          </DetailLine>
          <DetailLine label={copy.phone}>
            {assignment.participantPhone ?? copy.table.phoneMissing}
          </DetailLine>
        </DetailBlock>

        <DetailBlock title="Tag operativi">
          <OperationalTagList tags={assignment.tags} emptyLabel="Senza tag" />
        </DetailBlock>

        <DetailBlock title={copy.detail.group}>
          <DetailLine label={copy.group}>{assignment.groupName}</DetailLine>
          <DetailLine label={copy.table.origin}>
            {assignment.assignmentReason
              ? assignmentReasonLabel(assignment.assignmentReason, copy)
              : sourceLabel(assignment.source, copy)}
          </DetailLine>
          <DetailLine label={copy.detail.escalationDepth}>
            {String(assignment.escalationDepth)}
          </DetailLine>
        </DetailBlock>

        <DetailBlock title={copy.detail.assignment}>
          <DetailLine label={copy.detail.registrationStatus}>
            {assignment.registrationStatus ?? copy.notProvided}
          </DetailLine>
          <DetailLine label={copy.detail.submittedAt}>
            {formatDateTime(assignment.submittedAt, locale, copy.notProvided)}
          </DetailLine>
          <DetailLine label={copy.detail.updatedAt}>
            {formatDateTime(assignment.updatedAt, locale, copy.notProvided)}
          </DetailLine>
          <DetailLine label={copy.detail.decisionAt}>
            {formatDateTime(assignment.leaderDecisionAt, locale, copy.notProvided)}
          </DetailLine>
        </DetailBlock>
      </div>

      <DetailBlock title={copy.detail.notes}>
        <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--peace-ink)]">
          {assignment.leaderInternalNote ?? copy.detail.noNote}
        </p>
      </DetailBlock>

      <form
        action={updateGroupLeaderAssignment}
        className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4"
      >
        <input type="hidden" name="assignmentId" value={assignment.id} />
        <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
          {copy.internalNote}
          <textarea
            name="leaderInternalNote"
            defaultValue={assignment.leaderInternalNote ?? ""}
            rows={4}
            className="min-h-24 rounded-md border border-[var(--peace-border-strong)] bg-white px-3 py-2 text-sm font-normal text-[var(--peace-ink)] outline-none transition focus:border-[var(--peace-sky-400)]"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <PendingSubmitButton
            name="intent"
            value="note"
            className="min-h-10 rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
          >
            {copy.table.saveNote}
          </PendingSubmitButton>
          {canDecide ? (
            <>
              <PendingSubmitButton
                name="intent"
                value="confirm"
                className="min-h-10 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]"
              >
                {copy.table.confirm}
              </PendingSubmitButton>
              <PendingSubmitButton
                name="intent"
                value="reject"
                className="min-h-10 rounded-md border border-[#d1a7a0] px-4 text-sm font-semibold text-[#8a3f35] transition hover:bg-[#fff0ee]"
              >
                {copy.table.reject}
              </PendingSubmitButton>
            </>
          ) : null}
        </div>
      </form>

      <form
        action={updateParticipantOperationalTags}
        className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4"
      >
        <input type="hidden" name="sourceDashboard" value="capogruppo" />
        <input type="hidden" name="assignmentId" value={assignment.id} />
        <input type="hidden" name="registrationId" value={assignment.registrationId} />
        <input type="hidden" name="participantId" value={assignment.participantId} />
        <input type="hidden" name="eventId" value={assignment.eventId} />
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-[var(--peace-ink)]">
            Tag operativi
          </legend>
          <TagCheckboxGrid
            tagOptions={tagOptions}
            selectedTagIds={assignment.tagIds}
            emptyLabel="Nessun tag creato dal manager per questo evento."
          />
        </fieldset>
        <PendingSubmitButton className="min-h-10 w-fit rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
          Salva tag
        </PendingSubmitButton>
      </form>
    </section>
  );
}

function DetailBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-[var(--peace-border)] bg-white p-4">
      <h4 className="text-sm font-semibold text-[var(--peace-ink)]">{title}</h4>
      <div className="mt-3 grid gap-2">{children}</div>
    </div>
  );
}

function DetailLine({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 text-sm">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#6f7f91]">
        {label}
      </dt>
      <dd className="text-[var(--peace-ink)]">{children}</dd>
    </div>
  );
}

function ScopeBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "green" | "neutral" | "red";
}) {
  const className =
    tone === "green"
      ? "border-[#bad2b8] bg-[#edf7ea] text-[#2f6541]"
      : tone === "red"
        ? "border-[#e0b6af] bg-[#fff0ee] text-[#8a3f35]"
        : "border-[var(--peace-border-strong)] bg-white text-[var(--peace-muted)]";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function OperationalTagList({
  tags,
  emptyLabel,
}: {
  tags: ParticipantOperationalTag[];
  emptyLabel: string;
}) {
  if (tags.length === 0) {
    return <span className="text-sm text-[var(--peace-muted)]">{emptyLabel}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--peace-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--peace-ink)]"
        >
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full"
            style={{ backgroundColor: tag.color }}
          />
          {tag.label}
        </span>
      ))}
    </div>
  );
}

function TagCheckboxGrid({
  tagOptions,
  selectedTagIds,
  emptyLabel,
}: {
  tagOptions: OperationalTagOption[];
  selectedTagIds: string[];
  emptyLabel: string;
}) {
  if (tagOptions.length === 0) {
    return <p className="text-sm text-[var(--peace-muted)]">{emptyLabel}</p>;
  }

  const selected = new Set(selectedTagIds);

  return (
    <div className="flex flex-wrap gap-2">
      {tagOptions.map((tag) => (
        <label
          key={tag.id}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--peace-border)] bg-white px-3 text-sm font-semibold text-[var(--peace-ink)]"
        >
          <input
            type="checkbox"
            name="tagIds"
            value={tag.id}
            defaultChecked={selected.has(tag.id)}
            className="size-4 accent-[var(--peace-blue-800)]"
          />
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full"
            style={{ backgroundColor: tag.color }}
          />
          {tag.label}
        </label>
      ))}
    </div>
  );
}

function StatusBadge({
  status,
  isCurrent,
  copy,
}: {
  status: string | null;
  isCurrent: boolean;
  copy: GroupLeaderCopy;
}) {
  const label = statusLabel(status, isCurrent, copy);
  const className =
    status === "confirmed" && isCurrent
      ? "bg-[#e6f3e8] text-[#2f6541]"
      : status === "rejected"
        ? "bg-[#f8e8e5] text-[#8a3f35]"
        : "bg-[#fff1c2] text-[#6b5214]";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function StatusMessage({
  error,
  saved,
  copy,
}: {
  error: string | undefined;
  saved: string | undefined;
  copy: GroupLeaderCopy;
}) {
  if (saved) {
    return (
      <div className="rounded-lg border border-[#bad2b8] bg-[#edf7ea] p-4 text-sm text-[#2f6541]">
        {copy.saved}
      </div>
    );
  }

  if (!error) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[#e0b6af] bg-[#fff0ee] p-4 text-sm text-[#8a3f35]">
      {copy.errorPrefix}: {error}.
    </div>
  );
}

function toAssignmentView(
  row: AssignmentRow,
  copy: GroupLeaderCopy
): AssignmentView | null {
  const registration = relatedOne(row.registrations);
  const participant = relatedOne(registration?.participants ?? null);
  const group = relatedOne(row.groups);

  if (!registration || !participant || !group) {
    return null;
  }

  const tags = mapParticipantOperationalTags(participant.participant_operational_tags);

  return {
    id: row.id,
    registrationId: row.registration_id,
    eventId: registration.event_id,
    participantId: participant.id,
    groupId: row.group_id,
    groupName: group.name ?? copy.groupFallback,
    groupNodeType: group.node_type,
    participantName: formatParticipantName(
      participant.first_name,
      participant.last_name,
      copy
    ),
    participantCode: participant.public_code,
    participantEmail: getPrimaryContact(participant.participant_contacts)?.email ?? null,
    participantPhone: getPrimaryContact(participant.participant_contacts)?.phone ?? null,
    participantPlace: formatPlace(
      relatedOne(participant.cities)?.name ?? participant.city_other,
      relatedOne(participant.countries)?.name_it ?? participant.country_other,
      copy
    ),
    participatesWithGroup: participant.participates_with_group,
    birthDate: participant.birth_date,
    registrationStatus: registration.status,
    submittedAt: registration.submitted_at,
    status: row.status,
    source: row.source,
    confidence: row.confidence,
    isCurrent: row.is_current ?? true,
    assignmentReason: row.assignment_reason,
    escalationDepth: row.escalation_depth ?? 0,
    leaderInternalNote: row.leader_internal_note,
    leaderNotificationReadAt: row.leader_notification_read_at,
    leaderDecisionAt: row.leader_decision_at,
    updatedAt: row.updated_at,
    tags,
    tagIds: tags.map((tag) => tag.id),
  };
}

function formatParticipantName(
  firstName: string | null,
  lastName: string | null,
  copy: GroupLeaderCopy
): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();

  return name || copy.participantFallback;
}

function getPrimaryContact(
  contacts:
    | Array<{
        email: string | null;
        phone: string | null;
        is_primary: boolean | null;
      }>
    | null
): { email: string | null; phone: string | null } | null {
  if (!contacts || contacts.length === 0) {
    return null;
  }

  return contacts.find((contact) => contact.is_primary) ?? contacts[0] ?? null;
}

function mapParticipantOperationalTags(
  rows:
    | Array<{
        assigned_at: string | null;
        operational_tags:
          | {
              id: string;
              event_id: string;
              label: string;
              color: string;
            }
          | Array<{
              id: string;
              event_id: string;
              label: string;
              color: string;
            }>
          | null;
      }>
    | null
): ParticipantOperationalTag[] {
  return (rows ?? [])
    .map((row) => {
      const tag = relatedOne(row.operational_tags);

      return tag
        ? {
            id: tag.id,
            eventId: tag.event_id,
            label: tag.label,
            color: tag.color,
            assignedAt: row.assigned_at,
          }
        : null;
    })
    .filter((tag): tag is ParticipantOperationalTag => Boolean(tag));
}

function formatPlace(
  city: string | null,
  country: string | null,
  copy: GroupLeaderCopy
): string {
  const parts = [city, country].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : copy.notProvided;
}

function formatOptionalBoolean(
  value: boolean | null,
  copy: GroupLeaderCopy
): string {
  if (value === true) {
    return copy.detail.yes;
  }

  if (value === false) {
    return copy.detail.no;
  }

  return copy.detail.unknown;
}

function statusLabel(
  status: string | null,
  isCurrent: boolean,
  copy: GroupLeaderCopy
): string {
  if (status === "confirmed" && isCurrent) {
    return copy.statusLabels.confirmed;
  }

  if (status === "rejected") {
    return copy.statusLabels.rejected;
  }

  if (!isCurrent) {
    return copy.statusLabels.superseded;
  }

  return copy.statusLabels.probable;
}

function sourceLabel(source: string | null, copy: GroupLeaderCopy): string {
  switch (source) {
    case "participant_selected":
      return copy.sourceLabels.participantSelected;
    case "rule":
      return copy.sourceLabels.rule;
    case "capogruppo":
      return copy.sourceLabels.capogruppo;
    case "manager":
      return copy.sourceLabels.manager;
    case "admin":
      return copy.sourceLabels.admin;
    default:
      return copy.notProvided;
  }
}

function assignmentReasonLabel(reason: string, copy: GroupLeaderCopy): string {
  switch (reason) {
    case "participant_selected_group":
      return copy.assignmentReasonLabels.participantSelectedGroup;
    case "group_registration_link":
      return copy.assignmentReasonLabels.groupRegistrationLink;
    case "newcomer_territorial_fallback":
      return copy.assignmentReasonLabels.newcomerTerritorialFallback;
    case "participant_cannot_find_leader":
      return copy.assignmentReasonLabels.participantCannotFindLeader;
    case "santegidio_territorial_fallback":
      return copy.assignmentReasonLabels.santegidioTerritorialFallback;
    case "group_leader_rejected_escalated_to_parent":
      return copy.assignmentReasonLabels.groupLeaderRejectedEscalatedToParent;
    case "group_leader_manual_entry":
      return copy.assignmentReasonLabels.groupLeaderManualEntry;
    case "admin_updated_group":
      return copy.assignmentReasonLabels.adminUpdatedGroup;
    case "manager_updated_group":
      return copy.assignmentReasonLabels.managerUpdatedGroup;
    case "capogruppo_updated_group":
      return copy.assignmentReasonLabels.capogruppoUpdatedGroup;
    default:
      return reason;
  }
}

function groupLinkStatusLabel(
  link: GroupLinkView,
  locale: SupportedLocale,
  copy: GroupLeaderCopy
): string {
  switch (
    getGroupRegistrationLinkStatus({
      expiresAt: link.expiresAt,
      revokedAt: link.revokedAt,
      maxUses: link.maxUses,
      useCount: link.useCount,
    })
  ) {
    case "active":
      return copy.statusLabels.active(formatDateTime(link.createdAt, locale, copy.notProvided));
    case "expired":
      return copy.statusLabels.expired;
    case "revoked":
      return copy.statusLabels.revoked;
    case "exhausted":
      return copy.statusLabels.exhausted;
  }
}

function formatDateTime(
  value: string | null,
  locale: SupportedLocale = "it",
  fallback = IT_GROUP_LEADER_COPY.notProvided
): string {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value: string, locale: SupportedLocale = "it"): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function normalizeSearchQuery(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function parseAssignmentSort(value: string | null | undefined): AssignmentSort {
  return ASSIGNMENT_SORT_VALUES.some((option) => option === value)
    ? (value as AssignmentSort)
    : "name";
}

function parseDashboardTool(value: string | null | undefined): DashboardTool | null {
  return value === "link" || value === "manual" ? value : null;
}

function dashboardToolTitle(
  tool: DashboardTool,
  copy: GroupLeaderCopy
): string {
  return tool === "link" ? copy.generateLink : copy.addParticipant;
}

function matchesAssignmentQuery(
  assignment: AssignmentView,
  query: string
): boolean {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();
  const haystack = [
    assignment.participantName,
    assignment.participantCode,
    assignment.participantEmail,
    assignment.participantPhone,
    assignment.groupName,
    assignment.participantPlace,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function sortAssignments(
  assignments: AssignmentView[],
  sort: AssignmentSort,
  locale: SupportedLocale
): AssignmentView[] {
  return [...assignments].sort((left, right) => {
    switch (sort) {
      case "updated":
        return compareDateDesc(left.updatedAt, right.updatedAt);
      case "submitted":
        return compareDateDesc(left.submittedAt, right.submittedAt);
      case "status":
        return (
          statusSortValue(left) - statusSortValue(right) ||
          left.participantName.localeCompare(right.participantName, locale)
        );
      case "name":
        return left.participantName.localeCompare(right.participantName, locale);
    }
  });
}

function compareDateDesc(left: string | null, right: string | null): number {
  return dateTimeValue(right) - dateTimeValue(left);
}

function dateTimeValue(value: string | null): number {
  return value ? new Date(value).getTime() : 0;
}

function statusSortValue(assignment: AssignmentView): number {
  if (assignment.status === "probable" && assignment.isCurrent) {
    return assignment.leaderNotificationReadAt ? 1 : 0;
  }

  if (assignment.status === "confirmed" && assignment.isCurrent) {
    return 2;
  }

  if (assignment.status === "rejected") {
    return 3;
  }

  return 4;
}

function getManualRegistrationEventDays(
  groups: ScopedGroupView[],
  locale: SupportedLocale
): Array<{ value: string; label: string }> {
  const event = groups.find((group) => group.eventStartsOn);

  if (!event?.eventStartsOn) {
    return [];
  }

  const start = parseDateOnly(event.eventStartsOn);
  const end = parseDateOnly(event.eventEndsOn ?? event.eventStartsOn);

  if (!start || !end || end.getTime() < start.getTime()) {
    return [];
  }

  const days: Array<{ value: string; label: string }> = [];
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  for (
    let cursor = start;
    cursor.getTime() <= end.getTime();
    cursor = new Date(cursor.getTime() + DAY_IN_MS)
  ) {
    days.push({
      value: cursor.toISOString().slice(0, 10),
      label: formatter.format(cursor),
    });
  }

  return days;
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
}

function relatedOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
