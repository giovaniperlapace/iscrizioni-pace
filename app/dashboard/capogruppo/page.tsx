import { MANUAL_REGISTRATION_COPY, type ManualRegistrationCopy } from "@/lib/registrations/manual-registration-copy";
import { ManualRegistrationSection } from "@/app/dashboard/manual-registration-section";
import { ParticipantBirthDateField } from "@/components/participant-birth-date-field";
import { OperationalAccessibilityEditor } from "@/app/dashboard/operational-accessibility-editor";
import { OperationalChildrenEditor } from "@/app/dashboard/operational-children-editor";
import { loadAllRows, loadRowsForIds } from "@/lib/supabase/all-rows";
import { LocalOverlay } from "@/app/dashboard/local-overlay";
import { LocalQueryLink } from "@/components/local-query-link";
import { ACCESS_EMAIL_COPY } from "@/lib/email/account-access";
import { randomUUID } from "node:crypto";
import { SuccessMessage } from "@/components/success-message";
import { LeaderParticipantAttendance } from "./participant-attendance";
import { loadLeaderAttendance } from "@/lib/groups/leader-attendance.server";
import { LeaderParticipantQr } from "./participant-qr";
import { loadLeaderAssignmentQr } from "@/lib/groups/leader-qr.server";
import type { RegistrationQrPreview } from "@/lib/qrcode/registration-qr";
import { LeaderParticipantsTable } from "./participants-table";
import { filterLeaderRows, leaderReturnPath, toLeaderTableRow } from "@/lib/groups/leader-table";

import { ReliableForm } from "@/components/reliable-form";
import Link from "@/components/pending-link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  createGroupLeaderManualRegistration,
  updateGroupLeaderAssignment,
  updateGroupRegistrationLink,
  updateGroupLeaderParticipantContact,
  updateGroupLeaderAttendance,
  updateParticipantOperationalTags,
} from "@/app/actions";
import {
  DashboardAreaDescription,
  DashboardRoleTabs,
} from "@/app/dashboard/role-tabs";
import { AutoFilterForm } from "@/app/dashboard/auto-filter-form";
import { ConfirmSubmitButton } from "@/app/dashboard/confirm-submit-button";
import { CopyLinkButton } from "@/app/dashboard/group-link-copy-tools";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { PreserveDashboardScroll } from "@/app/dashboard/preserve-dashboard-scroll";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { getCurrentOperationalEventId } from "@/lib/events/current";
import { loadLeaderScope, loadLeaderAssignmentRows, type GroupRow } from "@/lib/groups/leader-data.server";
import { toAssignmentView, type AssignmentView } from "@/lib/groups/leader-assignments";
import {
  buildGroupRegistrationUrl,
  getGroupRegistrationLinkStatus,
} from "@/lib/groups/registration-links";
import type { SupportedLocale } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { decryptQrToken } from "@/lib/qrcode/secure-token";
import type {
  OperationalTagOption,
} from "@/lib/registrations/operational-tags";
import {
  eventServiceStatusLabel,
  type ParticipantEventService,
} from "@/lib/registrations/event-services";
import {
  buildAttendanceDayColumns,
  type AttendanceDayColumn,
} from "@/lib/registrations/attendance-slots";
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
    contact?: string;
    group?: string;
    tag?: string;
    sort?: string;
    columns?: string;
    direction?: string;
    tool?: string;
    groupId?: string;
    assignmentId?: string;
    edit?: string;
  }>;
};

