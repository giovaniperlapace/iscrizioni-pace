import { normalizeLocale, type SupportedLocale } from "../i18n/config.ts";
import { FORUM_RELAY_COPY } from "./relay-copy.ts";
import { parseForumIntent } from "./booking-intent.ts";

export type ForumReminderPayload = {
  eventId: string; registrationId: string; panelId: string;
  title: string; startsAt: string; endsAt: string;
  location: string; address: string | null; city: string | null;
  locale: string | null; name: string; children: string[]; relay: boolean;
};
export type ForumReminderNotice = {
  id: string; claim: string; eventId: string; recipientKey: string; panelId: string;
  payload: ForumReminderPayload[];
};
type Copy = { subject: string; body: string; person: string; when: string; arrival: string; venue: string; address: string; children: string; delegated: string };
const COPY: Record<SupportedLocale, Copy> = {
  it: { subject: "Promemoria della tua iscrizione al Forum", body: "Ti ricordiamo la prenotazione confermata al seguente Forum. Ti aspettiamo nella sede indicata qui sotto.", person: "Partecipante", when: "Data e ora", arrival: "Presentati con anticipo. Dopo l’orario d’inizio della conferenza, l’ingresso non è garantito.", venue: "Sede", address: "INDIRIZZO", children: "Minori prenotati insieme al partecipante", delegated: "Ricevi questo promemoria per il partecipante indicato, che ti ha delegato le comunicazioni. Ti chiediamo di trasmettergli queste informazioni." },
  en: { subject: "Your Forum booking reminder", body: "This is a reminder of your confirmed booking for the following Forum. We look forward to welcoming you at the venue below.", person: "Participant", when: "Date and time", arrival: "Please arrive early. Entry is not guaranteed after the scheduled start of the conference.", venue: "Venue", address: "ADDRESS", children: "Children booked with the participant", delegated: "You are receiving this reminder for the named participant, who delegated communications to you. Please pass this information on to them." },
  fr: { subject: "Rappel de votre inscription au Forum", body: "Nous vous rappelons votre réservation confirmée au Forum suivant. Nous vous attendons au lieu indiqué ci-dessous.", person: "Participant", when: "Date et heure", arrival: "Présentez-vous en avance. Après l’heure de début de la conférence, l’entrée n’est pas garantie.", venue: "Lieu", address: "ADRESSE", children: "Mineurs inscrits avec le participant", delegated: "Vous recevez ce rappel pour le participant indiqué, qui vous a confié ses communications. Merci de lui transmettre ces informations." },
  de: { subject: "Erinnerung an Ihre Forum-Anmeldung", body: "Wir erinnern Sie an Ihre bestätigte Buchung für das folgende Forum. Wir freuen uns auf Sie am unten angegebenen Veranstaltungsort.", person: "Teilnehmende Person", when: "Datum und Uhrzeit", arrival: "Bitte kommen Sie frühzeitig. Nach der vorgesehenen Anfangszeit der Konferenz ist der Einlass nicht garantiert.", venue: "Veranstaltungsort", address: "ADRESSE", children: "Mit der Person angemeldete Minderjährige", delegated: "Sie erhalten diese Erinnerung für die genannte Person, die Ihnen ihre Kommunikation übertragen hat. Bitte geben Sie diese Informationen weiter." },
  es: { subject: "Recordatorio de tu inscripción al Foro", body: "Te recordamos tu reserva confirmada para el siguiente Foro. Te esperamos en la sede indicada a continuación.", person: "Participante", when: "Fecha y hora", arrival: "Llega con antelación. Después de la hora de inicio de la conferencia, la entrada no está garantizada.", venue: "Sede", address: "DIRECCIÓN", children: "Menores inscritos con el participante", delegated: "Recibes este recordatorio para el participante indicado, que te ha delegado sus comunicaciones. Por favor, transmítele esta información." },
  nl: { subject: "Herinnering aan je Forum-inschrijving", body: "Dit is een herinnering aan je bevestigde reservering voor het volgende Forum. We verwelkomen je graag op de hieronder vermelde locatie.", person: "Deelnemer", when: "Datum en tijd", arrival: "Kom op tijd vóór aanvang. Na de geplande begintijd van de conferentie is toegang niet gegarandeerd.", venue: "Locatie", address: "ADRES", children: "Minderjarigen ingeschreven met de deelnemer", delegated: "Je ontvangt deze herinnering voor de genoemde deelnemer, die de communicatie aan jou heeft toevertrouwd. Geef deze informatie aan die persoon door." },
  uk: { subject: "Нагадування про вашу реєстрацію на Форум", body: "Нагадуємо про ваше підтверджене бронювання на наступний Форум. Чекаємо на вас за вказаною нижче адресою.", person: "Учасник", when: "Дата й час", arrival: "Приходьте заздалегідь. Після запланованого часу початку конференції вхід не гарантується.", venue: "Місце проведення", address: "АДРЕСА", children: "Неповнолітні, зареєстровані разом з учасником", delegated: "Ви отримуєте це нагадування для зазначеного учасника, який доручив вам отримувати повідомлення. Будь ласка, передайте йому цю інформацію." },
};
const ENTRY_COPY: Record<SupportedLocale, { heading: string; steps: string[]; leader: string }> = {
  it: { heading: "Come accedere al Forum", steps: [
    "Presentati nella sede indicata con il QR code personale della tua iscrizione all’evento, già salvato sul telefono oppure stampato.",
    "All’ingresso mostra il QR code agli operatori per la scansione e la verifica della prenotazione.",
    "Per i minori prenotati con te, mostra lo stesso QR code e indica agli operatori quali sono presenti.",
    "Se non hai ancora effettuato l’accoglienza generale, segnalalo agli operatori prima di entrare."
  ], leader: "Trasmetti queste istruzioni ai partecipanti: ciascun adulto deve mostrare il proprio QR code personale. Il QR code del capogruppo non sostituisce quello degli altri partecipanti." },
  en: { heading: "How to enter the Forum", steps: [
    "Go to the venue indicated with your personal event registration QR code, already saved on your phone or printed.",
    "At the entrance, show your QR code to the reception staff for scanning and verification of your booking.",
    "For children booked with you, show the same QR code and tell the staff which children are present.",
    "If you have not yet completed general event check-in, tell the staff before entering."
  ], leader: "Pass these instructions on to the participants: each adult must show their own personal QR code. The group leader’s QR code does not replace the other participants’ codes." },
  fr: { heading: "Comment accéder au Forum", steps: [
    "Présentez-vous au lieu indiqué avec le code QR personnel de votre inscription à l’événement, déjà enregistré sur votre téléphone ou imprimé.",
    "À l’entrée, montrez votre code QR à l’équipe d’accueil pour qu’elle le scanne et vérifie votre réservation.",
    "Pour les mineurs inscrits avec vous, montrez le même code QR et indiquez à l’équipe lesquels sont présents.",
    "Si vous n’avez pas encore effectué l’accueil général de l’événement, signalez-le à l’équipe avant d’entrer."
  ], leader: "Transmettez ces instructions aux participants : chaque adulte doit montrer son propre code QR personnel. Le code QR du responsable de groupe ne remplace pas ceux des autres participants." },
  de: { heading: "So erhalten Sie Zutritt zum Forum", steps: [
    "Kommen Sie zum angegebenen Veranstaltungsort und bringen Sie den persönlichen QR-Code Ihrer Veranstaltungsanmeldung mit, bereits auf Ihrem Telefon gespeichert oder ausgedruckt.",
    "Zeigen Sie am Eingang Ihren QR-Code dem Empfangsteam zum Scannen und zur Überprüfung Ihrer Buchung.",
    "Zeigen Sie für die mit Ihnen angemeldeten Minderjährigen denselben QR-Code und teilen Sie dem Team mit, wer anwesend ist.",
    "Falls Sie den allgemeinen Check-in für die Veranstaltung noch nicht abgeschlossen haben, informieren Sie das Team vor dem Eintritt."
  ], leader: "Geben Sie diese Hinweise an die Teilnehmenden weiter: Jede erwachsene Person muss ihren eigenen persönlichen QR-Code vorzeigen. Der QR-Code der Gruppenleitung ersetzt nicht die Codes der anderen Teilnehmenden." },
  es: { heading: "Cómo acceder al Foro", steps: [
    "Acude a la sede indicada con el código QR personal de tu inscripción al evento, ya guardado en el teléfono o impreso.",
    "En la entrada, muestra tu código QR al personal de acogida para que lo escanee y compruebe tu reserva.",
    "Para los menores inscritos contigo, muestra el mismo código QR e indica al personal cuáles están presentes.",
    "Si todavía no has realizado la acogida general del evento, comunícalo al personal antes de entrar."
  ], leader: "Transmite estas instrucciones a los participantes: cada adulto debe mostrar su propio código QR personal. El código QR del responsable de grupo no sustituye los de los demás participantes." },
  nl: { heading: "Toegang tot het Forum", steps: [
    "Kom naar de aangegeven locatie met de persoonlijke QR-code van je evenementinschrijving, al opgeslagen op je telefoon of afgedrukt.",
    "Laat bij de ingang je QR-code aan de ontvangstmedewerkers zien, zodat zij deze kunnen scannen en je reservering kunnen controleren.",
    "Gebruik voor minderjarigen die samen met jou zijn ingeschreven dezelfde QR-code en vertel de medewerkers wie aanwezig is.",
    "Heb je de algemene aanmelding bij de ontvangst van het evenement nog niet afgerond, meld dit dan vóór binnenkomst aan de medewerkers."
  ], leader: "Geef deze instructies door aan de deelnemers: iedere volwassene moet de eigen persoonlijke QR-code tonen. De QR-code van de groepsleider vervangt de codes van de andere deelnemers niet." },
  uk: { heading: "Як увійти на Форум", steps: [
    "Прибудьте до зазначеного місця з особистим QR-кодом реєстрації на подію, заздалегідь збереженим на телефоні або роздрукованим.",
    "На вході покажіть QR-код працівникам прийому для сканування та перевірки бронювання.",
    "Для неповнолітніх, зареєстрованих разом із вами, покажіть той самий QR-код і повідомте працівникам, хто присутній.",
    "Якщо ви ще не пройшли загальну реєстрацію прибуття на подію, повідомте про це працівникам перед входом."
  ], leader: "Передайте ці інструкції учасникам: кожен дорослий має показати власний особистий QR-код. QR-код керівника групи не замінює коди інших учасників." },
};
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function renderReminderContent(payload: ForumReminderPayload, locale: SupportedLocale,
  heading: string, body: string, people: { text: string; html: string }, delegated: boolean) {
  const copy = COPY[locale];
  if (!payload.address?.trim() || !payload.location.trim()) throw Error("forum_reminder_address_missing");
  const panelId = parseForumIntent(payload.panelId);
  if (!panelId) throw Error("forum_reminder_panel_invalid");
  const time = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Rome" });
  const address = [payload.address.trim(), payload.city?.trim()].filter(Boolean).join(", ");
  const when = `${copy.when}: ${time.format(new Date(payload.startsAt))} (Europe/Rome)`;
  const entry = ENTRY_COPY[locale];
  const instructions = [...entry.steps, ...(delegated ? [entry.leader] : [])];
  const relay = payload.relay ? [FORUM_RELAY_COPY[locale].badge, FORUM_RELAY_COPY[locale].notice] : [];
  return {
    subject: `${heading} — ${payload.title.replace(/[\r\n]+/g, " ")}`,
    text: [body, payload.title, `${when}\n${copy.arrival}`, `${copy.venue}: ${payload.location}`, `${copy.address}: ${address}`, ...relay, entry.heading, ...instructions, people.text].join("\n\n"),
    html: `<div lang="${locale}" style="font-family:Arial,sans-serif;line-height:1.6;color:#172c46;max-width:640px;margin:auto;padding:24px">`
      + `<h1 style="font-size:24px">${escape(heading)}</h1><p>${escape(body)}</p><h2 style="font-size:20px">${escape(payload.title)}</h2><p>${escape(when)}<br><strong>${escape(copy.arrival)}</strong></p>`
      + `<div style="background:#eef4fa;border:2px solid #172c46;border-radius:12px;padding:20px"><p style="margin:0"><strong>${escape(copy.venue)}: ${escape(payload.location)}</strong></p>`
      + `<p style="font-size:20px;margin:12px 0 0"><strong>${escape(copy.address)}<br>${escape(address)}</strong></p></div>`
      + relay.map(p => `<p><strong>${escape(p)}</strong></p>`).join("")
      + `<h2 style="font-size:20px">${escape(entry.heading)}</h2><ol>${instructions.map(step => `<li>${escape(step)}</li>`).join("")}</ol>`
      + people.html + "</div>",
  };
}

