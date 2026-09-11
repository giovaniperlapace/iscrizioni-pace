import { normalizeLocale } from "../i18n/config.ts";
import { EMAIL_DELIVERY_COPY } from "../i18n/email-delivery.ts";

export const ACCESS_EMAIL_COPY = {
  it: {
    subject: "La tua iscrizione è pronta",
    greeting: "Ciao",
    registered: "sei stato registrato per partecipare all’Incontro internazionale per la Pace \"Pace disarmata e disarmante\" ad Assisi. Usa questo link per accedere alla tua iscrizione:",
    access: "Inserisci l’indirizzo email a cui hai ricevuto questo messaggio. Riceverai un link personale per accedere: non serve una password.",
    complete: "Nella tua area personale puoi controllare e completare i dati già inseriti, aggiornare la tua iscrizione e scaricare il QR personale. Non occorre iscriverti di nuovo.",
    button: "Apri il sito e accedi",
    failed: "Iscrizione salvata, ma non è stato possibile inviare l’email con le istruzioni di accesso. Il partecipante può comunque accedere dalla home con il proprio indirizzo email. Non inserire di nuovo l’iscrizione.",
  },
  en: {
    subject: "Your registration is ready", greeting: "Hello",
    registered: "you have been registered to take part in the International Meeting for Peace \"Unarmed and Disarming Peace\" in Assisi. Use this link to access your registration:",
    access: "Enter the email address that received this message. You will receive a personal sign-in link: no password is needed.",
    complete: "In your personal area you can check and complete the information already entered, update your registration and download your personal QR code. You do not need to register again.",
    button: "Open the website and sign in",
    failed: "Registration saved, but the access instructions email could not be sent. The participant can still sign in from the home page using their email address. Do not register them again.",
  },
  fr: {
    subject: "Votre inscription est prête", greeting: "Bonjour",
    registered: "vous avez été inscrit pour participer à la Rencontre internationale pour la Paix « Paix désarmée et désarmante » à Assise. Utilisez ce lien pour accéder à votre inscription :",
    access: "Saisissez l’adresse email qui a reçu ce message. Vous recevrez un lien personnel de connexion : aucun mot de passe n’est nécessaire.",
    complete: "Dans votre espace personnel, vous pouvez vérifier et compléter les informations déjà saisies, modifier votre inscription et télécharger votre code QR personnel. Il n’est pas nécessaire de vous inscrire à nouveau.",
    button: "Ouvrir le site et se connecter",
    failed: "Inscription enregistrée, mais l’email contenant les instructions de connexion n’a pas pu être envoyé. La personne peut se connecter depuis la page d’accueil avec son adresse email. Ne l’inscrivez pas à nouveau.",
  },
  de: {
    subject: "Deine Anmeldung ist bereit", greeting: "Hallo",
    registered: "du wurdest für die Teilnahme am Internationalen Friedenstreffen „Unbewaffneter und entwaffnender Frieden“ in Assisi angemeldet. Über diesen Link kannst du auf deine Anmeldung zugreifen:",
    access: "Gib die E-Mail-Adresse ein, an die diese Nachricht gesendet wurde. Du erhältst einen persönlichen Anmeldelink. Ein Passwort ist nicht erforderlich.",
    complete: "In deinem persönlichen Bereich kannst du die bereits eingegebenen Daten prüfen und ergänzen, deine Anmeldung aktualisieren und deinen persönlichen QR-Code herunterladen. Du musst dich nicht erneut registrieren.",
    button: "Website öffnen und anmelden",
    failed: "Anmeldung gespeichert, aber die E-Mail mit den Zugangshinweisen konnte nicht gesendet werden. Die Person kann sich auf der Startseite mit ihrer E-Mail-Adresse anmelden. Bitte nicht erneut registrieren.",
  },
  es: {
    subject: "Tu inscripción está lista", greeting: "Hola",
    registered: "te han inscrito para participar en el Encuentro Internacional por la Paz «Paz desarmada y desarmante» en Asís. Usa este enlace para acceder a tu inscripción:",
    access: "Introduce la dirección de correo que ha recibido este mensaje. Recibirás un enlace personal para acceder: no necesitas contraseña.",
    complete: "En tu área personal puedes revisar y completar los datos ya introducidos, actualizar tu inscripción y descargar tu código QR personal. No necesitas inscribirte de nuevo.",
    button: "Abrir el sitio y acceder",
    failed: "Inscripción guardada, pero no se ha podido enviar el correo con las instrucciones de acceso. La persona puede acceder desde la página de inicio con su correo. No vuelvas a inscribirla.",
  },
  nl: {
    subject: "Je inschrijving is klaar", greeting: "Hallo",
    registered: "je bent ingeschreven voor de Internationale Ontmoeting voor de Vrede «Ongewapende en ontwapenende vrede» in Assisi. Gebruik deze link om je inschrijving te openen:",
    access: "Voer het e-mailadres in waarop je dit bericht hebt ontvangen. Je ontvangt een persoonlijke inloglink: je hebt geen wachtwoord nodig.",
    complete: "In je persoonlijke omgeving kun je de ingevulde gegevens controleren en aanvullen, je inschrijving bijwerken en je persoonlijke QR-code downloaden. Je hoeft je niet opnieuw in te schrijven.",
    button: "Website openen en inloggen",
    failed: "Inschrijving opgeslagen, maar de e-mail met toegangsinstructies kon niet worden verzonden. De deelnemer kan via de startpagina inloggen met het eigen e-mailadres. Schrijf de deelnemer niet opnieuw in.",
  },
  uk: {
    subject: "Ваша реєстрація готова", greeting: "Вітаємо",
    registered: "вас зареєстровано для участі в Міжнародній зустрічі за мир «Мир без зброї, що роззброює» в Ассізі. Скористайтеся цим посиланням, щоб відкрити свою реєстрацію:",
    access: "Введіть адресу електронної пошти, на яку надійшло це повідомлення. Ви отримаєте особисте посилання для входу: пароль не потрібен.",
    complete: "В особистому кабінеті можна перевірити й доповнити вже внесені дані, оновити реєстрацію та завантажити особистий QR-код. Повторно реєструватися не потрібно.",
    button: "Відкрити сайт і увійти",
    failed: "Реєстрацію збережено, але лист з інструкціями для входу надіслати не вдалося. Учасник може увійти з головної сторінки за своєю електронною адресою. Не реєструйте його повторно.",
  },
};