type GroupLinkRow = {
  id: string;
  event_id: string;
  group_id: string;
  public_label: string | null;
  internal_label: string | null;
  token_encrypted: string | null;
  slug: string | null;
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
  url: string | null;
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

type DashboardTool = "link" | "manual";

type AssignmentSort = "name" | "updated" | "submitted" | "status";
const GROUP_EXCEPTION_COPY = {
  it: { reject: "Segnala un problema di gruppo", sent: "Segnalazione inviata a Manager e Admin. Il gruppo è rimasto invariato.", help: "Invia una segnalazione a Manager e Admin. Il gruppo della persona resterà invariato.", warning: (name: string) => `Segnalare che ${name} non appartiene al gruppo?` },
  en: { reject: "Report a group issue", sent: "Report sent to Managers and Admins. The group is unchanged.", help: "Send a report to Managers and Admins. The person’s group will remain unchanged.", warning: (name: string) => `Report that ${name} does not belong to the group?` },
  fr: { reject: "Signaler un problème de groupe", sent: "Signalement envoyé aux gestionnaires et administrateurs. Le groupe reste inchangé.", help: "Envoyez un signalement aux gestionnaires et administrateurs. Le groupe restera inchangé.", warning: (name: string) => `Signaler que ${name} ne fait pas partie du groupe ?` },
  de: { reject: "Gruppenzuordnung melden", sent: "Meldung an Manager und Administratoren gesendet. Die Gruppe bleibt unverändert.", help: "Meldung an Manager und Administratoren senden. Die Gruppe bleibt unverändert.", warning: (name: string) => `Melden, dass ${name} nicht zur Gruppe gehört?` },
  es: { reject: "Informar de un problema de grupo", sent: "Aviso enviado a gestores y administradores. El grupo no ha cambiado.", help: "Envía un aviso a gestores y administradores. El grupo no cambiará.", warning: (name: string) => `¿Informar de que ${name} no pertenece al grupo?` },
  nl: { reject: "Probleem met groep melden", sent: "Melding verstuurd naar managers en beheerders. De groep is ongewijzigd.", help: "Stuur een melding naar managers en beheerders. De groep blijft ongewijzigd.", warning: (name: string) => `Melden dat ${name} niet bij de groep hoort?` },
  uk: { reject: "Повідомити про проблему з групою", sent: "Повідомлення надіслано менеджерам та адміністраторам. Група залишилася без змін.", help: "Надішліть повідомлення менеджерам та адміністраторам. Група залишиться без змін.", warning: (name: string) => `Повідомити, що ${name} не належить до групи?` },
};

type GroupLeaderCopy = ManualRegistrationCopy & {
  exception: { reject: string; sent: string; help: string; warning: (name: string) => string };
  srTitle: string;
  areaDescription: string;
  saved: string;
  errorPrefix: string;
  linkAlreadyExists: string;
  yourGroups: string;
  yourGroupsHelp: string;
  registrableCount: (count: number) => string;
  canRegister: string;
  cannotRegister: string;
  publicVisible: string;
  publicHidden: string;
  leader: string;
  manageLinks: string;
  linkSlug: string;
  linkSlugHelp: string;
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
  existingLinks: string;

  saveLinkName: string;
  copyLink: string;
  uses: string;
  noActiveLinks: string;
  publicLabel: string;
  publicLabelHelp: string;
  internalLabel: string;
  internalLabelPlaceholder: string;
  internalLabelHelp: string;
  filters: {
    search: string;
    searchPlaceholder: string;
    contact: string;
    contactPlaceholder: string;
    group: string;
    allGroups: string;
    tag: string;
    allTags: string;
    noTags: string;
    status: string;
    sort: string;
    apply: string;
    reset: string;
    empty: string;
  };
  sortLabels: Record<AssignmentSort, string>;
  table: {
    participant: string;
    contacts: string;
    tags: string;
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

    openCard: string;
    openCardAria: (name: string, code: string | null) => string;
    manage: string;
    manageAria: (name: string, code: string | null) => string;
    saveNote: string;

    details: string;
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
  };
  statusLabels: {

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
};

const IT_GROUP_LEADER_COPY: GroupLeaderCopy = {
  ...MANUAL_REGISTRATION_COPY.it,
  exception: GROUP_EXCEPTION_COPY.it,
  srTitle: "Dashboard capogruppo",
  areaDescription: "Gestisci i partecipanti dei tuoi gruppi e segnala soltanto chi non appartiene al gruppo.",
  saved: "Aggiornamento salvato.",
  errorPrefix: "Operazione non completata",
  linkAlreadyExists:
    "Questo gruppo ha già il proprio link. Non è possibile crearne un altro.",
  yourGroups: "I tuoi gruppi",
  yourGroupsHelp: "Questi sono i gruppi collegati al tuo account capogruppo.",
  registrableCount: (count) => `${count} iscrivibili`,
  canRegister: "Può ricevere iscrizioni",
  cannotRegister: "Non disponibile per iscrizioni",
  publicVisible: "Visibile nel form pubblico",
  publicHidden: "Non visibile nel form pubblico",
  leader: "referente",
  manageLinks: "Gestisci link",
  linkSlug: "Slug (indirizzo del link)",
    linkSlugHelp: "Modificando lo slug, il vecchio URL non sarà più valido.",
  inactiveGroupHelp:
    "Questo gruppo è collegato al tuo account, ma non è attivo nel catalogo operativo. Prima di usare link o inserimenti manuali serve un intervento di un manager/admin per riattivarlo o collegarti al gruppo corretto.",
  noGroups: "Nessun gruppo collegato al tuo account.",
  close: "Chiudi",
  participantsTitle: "Partecipanti del gruppo",
  participantsHelp:
    "Qui trovi le persone collegate ai gruppi che gestisci. Le decisioni sul gruppo sono interne e non inviano comunicazioni automatiche al partecipante.",
  linkTitle: "Link iscrizione gruppo",
  linkHelp:
    "Puoi creare un solo link riservato per ogni gruppo che gestisci. Anche dopo la revoca non sarà possibile crearne un altro. Il link non rende il gruppo visibile nel menu pubblico.",
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
  existingLinks: "Link del gruppo",

  saveLinkName: "Salva link",
  copyLink: "Copia link",
  uses: "usi",
  noActiveLinks: "Nessun link attivo.",
  publicLabel: "Nome visualizzato del link",
  publicLabelHelp:
    "Opzionale. Se compilato, chi apre questo link vedrà questo nome invece del nome interno del gruppo.",
  internalLabel: "Promemoria per te",
  internalLabelPlaceholder: "Per esempio: link mandato su WhatsApp",
  internalLabelHelp:
    "Non viene mostrato ai partecipanti. Serve solo a riconoscere questo link in dashboard.",
  filters: {
    search: "Nome o codice",
    searchPlaceholder: "Nome o codice",
    contact: "Email o telefono",
    contactPlaceholder: "Email o telefono",
    group: "Gruppo",
    allGroups: "Tutti i gruppi",
    tag: "Tag",
    allTags: "Tutti i tag",
    noTags: "Senza tag",
    status: "Stato",
    sort: "Ordina per",
    apply: "Applica",
    reset: "Azzera",
    empty: "Nessun partecipante con questi filtri.",
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
    tags: "Tag",
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

    openCard: "Scheda",
    openCardAria: (name, code) => `Apri scheda di ${name}${code ? ` ${code}` : ""}`,
    manage: "Gestisci",
    manageAria: (name, code) => `Gestisci ${name}${code ? ` ${code}` : ""}`,
    saveNote: "Salva nota",

    details: "Dettagli",
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
  },
  statusLabels: {

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
};

const EN_GROUP_LEADER_COPY: GroupLeaderCopy = {
  ...IT_GROUP_LEADER_COPY,
  ...MANUAL_REGISTRATION_COPY.en,
  exception: GROUP_EXCEPTION_COPY.en,
  srTitle: "Group leader dashboard",
  areaDescription: "Manage participants in your groups and report anyone who does not belong to the group.",
  saved: "Update saved.",
  errorPrefix: "Operation not completed",
  linkAlreadyExists:
    "This group already has its link. Another one cannot be created.",
  yourGroups: "Your groups",
  yourGroupsHelp: "These are the groups linked to your group leader account.",
  registrableCount: (count) => `${count} can receive registrations`,
  canRegister: "Can receive registrations",
  cannotRegister: "Not available for registrations",
  publicVisible: "Visible in the public form",
  publicHidden: "Not visible in the public form",
  leader: "contact person",
  manageLinks: "Manage links",
  linkSlug: "Slug (link address)",
    linkSlugHelp: "Changing the slug makes the previous URL invalid.",
  inactiveGroupHelp:
    "This group is linked to your account, but it is not active in the operational catalogue. Before using links or manual entries, a manager/admin needs to reactivate it or connect you to the correct group.",
  noGroups: "No group is linked to your account.",
  close: "Close",
  participantsTitle: "Group participants",
  participantsHelp:
    "Here you can find the people linked to the groups you manage. Group decisions are internal and do not send automatic messages to the participant.",
  linkTitle: "Group registration link",
  linkHelp:
    "You can create only one reserved link for each group you manage. A new one cannot be created after revocation. The link does not make the group visible in the public menu.",
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
  existingLinks: "Group link",

  saveLinkName: "Save link",
  copyLink: "Copy link",
  uses: "uses",
  noActiveLinks: "No active link.",
  publicLabel: "Link display name",
  publicLabelHelp:
    "Optional. If filled in, people opening this link will see this name instead of the internal group name.",
  internalLabel: "Reminder for you",
  internalLabelPlaceholder: "For example: link sent on WhatsApp",
  internalLabelHelp:
    "It is not shown to participants. It only helps you recognise this link in the dashboard.",
  filters: {
    search: "Name or code",
    searchPlaceholder: "Name or code",
    contact: "Email or phone",
    contactPlaceholder: "Email or phone",
    group: "Group",
    allGroups: "All groups",
    tag: "Tag",
    allTags: "All tags",
    noTags: "No tag",
    status: "Status",
    sort: "Sort by",
    apply: "Apply",
    reset: "Reset",
    empty: "No participant matches these filters.",
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
    tags: "Tags",
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

    openCard: "Card",
    openCardAria: (name, code) => `Open ${name}${code ? ` ${code}` : ""} card`,
    manage: "Manage",
    manageAria: (name, code) => `Manage ${name}${code ? ` ${code}` : ""}`,
    saveNote: "Save note",

    details: "Details",
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
  },
  statusLabels: {

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
};

const GROUP_LEADER_COPY: Record<SupportedLocale, GroupLeaderCopy> = {
  it: IT_GROUP_LEADER_COPY,
  en: EN_GROUP_LEADER_COPY,
  fr: {
    ...EN_GROUP_LEADER_COPY,
    ...MANUAL_REGISTRATION_COPY.fr,
    exception: GROUP_EXCEPTION_COPY.fr,
    srTitle: "Dashboard responsable de groupe",
    areaDescription: "Gère les participants de tes groupes et signale les personnes qui n’en font pas partie.",
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
    linkSlug: "Slug (adresse du lien)",
    linkSlugHelp: "Si vous modifiez le slug, l’ancienne URL ne sera plus valide.",
    saveLinkName: "Enregistrer le lien",
    inactiveGroupHelp:
      "Ce groupe est relié à ton compte, mais il n'est pas actif dans le catalogue opérationnel. Avant d'utiliser des liens ou des ajouts manuels, un manager/admin doit le réactiver ou te relier au bon groupe.",
    noGroups: "Aucun groupe n'est relié à ton compte.",
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
    noActiveLinks: "Aucun lien actif.",
    publicLabel: "Nom affiché à la personne qui s'inscrit",
    publicLabelHelp:
      "Optionnel. Si ce champ est rempli, les personnes qui ouvrent ce lien verront ce nom à la place du nom interne du groupe.",
    internalLabel: "Mémo pour toi",
    internalLabelPlaceholder: "Par exemple : lien envoyé sur WhatsApp",
    internalLabelHelp:
      "Il n'est pas affiché aux participants. Il sert seulement à reconnaître ce lien dans le tableau de bord.",
    filters: {
      ...EN_GROUP_LEADER_COPY.filters,
      search: "Nom ou code",
      searchPlaceholder: "Nom ou code",
      contact: "Email ou téléphone",
      contactPlaceholder: "Email ou téléphone",
      status: "État",
      sort: "Trier par",
      apply: "Appliquer",
      reset: "Réinitialiser",
      empty: "Aucun participant avec ces filtres.",
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

      manage: "Gérer",
      manageAria: (name, code) => `Gérer ${name}${code ? ` ${code}` : ""}`,
      saveNote: "Enregistrer la note",

    },
    statusLabels: {

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
  },
  de: {
    ...EN_GROUP_LEADER_COPY,
    ...MANUAL_REGISTRATION_COPY.de,
    exception: GROUP_EXCEPTION_COPY.de,
    srTitle: "Dashboard Gruppenleitung",
    areaDescription: "Verwalte die Teilnehmenden deiner Gruppen und melde Personen, die nicht zur Gruppe gehören.",
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
    linkSlug: "Slug (Linkadresse)",
    linkSlugHelp: "Wenn Sie den Slug ändern, ist die bisherige URL nicht mehr gültig.",
    saveLinkName: "Link speichern",
    inactiveGroupHelp:
      "Diese Gruppe ist mit deinem Konto verbunden, aber im operativen Katalog nicht aktiv. Bevor Links oder manuelle Einträge verwendet werden, muss ein Manager/Admin sie reaktivieren oder dich mit der richtigen Gruppe verbinden.",
    noGroups: "Mit deinem Konto ist keine Gruppe verbunden.",
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
    noActiveLinks: "Kein aktiver Link.",
    publicLabel: "Name für die anmeldende Person",
    publicLabelHelp:
      "Optional. Wenn ausgefüllt, sehen Personen, die diesen Link öffnen, diesen Namen statt des internen Gruppennamens.",
    internalLabel: "Notiz für dich",
    internalLabelPlaceholder: "Zum Beispiel: Link per WhatsApp gesendet",
    internalLabelHelp:
      "Wird den Teilnehmenden nicht angezeigt. Hilft nur, diesen Link im Dashboard wiederzuerkennen.",
    filters: {
      ...EN_GROUP_LEADER_COPY.filters,
      search: "Name oder Code",
      searchPlaceholder: "Name oder Code",
      contact: "E-Mail oder Telefon",
      contactPlaceholder: "E-Mail oder Telefon",
      status: "Status",
      sort: "Sortieren nach",
      apply: "Anwenden",
      reset: "Zurücksetzen",
      empty: "Keine Teilnehmenden mit diesen Filtern.",
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

      manage: "Verwalten",
      manageAria: (name, code) => `${name}${code ? ` ${code}` : ""} verwalten`,
      saveNote: "Notiz speichern",

    },
    statusLabels: {

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
  },
  es: {
    ...EN_GROUP_LEADER_COPY,
    ...MANUAL_REGISTRATION_COPY.es,
    exception: GROUP_EXCEPTION_COPY.es,
    srTitle: "Panel responsable de grupo",
    areaDescription: "Gestiona los participantes de tus grupos e indica quién no pertenece al grupo.",
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
    linkSlug: "Slug (dirección del enlace)",
    linkSlugHelp: "Al cambiar el slug, la URL anterior dejará de ser válida.",
    saveLinkName: "Guardar enlace",
    inactiveGroupHelp:
      "Este grupo está vinculado a tu cuenta, pero no está activo en el catálogo operativo. Antes de usar enlaces o entradas manuales, un manager/admin debe reactivarlo o conectarte al grupo correcto.",
    noGroups: "Ningún grupo está vinculado a tu cuenta.",
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
    noActiveLinks: "Ningún enlace activo.",
    publicLabel: "Nombre mostrado a quien se inscribe",
    publicLabelHelp:
      "Opcional. Si se completa, quien abra este enlace verá este nombre en lugar del nombre interno del grupo.",
    internalLabel: "Recordatorio para ti",
    internalLabelPlaceholder: "Por ejemplo: enlace enviado por WhatsApp",
    internalLabelHelp:
      "No se muestra a los participantes. Sirve solo para reconocer este enlace en el panel.",
    filters: {
      ...EN_GROUP_LEADER_COPY.filters,
      search: "Nombre o código",
      searchPlaceholder: "Nombre o código",
      contact: "Email o teléfono",
      contactPlaceholder: "Email o teléfono",
      status: "Estado",
      sort: "Ordenar por",
      apply: "Aplicar",
      reset: "Restablecer",
      empty: "Ningún participante con estos filtros.",
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

      manage: "Gestionar",
      manageAria: (name, code) => `Gestionar ${name}${code ? ` ${code}` : ""}`,
      saveNote: "Guardar nota",

    },
    statusLabels: {

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
  },
  nl: {
    ...EN_GROUP_LEADER_COPY,
    ...MANUAL_REGISTRATION_COPY.nl,
    exception: GROUP_EXCEPTION_COPY.nl,
    srTitle: "Dashboard groepsleider",
    areaDescription: "Beheer de deelnemers van je groepen en meld wie niet bij de groep hoort.",
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
    linkSlug: "Slug (linkadres)",
    linkSlugHelp: "Als je de slug wijzigt, is de vorige URL niet meer geldig.",
    saveLinkName: "Link opslaan",
    inactiveGroupHelp:
      "Deze groep is gekoppeld aan je account, maar is niet actief in de operationele catalogus. Voordat je links of handmatige invoer gebruikt, moet een manager/admin de groep opnieuw activeren of je aan de juiste groep koppelen.",
    noGroups: "Er is geen groep aan je account gekoppeld.",
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
    noActiveLinks: "Geen actieve link.",
    publicLabel: "Naam getoond aan wie zich inschrijft",
    publicLabelHelp:
      "Optioneel. Als dit is ingevuld, zien mensen die deze link openen deze naam in plaats van de interne groepsnaam.",
    internalLabel: "Herinnering voor jou",
    internalLabelPlaceholder: "Bijvoorbeeld: link gestuurd via WhatsApp",
    internalLabelHelp:
      "Wordt niet aan deelnemers getoond. Het helpt alleen om deze link in het dashboard te herkennen.",
    filters: {
      ...EN_GROUP_LEADER_COPY.filters,
      search: "Naam of code",
      searchPlaceholder: "Naam of code",
      contact: "E-mail of telefoon",
      contactPlaceholder: "E-mail of telefoon",
      status: "Status",
      sort: "Sorteren op",
      apply: "Toepassen",
      reset: "Wissen",
      empty: "Geen deelnemer met deze filters.",
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

      manage: "Beheren",
      manageAria: (name, code) => `${name}${code ? ` ${code}` : ""} beheren`,
      saveNote: "Notitie opslaan",

    },
    statusLabels: {

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
  },
  uk: {
    ...EN_GROUP_LEADER_COPY,
    ...MANUAL_REGISTRATION_COPY.uk,
    exception: GROUP_EXCEPTION_COPY.uk,
    srTitle: "Панель керівника групи",
    areaDescription: "Керуйте учасниками своїх груп і повідомляйте про тих, хто не належить до групи.",
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
    linkSlug: "Slug (адреса посилання)",
    linkSlugHelp: "Після зміни slug попередня URL-адреса більше не буде дійсною.",
    saveLinkName: "Зберегти посилання",
    inactiveGroupHelp:
      "Ця група пов'язана з вашим обліковим записом, але не активна в робочому каталозі. Перед використанням посилань або ручного додавання manager/admin має повторно активувати її або прив'язати вас до правильної групи.",
    noGroups: "До вашого облікового запису не прив'язано жодної групи.",
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
    noActiveLinks: "Немає активних посилань.",
    publicLabel: "Назва, показана тому, хто реєструється",
    publicLabelHelp:
      "Необов'язково. Якщо заповнити, люди, які відкриють це посилання, побачать цю назву замість внутрішньої назви групи.",
    internalLabel: "Нагадування для вас",
    internalLabelPlaceholder: "Наприклад: посилання надіслано у WhatsApp",
    internalLabelHelp:
      "Не показується учасникам. Потрібно лише для розпізнавання цього посилання на панелі.",
    filters: {
      ...EN_GROUP_LEADER_COPY.filters,
      search: "Ім'я або код",
      searchPlaceholder: "Ім'я або код",
      contact: "Email або телефон",
      contactPlaceholder: "Email або телефон",
      status: "Стан",
      sort: "Сортувати за",
      apply: "Застосувати",
      reset: "Скинути",
      empty: "Немає учасників за цими фільтрами.",
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

      manage: "Керувати",
      manageAria: (name, code) => `Керувати ${name}${code ? ` ${code}` : ""}`,
      saveNote: "Зберегти нотатку",

    },
    statusLabels: {

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
  },
};

export default async function CapogruppoDashboardPage({
  searchParams,
}: CapogruppoPageProps) {
  const locale = await getRequestLocale();
  const copy = GROUP_LEADER_COPY[locale] ?? GROUP_LEADER_COPY.en;
  const params = await searchParams;
  const query = normalizeSearchQuery(params.q);
  const contactQuery = normalizeSearchQuery(params.contact);
  const groupFilter = normalizeFilterParam(params.group);
  const tagFilter = normalizeFilterParam(params.tag);
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

  const { groupRows, activeGroupRows, rootGroupIds, scopedGroupIds } =
    await loadLeaderScope(serviceSupabase, auth.user.id, currentEventId);

  const [assignments, operationalTags, groupLinks] =
    await Promise.all([
      getAssignments([...scopedGroupIds]),
      getOperationalTags(),
      activeTool === "link" ? getGroupLinks([...scopedGroupIds]) : Promise.resolve([]),
    ]);
  const assignedGroups = groupRows
    .filter((group) => rootGroupIds.includes(group.id))
    .map((group) => toScopedGroupView(group, copy));
  const scopedGroups = activeGroupRows
    .filter((group) => scopedGroupIds.has(group.id))
    .map((group) => toScopedGroupView(group, copy));
  const currentAssignments = assignments.filter(
    (assignment) => assignment.isCurrent
  );
  const groupFilterOptions = buildGroupFilterOptions(currentAssignments, locale);
  const showGroupColumn = groupFilterOptions.length > 1 || groupFilter !== "all";
  const effectiveGroupFilter = groupFilter;
  const tableParams = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  const returnTo = leaderReturnPath(`/dashboard/capogruppo?${tableParams}`);
  const tableAssignments = filterLeaderRows(currentAssignments, tableParams);
  const selectedAssignment =
    params.assignmentId
      ? assignments.find((assignment) => assignment.id === params.assignmentId) ?? null
      : null;

  const [selectedQr, selectedAttendance] = selectedAssignment
    ? await Promise.all([
        loadLeaderAssignmentQr(serviceSupabase, auth.user.id, currentEventId, selectedAssignment.id),
        loadLeaderAttendance(serviceSupabase, auth.user.id, currentEventId, selectedAssignment.id),
      ])
    : [null, null];

  return (
    <main className="app-page text-[var(--peace-ink)]">
      <PreserveDashboardScroll />
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
          locale={locale}
          error={params.error ?? params.groupLinkError}
          saved={params.saved ?? params.groupLinkSaved ?? params.manualSaved}
          copy={copy}
        />

        <StatusMessage locale={locale} error={params.manualError} saved={undefined} copy={copy} />

        <AssignedScopeSection
          assignedGroups={assignedGroups}
          assignableGroups={scopedGroups.filter(
            (group) => group.isActive && group.isAssignable
          )}
          copy={copy}
        />

        <section
          id="assegnazioni-gruppo"
          className="min-w-0 rounded-lg border border-[var(--peace-border)] bg-white p-5"
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
            query={query}
            contactQuery={contactQuery}
            groupFilter={effectiveGroupFilter}
            tagFilter={tagFilter}
            groupOptions={groupFilterOptions}
            tagOptions={operationalTags}
            showGroupColumn={showGroupColumn}
            copy={copy}
          />

          <LeaderParticipantsTable
            rows={tableAssignments.map(toLeaderTableRow)}
            operatorId={auth.user.id}
            startsOn={assignedGroups[0]?.eventStartsOn ?? null}
            endsOn={assignedGroups[0]?.eventEndsOn ?? null}
            locale={locale}
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
                action={createGroupLeaderManualRegistration}
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
          <LocalOverlay parameter="assignmentId" value={selectedAssignment.id}>
            <DashboardToolOverlay localClose title={copy.detail.title} copy={copy} closePath={leaderReturnPath(returnTo, { assignmentId: null })}>
              <AssignmentDetailCard
                returnTo={returnTo}
                qr={selectedQr}
                attendance={selectedAttendance}
                attendanceSaved={params.saved === "attendance"}
                locale={locale}
                assignment={selectedAssignment}
                tagOptions={operationalTags}
                copy={copy}
              />
            </DashboardToolOverlay>
          </LocalOverlay>
        ) : null}

      </section>
    </main>
  );

  async function getAssignments(
    groupIds: string[]
  ): Promise<AssignmentView[]> {
    if (groupIds.length === 0) {
      return [];
    }

    const data = await loadLeaderAssignmentRows(serviceSupabase, currentEventId!, groupIds, locale);

    return data
      .map((row) => toAssignmentView(row, copy, groupRows))
      .filter((assignment): assignment is AssignmentView => Boolean(assignment));
  }

  async function getGroupLinks(groupIds: string[]): Promise<GroupLinkView[]> {
    if (groupIds.length === 0) {
      return [];
    }

    const { data } = await loadRowsForIds(groupIds, (batch, from, to) => serviceSupabase
      .from("group_registration_links")
      .select(
        "id,event_id,group_id,public_label,internal_label,token_encrypted,slug,use_count,max_uses,created_at,expires_at,revoked_at"
      )
      .in("group_id", batch)
      .eq("event_id", currentEventId)
      .eq("is_canonical", true)
      .order("created_at", { ascending: false }).order("id").range(from, to));

    return ((data ?? []) as GroupLinkRow[]).map((link) => ({
      id: link.id,
      eventId: link.event_id,
      groupId: link.group_id,
      publicLabel: link.public_label,
      internalLabel: link.internal_label,
      url: link.slug ? buildGroupRegistrationUrl({ appUrl: getAppUrl(), token: link.slug }) : buildGroupLinkUrlFromEncryptedToken(link.token_encrypted),
      useCount: link.use_count ?? 0,
      maxUses: link.max_uses,
      createdAt: link.created_at,
      expiresAt: link.expires_at,
      revokedAt: link.revoked_at,
    }));
  }

  async function getOperationalTags(): Promise<OperationalTagOption[]> {
    const { data } = await loadAllRows((from, to) => serviceSupabase
      .from("operational_tags")
      .select("id,event_id,label,color")
      .eq("event_id", currentEventId)
      .order("label", { ascending: true }).order("id").range(from, to));

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
                    {copy.manageLinks}
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
  closePath = "/dashboard/capogruppo",
  localClose = false,
  title,
  copy,
  children,
}: {
  title: string;
  closePath?: string;
  localClose?: boolean;
  copy: GroupLeaderCopy;
  children: ReactNode;
}) {
  const CloseLink = localClose ? LocalQueryLink : Link;
  return (
    <div className="dashboard-modal fixed inset-0 z-40 grid place-items-center modal-backdrop px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-[var(--peace-border)] bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold text-[var(--peace-ink)]">{title}</h2>
          <CloseLink
            href={closePath}
            scroll={false}
            className="inline-flex h-10 min-w-10 items-center justify-center rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
            aria-label={copy.close}
          >
            {copy.close}
          </CloseLink>
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
              <div
                className={[
                  "grid gap-4",
                  groupLinks.length === 0 ? "lg:grid-cols-[1fr_340px]" : "",
                ].join(" ")}
              >
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

                  <div className="mt-5 grid gap-3 border-t border-[var(--peace-border)] pt-4">
                    <h4 className="text-sm font-semibold text-[var(--peace-ink)]">
                      {copy.existingLinks}
                    </h4>
                    {groupLinks.map((link) => (
                      <div
                        key={link.id}
                        className="rounded-md border border-[var(--peace-border)] bg-white p-3 text-sm"
                      >
                        <ReliableForm
                          action={updateGroupRegistrationLink}
                          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                          data-preserve-dashboard-scroll
                        >
                          <input type="hidden" name="sourceDashboard" value="capogruppo" />
                          <input type="hidden" name="linkId" value={link.id} />
                          <label className="grid gap-1 text-xs font-semibold text-[var(--peace-muted)]">
                            {copy.publicLabel}
                            <input
                              name="displayName"
                              className="field bg-white text-sm"
                              defaultValue={
                                link.publicLabel ?? group.publicLabel ?? group.name
                              }
                              required
                            />
                          </label>
                          <label className="grid gap-1 text-xs font-semibold text-[var(--peace-muted)]">
                        {copy.linkSlug}
                        <input name="slug" className="field bg-white text-sm" defaultValue={link.url ? decodeURIComponent(new URL(link.url).pathname.slice(1)) : ""} pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,95}" minLength={3} maxLength={96} required />
                        <span className="font-normal">{copy.linkSlugHelp}</span>
                      </label>
                      <PendingSubmitButton className="min-h-10 rounded-md border border-[var(--peace-border-strong)] px-3 text-xs font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]">
                            {copy.saveLinkName}
                          </PendingSubmitButton>
                        </ReliableForm>
                        <p className="mt-1 text-xs text-[var(--peace-muted)]">
                          {groupLinkStatusLabel(link, locale, copy)} - {copy.uses} {link.useCount}
                          {link.maxUses ? `/${link.maxUses}` : ""}
                        </p>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                          {link.url ? (
                            <input
                              readOnly
                              className="field min-w-0 flex-1 bg-[#f7fbfe] font-mono text-xs"
                              value={link.url}
                            />
                          ) : null}
                          {link.url ? (
                            <CopyLinkButton
                              iconOnly
                              label={copy.copyLink}
                              url={link.url}
                            />
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {groupLinks.length === 0 ? (
                      <p className="text-sm text-[var(--peace-muted)]">{copy.noActiveLinks}</p>
                    ) : null}
                  </div>
                </div>


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

function AssignmentFilters({
  query,
  contactQuery,
  groupFilter,
  tagFilter,
  groupOptions,
  tagOptions,
  showGroupColumn,
  copy,
}: {
  query: string;
  contactQuery: string;
  groupFilter: string;
  tagFilter: string;
  groupOptions: Array<{ id: string; name: string }>;
  tagOptions: OperationalTagOption[];
  showGroupColumn: boolean;
  copy: GroupLeaderCopy;
}) {
  const filterGridClassName = showGroupColumn
    ? "grid min-w-[860px] grid-cols-[minmax(220px,1.4fr)_minmax(220px,1.4fr)_minmax(190px,1fr)_minmax(170px,1fr)_auto] gap-3"
    : "grid min-w-[760px] grid-cols-[minmax(220px,1.4fr)_minmax(220px,1.4fr)_minmax(170px,1fr)_auto] gap-3";

  return (
    <AutoFilterForm
      action="/dashboard/capogruppo"
      className="mt-5"
      defaults={{
        q: "",
        contact: "",
        group: "all",
        tag: "all",
      }}
    >
      <div className="overflow-x-auto rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-3">
        <div className={filterGridClassName}>
          <label className="sr-only" htmlFor="leader-participant-q">
            {copy.filters.search}
          </label>
          <input
            id="leader-participant-q"
            name="q"
            defaultValue={query}
            className="field min-h-10 bg-white text-sm font-normal"
            placeholder={copy.filters.searchPlaceholder}
          />

          <label className="sr-only" htmlFor="leader-participant-contact">
            {copy.filters.contact}
          </label>
          <input
            id="leader-participant-contact"
            name="contact"
            defaultValue={contactQuery}
            className="field min-h-10 bg-white text-sm font-normal"
            placeholder={copy.filters.contactPlaceholder}
          />

          {showGroupColumn ? (
            <>
              <label className="sr-only" htmlFor="leader-participant-group">
                {copy.filters.group}
              </label>
              <select
                id="leader-participant-group"
                name="group"
                defaultValue={groupFilter}
                className="field min-h-10 bg-white text-sm font-normal"
              >
                <option value="all">{copy.filters.allGroups}</option>
                {groupOptions.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          <label className="sr-only" htmlFor="leader-participant-tag">
            {copy.filters.tag}
          </label>
          <select
            id="leader-participant-tag"
            name="tag"
            defaultValue={tagFilter}
            className="field min-h-10 bg-white text-sm font-normal"
          >
            <option value="all">{copy.filters.allTags}</option>
            <option value="none">{copy.filters.noTags}</option>
            {tagOptions.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.label}
              </option>
            ))}
          </select>

          <Link
            href="/dashboard/capogruppo#assegnazioni-gruppo"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--peace-border-strong)] bg-white px-3 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
          >
            {copy.filters.reset}
          </Link>
        </div>
      </div>
    </AutoFilterForm>
  );
}

function AssignmentDetailCard({
  attendanceSaved,
  attendance,
  qr,
  locale,
  returnTo,
  assignment,
  tagOptions,
  copy,
}: {
  assignment: AssignmentView;
  qr: RegistrationQrPreview | null;
  attendance: Awaited<ReturnType<typeof loadLeaderAttendance>>;
  attendanceSaved: boolean;
  locale: SupportedLocale;
  returnTo: string;
  tagOptions: OperationalTagOption[];
  copy: GroupLeaderCopy;
}) {

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
      </div>

      <LeaderParticipantQr
        qr={qr ?? { state: "unavailable", dataUrl: null, downloadDataUrl: null, expiresAt: null }}
        participantName={assignment.participantName}
        participantCode={assignment.participantCode}
        locale={locale}
      />

      {attendance ? (
        <LeaderParticipantAttendance assignmentId={assignment.id} returnTo={returnTo}
          attendance={attendance} locale={locale} copy={copy.attendance}
          key={attendanceSaved ? randomUUID() : assignment.id} action={updateGroupLeaderAttendance} savedMessage={attendanceSaved ? copy.saved : undefined} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <DetailBlock title={copy.detail.identity}>
          <ReliableForm
            action={updateGroupLeaderParticipantContact}
            className="grid gap-3"
            data-preserve-dashboard-scroll
          >
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="assignmentId" value={assignment.id} />
            <input type="hidden" name="participantId" value={assignment.participantId} />
            <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
              {copy.firstName}
              <input
                name="firstName"
                defaultValue={assignment.participantFirstName ?? ""}
                className="field bg-white font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
              {copy.lastName}
              <input
                name="lastName"
                defaultValue={assignment.participantLastName ?? ""}
                className="field bg-white font-normal"
              />
            </label>
            <ParticipantBirthDateField key={`${assignment.id}:${assignment.birthDate}`}
              label={copy.birthDate} locale={locale} defaultValue={assignment.birthDate ?? ""} />
            <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
              Città
              <input
                name="city"
                defaultValue={assignment.participantCity ?? ""}
                className="field bg-white font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
              Paese
              <input
                name="country"
                defaultValue={assignment.participantCountry ?? ""}
                className="field bg-white font-normal"
              />
            </label>
            <PendingSubmitButton className="min-h-10 w-fit rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
              Salva
            </PendingSubmitButton>
          </ReliableForm>
        </DetailBlock>

        <DetailBlock title={copy.detail.contacts}>
          <ReliableForm
            action={updateGroupLeaderParticipantContact}
            className="grid gap-3"
            data-preserve-dashboard-scroll
          >
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="assignmentId" value={assignment.id} />
            <input type="hidden" name="participantId" value={assignment.participantId} />
            <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
              {copy.email}
              <input
                name="email"
                type="email"
                defaultValue={assignment.participantEmail ?? ""}
                className="field bg-white font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
              {copy.phone}
              <input
                name="phone"
                defaultValue={assignment.participantPhone ?? ""}
                className="field bg-white font-normal"
              />
            </label>
            <PendingSubmitButton className="min-h-10 w-fit rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
              Salva
            </PendingSubmitButton>
          </ReliableForm>
        </DetailBlock>

        {assignment.isCurrent ? <OperationalAccessibilityEditor key={assignment.registrationId} registrationId={assignment.registrationId} locale={locale} /> : null}
        <DetailBlock title={`Figli partecipanti (${assignment.children.length})`}>
          <OperationalChildrenEditor registrationId={assignment.registrationId} records={assignment.children} locale={locale} editable={assignment.isCurrent} />
        </DetailBlock>
      </div>

      <DetailBlock title={copy.detail.assignment}>
        <p className="text-sm font-semibold">{assignment.groupName}</p>
        {assignment.isCurrent ? (
          <ReliableForm action={updateGroupLeaderAssignment} className="mt-3 grid gap-3" data-preserve-dashboard-scroll>
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="assignmentId" value={assignment.id} />
            <p className="text-xs text-[var(--peace-muted)]">{copy.exception.help}</p>
            <ConfirmSubmitButton
              name="intent"
              value="reject"
              confirmMessage={copy.exception.warning(assignment.participantName)}
              className="min-h-10 w-fit text-left text-xs text-[var(--peace-muted)] underline decoration-dotted underline-offset-4 hover:text-[var(--peace-ink)]"
            >
              {copy.exception.reject}
            </ConfirmSubmitButton>
          </ReliableForm>
        ) : null}
      </DetailBlock>

      <DetailBlock title={copy.detail.notes}>
        <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--peace-ink)]">
          {assignment.leaderInternalNote ?? copy.detail.noNote}
        </p>
      </DetailBlock>

      <DetailBlock title="Servizio">
        <ParticipantServiceSummary service={assignment.service} />
      </DetailBlock>

      <ReliableForm
        action={updateGroupLeaderAssignment}
        className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4"
        data-preserve-dashboard-scroll
      >
        <input type="hidden" name="returnTo" value={returnTo} />
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
        </div>
      </ReliableForm>

      <ReliableForm
        action={updateParticipantOperationalTags}
        className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4"
        data-preserve-dashboard-scroll
      >
        <input type="hidden" name="sourceDashboard" value="capogruppo" />
        <input type="hidden" name="returnTo" value={returnTo} />
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
          Salva
        </PendingSubmitButton>
      </ReliableForm>
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


function ParticipantServiceSummary({
  service,
}: {
  service: ParticipantEventService | null;
}) {
  if (!service) {
    return <span className="text-sm text-[var(--peace-muted)]">Senza servizio</span>;
  }

  return (
    <div className="grid gap-1">
      <span className="font-semibold text-[var(--peace-ink)]">{service.serviceLabel}</span>
      <span className="text-xs text-[var(--peace-muted)]">
        {eventServiceStatusLabel(service.status)}
      </span>
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

function StatusMessage({
  locale,
  error,
  saved,
  copy,
}: {
  locale: SupportedLocale;
  error: string | undefined;
  saved: string | undefined;
  copy: GroupLeaderCopy;
}) {
  if (saved) {
    return (
      <SuccessMessage key={randomUUID()} clearQuery locale={locale} className="rounded-lg border border-[#bad2b8] bg-[#edf7ea] p-4 text-sm text-[#2f6541]">
        {saved === "reported" ? copy.exception.sent : copy.saved}
      </SuccessMessage>
    );
  }

  if (!error) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[#e0b6af] bg-[#fff0ee] p-4 text-sm text-[#8a3f35]">
      {error === "access-email"
        ? ACCESS_EMAIL_COPY[locale].failed
        : error === "link-already-exists"
        ? copy.linkAlreadyExists
        : `${copy.errorPrefix}: ${error}.`}
    </div>
  );
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

function normalizeSearchQuery(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function normalizeFilterParam(value: string | null | undefined): string {
  const normalized = typeof value === "string" ? value.trim() : "";

  return normalized || "all";
}

function parseDashboardTool(value: string | null | undefined): DashboardTool | null {
  return value === "link" || value === "manual" ? value : null;
}

function dashboardToolTitle(
  tool: DashboardTool,
  copy: GroupLeaderCopy
): string {
  return tool === "link" ? copy.manageLinks : copy.addParticipant;
}


function buildGroupFilterOptions(
  assignments: AssignmentView[],
  locale: SupportedLocale
): Array<{ id: string; name: string }> {
  const groups = new Map<string, string>();

  for (const assignment of assignments) {
    groups.set(assignment.groupId, assignment.groupName);
  }

  return [...groups.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, locale));
}

function getManualRegistrationEventDays(
  groups: ScopedGroupView[],
  locale: SupportedLocale
): AttendanceDayColumn[] {
  const event = groups.find((group) => group.eventStartsOn);

  return buildAttendanceDayColumns(
    event?.eventStartsOn ?? null,
    event?.eventEndsOn ?? null,
    locale
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

function buildGroupLinkUrlFromEncryptedToken(encryptedToken: string | null): string | null {
  const token = decryptQrToken(encryptedToken);

  return token ? buildGroupRegistrationUrl({ appUrl: getAppUrl(), token }) : null;
}
