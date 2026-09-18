import type { SupportedLocale } from "../i18n/config.ts";

type ConfirmationCopy = {
  subject: string;
  greeting: string;
  received: string;
  code: string;
  qr: string;
  qrAlt: string;
  access: string;
  programme: string;
  thanks: string;
};

// Placeholders are substituted by the renderer in both text and escaped HTML.
export const REGISTRATION_CONFIRMATION_COPY: Record<SupportedLocale, ConfirmationCopy> = {
  it: {
    subject: "Iscrizione ricevuta",
    greeting: "Ciao {firstName},",
    received: "Abbiamo ricevuto l'iscrizione di {name} per l'evento {event}.",
    code: "Il tuo codice partecipante è: {code}.",
    qr: "In allegato trovi il tuo QR code personale per l'accesso all'evento.",
    qrAlt: "QR code personale",
    access: "Per accedere alla tua area personale, apri {site} e inserisci lo stesso indirizzo email usato per registrarti. Riceverai un link personale per consultare e aggiornare la tua iscrizione.",
    programme: "Quando sarà pubblicato il programma completo, dalla tua area personale potrai anche scegliere a quali incontri ed eventi partecipare.",
    thanks: "Grazie.",
  },
  en: {
    subject: "Registration received",
    greeting: "Hello {firstName},",
    received: "We have received the registration for {name} for the event {event}.",
    code: "Your participant code is: {code}.",
    qr: "Your personal QR code for entry to the event is attached.",
    qrAlt: "Personal QR code",
    access: "To access your personal area, open {site} and enter the same email address you used to register. You will receive a personal sign-in link to view and update your registration.",
    programme: "Once the full programme is published, you will also be able to choose which sessions and events to attend from your personal area.",
    thanks: "Thank you.",
  },
  fr: {
    subject: "Inscription reçue",
    greeting: "Bonjour {firstName},",
    received: "Nous avons reçu l'inscription de {name} à l'événement {event}.",
    code: "Ton code de participation est : {code}.",
    qr: "Tu trouveras en pièce jointe ton QR code personnel pour accéder à l'événement.",
    qrAlt: "QR code personnel",
    access: "Pour accéder à ton espace personnel, ouvre {site} et saisis la même adresse e-mail que celle utilisée pour t'inscrire. Tu recevras un lien de connexion personnel pour consulter et modifier ton inscription.",
    programme: "Lorsque le programme complet sera publié, tu pourras aussi choisir les rencontres et les événements auxquels tu souhaites participer depuis ton espace personnel.",
    thanks: "Merci.",
  },
  de: {
    subject: "Anmeldung erhalten",
    greeting: "Hallo {firstName},",
    received: "Wir haben die Anmeldung von {name} für die Veranstaltung {event} erhalten.",
    code: "Dein Teilnahmecode lautet: {code}.",
    qr: "Im Anhang findest du deinen persönlichen QR-Code für den Einlass zur Veranstaltung.",
    qrAlt: "Persönlicher QR-Code",
    access: "Um deinen persönlichen Bereich zu öffnen, gehe auf {site} und gib dieselbe E-Mail-Adresse ein, die du bei der Anmeldung verwendet hast. Du erhältst einen persönlichen Zugangslink, über den du deine Anmeldung einsehen und aktualisieren kannst.",
    programme: "Sobald das vollständige Programm veröffentlicht ist, kannst du in deinem persönlichen Bereich auch auswählen, an welchen Programmpunkten und Veranstaltungen du teilnehmen möchtest.",
    thanks: "Vielen Dank.",
  },
  es: {
    subject: "Inscripción recibida",
    greeting: "Hola, {firstName}:",
    received: "Hemos recibido la inscripción de {name} para el evento {event}.",
    code: "Tu código de participante es: {code}.",
    qr: "Encontrarás adjunto tu código QR personal para acceder al evento.",
    qrAlt: "Código QR personal",
    access: "Para acceder a tu área personal, abre {site} e introduce la misma dirección de correo electrónico que utilizaste para inscribirte. Recibirás un enlace personal de acceso para consultar y actualizar tu inscripción.",
    programme: "Cuando se publique el programa completo, también podrás elegir desde tu área personal las sesiones y los eventos en los que quieras participar.",
    thanks: "Gracias.",
  },
  nl: {
    subject: "Inschrijving ontvangen",
    greeting: "Hallo {firstName},",
    received: "We hebben de inschrijving van {name} voor het evenement {event} ontvangen.",
    code: "Je deelnemerscode is: {code}.",
    qr: "In de bijlage vind je je persoonlijke QR-code voor toegang tot het evenement.",
    qrAlt: "Persoonlijke QR-code",
    access: "Om je persoonlijke pagina te openen, ga je naar {site} en vul je hetzelfde e-mailadres in dat je bij je inschrijving hebt gebruikt. Je ontvangt een persoonlijke inloglink waarmee je je inschrijving kunt bekijken en bijwerken.",
    programme: "Zodra het volledige programma is gepubliceerd, kun je op je persoonlijke pagina ook kiezen aan welke programmaonderdelen en evenementen je wilt deelnemen.",
    thanks: "Bedankt.",
  },
  uk: {
    subject: "Реєстрацію отримано",
    greeting: "Вітаємо, {firstName}!",
    received: "Ми отримали реєстрацію на ім’я {name} для участі в заході {event}.",
    code: "Ваш код учасника: {code}.",
    qr: "До листа додано ваш особистий QR-код для входу на захід.",
    qrAlt: "Особистий QR-код",
    access: "Щоб увійти до особистого кабінету, відкрийте {site} і введіть ту саму адресу електронної пошти, яку ви вказали під час реєстрації. Ви отримаєте особисте посилання для входу, щоб переглянути й оновити свою реєстрацію.",
    programme: "Коли буде опубліковано повну програму, ви також зможете вибрати в особистому кабінеті зустрічі та заходи, у яких хочете взяти участь.",
    thanks: "Дякуємо.",
  },
};