export type OperationalAccessRole = "admin" | "manager" | "manager_viewer" | "accoglienza" | "capogruppo";
const ROLE_LABELS: Record<OperationalAccessRole, string> = {
  admin: "Amministratore", manager: "Manager", manager_viewer: "Manager in sola lettura",
  accoglienza: "Accoglienza", capogruppo: "Capogruppo",
};

export type AccountAccessInput = {
  name: string;
  siteLink: string;
  locale?: string | null;
  role?: OperationalAccessRole;
};

export function renderAccountAccessEmail(input: AccountAccessInput) {
  const locale = input.role ? "it" : normalizeLocale(input.locale) ?? "en";
  const copy = ACCESS_EMAIL_COPY[locale];
  // A stable home link cannot expire or create an Auth account before verification.
  const site = new URL(input.siteLink);
  if (!["https:", "http:"].includes(site.protocol)) throw new Error("Invalid site URL");
  const paragraphs = [
    `${copy.greeting} ${input.name},`,
    input.role ? `Ti è stato assegnato il ruolo ${ROLE_LABELS[input.role]}. Il tuo accesso è pronto.` : copy.registered,
    input.role
      ? "Apri il sito e inserisci l’indirizzo email a cui hai ricevuto questo messaggio. Riceverai un link personale per accedere: non serve una password."
      : copy.access,
    input.role
      ? "Dopo l’accesso puoi aprire l’area del tuo ruolo. Da «La mia iscrizione» puoi anche completare o aggiornare la tua partecipazione personale all’evento."
      : copy.complete,
    EMAIL_DELIVERY_COPY[locale].checkSpam,
    EMAIL_DELIVERY_COPY[locale].safeSender,
  ];
  const linkAfterParagraph = input.role ? 2 : 1;
  return {
    subject: input.role ? `Il tuo accesso come ${ROLE_LABELS[input.role]}` : copy.subject,
    text: [...paragraphs.slice(0, linkAfterParagraph + 1), site.href, ...paragraphs.slice(linkAfterParagraph + 1)].join("\n\n"),
    html: paragraphs.map((text, index) => `<p>${escapeHtml(text)}</p>${index === linkAfterParagraph
      ? `<p><a href="${escapeHtml(site.href)}">${escapeHtml(copy.button)}</a></p>` : ""}`).join(""),
  };
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