export function renderForumReminderEmail(payload: ForumReminderPayload, delegated = false) {
  const locale = normalizeLocale(payload.locale) ?? "en";
  const copy = COPY[locale];
  const people = [`${copy.person}: ${payload.name}`,
    ...(payload.children.length ? [`${copy.children}: ${payload.children.join(", ")}`] : [])];
  return renderReminderContent(payload, locale, copy.subject, delegated ? copy.delegated : copy.body,
    { text: people.join("\n\n"), html: people.map(p => `<p>${escape(p)}</p>`).join("") }, delegated);
}

const DIGEST_COPY: Record<SupportedLocale, { subject: string; body: string; people: string }> = {
  it: { subject: "Promemoria Forum — riepilogo partecipanti", body: "Queste persone ti hanno delegato le comunicazioni e risultano prenotate al Forum indicato. Trasmetti loro l’orario, la sede e l’indirizzo riportati qui sotto.", people: "Partecipanti prenotati" },
  en: { subject: "Forum reminder — participant summary", body: "These participants delegated communications to you and have bookings for this Forum. Please share the time, venue and address below with them.", people: "Booked participants" },
  fr: { subject: "Rappel Forum — récapitulatif des participants", body: "Ces personnes vous ont confié leurs communications et sont inscrites à ce Forum. Merci de leur transmettre l’horaire, le lieu et l’adresse ci-dessous.", people: "Participants inscrits" },
  de: { subject: "Forum-Erinnerung — Teilnehmerübersicht", body: "Diese Personen haben Ihnen ihre Kommunikation übertragen und sind für dieses Forum angemeldet. Bitte geben Sie ihnen die Uhrzeit, den Veranstaltungsort und die Adresse weiter.", people: "Angemeldete Personen" },
  es: { subject: "Recordatorio del Foro — resumen de participantes", body: "Estas personas te han delegado sus comunicaciones y están inscritas en este Foro. Transmíteles el horario, la sede y la dirección que figuran a continuación.", people: "Participantes inscritos" },
  nl: { subject: "Forumherinnering — deelnemersoverzicht", body: "Deze deelnemers hebben hun communicatie aan jou toevertrouwd en zijn ingeschreven voor dit Forum. Deel de onderstaande tijd, locatie en het adres met hen.", people: "Ingeschreven deelnemers" },
  uk: { subject: "Нагадування про Форум — список учасників", body: "Ці учасники доручили вам отримувати повідомлення та зареєстровані на цей Форум. Передайте їм зазначені нижче час, місце проведення та адресу.", people: "Зареєстровані учасники" },
};

export function renderForumReminderDigest(payloads: ForumReminderPayload[], localeValue?: string | null) {
  const first = payloads[0];
  if (!first || payloads.some(p => p.panelId !== first.panelId || p.startsAt !== first.startsAt
    || p.location !== first.location || p.address !== first.address || p.city !== first.city)) throw Error("forum_reminder_digest_mismatch");
  const locale = normalizeLocale(localeValue) ?? "en";
  const copy = COPY[locale], digest = DIGEST_COPY[locale];
  const names = payloads.map(p => `${p.name}${p.children.length ? ` — ${copy.children}: ${p.children.join(", ")}` : ""}`);
  const title = `${digest.people} (${payloads.length})`;
  return renderReminderContent({ ...first, locale }, locale, digest.subject, digest.body,
    { text: `${title}:\n${names.join("\n")}`, html: `<h2>${escape(title)}</h2><ul>${names.map(name => `<li>${escape(name)}</li>`).join("")}</ul>` }, true);
}
