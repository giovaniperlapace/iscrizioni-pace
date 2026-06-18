import type { DashboardRole } from "../auth/roles.ts";

import { DEFAULT_LOCALE, type SupportedLocale } from "./config.ts";

type PublicMessages = {
  common: {
    language: string;
    languageChanging: string;
    logout: string;
    protectedArea: string;
    home: string;
    dateToBeDefined: string;
    roles: Record<DashboardRole, string>;
    dashboardTabs: {
      admin: string;
      manager: string;
      accoglienza: string;
      capogruppo: string;
      partecipante: string;
    };
  };
  home: {
    eyebrow: string;
    title: string;
    intro: string;
    eventTitle: string;
    noEvent: string;
  };
  emailAccess: {
    submit: string;
    pending: string;
    magicLinkSent: string;
    errors: Record<string, string>;
    fallbackError: string;
  };
  login: {
    eyebrow: string;
    title: string;
    intro: string;
    redirected: string;
    backHome: string;
    errors: Record<string, string>;
  };
  confirmation: {
    eyebrow: string;
    title: string;
    bodyBeforeEmail: string;
    fallbackEmail: string;
    bodyAfterEmail: string;
    backHome: string;
  };
  registrationClosed: {
    title: string;
    body: string;
    groupLinkError: string;
  };
};

export const messages: Record<SupportedLocale, PublicMessages> = {
  it: {
    common: {
      language: "Lingua",
      languageChanging: "Cambio lingua in corso",
      logout: "Esci",
      protectedArea: "Area protetta",
      home: "Home",
      dateToBeDefined: "Date da definire",
      roles: {
        admin: "Admin",
        manager: "Manager",
        manager_viewer: "Manager viewer",
        accoglienza: "Accoglienza",
        capogruppo: "Capogruppo",
        partecipante: "Partecipante",
      },
      dashboardTabs: {
        admin: "Dashboard admin",
        manager: "Dashboard manager",
        accoglienza: "Dashboard accoglienza",
        capogruppo: "Dashboard capogruppo",
        partecipante: "Iscrizione e QR personale",
      },
    },
    home: {
      eyebrow: "Iscrizioni e accesso",
      title: "Iscrizioni Pace",
      intro:
        "Inserisci la tua email: se hai già un'iscrizione riceverai un magic link, altrimenti apriremo il form per una nuova iscrizione.",
      eventTitle: "Evento",
      noEvent: "Nessun evento pubblicato accetta iscrizioni in questo momento.",
    },
    emailAccess: {
      submit: "Continua",
      pending: "Invio...",
      magicLinkSent: "Ti abbiamo inviato un link di accesso. Controlla la tua email.",
      errors: {
        email: "Inserisci un indirizzo email valido.",
        "rate-limit": "Troppi tentativi ravvicinati. Riprova tra qualche minuto.",
        "no-event": "Non ci sono iscrizioni aperte in questo momento.",
      },
      fallbackError: "Non e' stato possibile completare la richiesta.",
    },
    login: {
      eyebrow: "Accesso",
      title: "Accedi a Iscrizioni Pace",
      intro:
        "Usa il link ricevuto via email per entrare nella tua area personale. Se il link non funziona, torna alla home e richiedine uno nuovo.",
      redirected: "Per aprire la tua area personale accedi dal link ricevuto via email.",
      backHome: "Torna alla home",
      errors: {
        code: "Il codice di accesso non e' valido o e' scaduto.",
        otp: "Il link di accesso non e' valido o e' scaduto.",
        profile: "Sessione creata, ma non e' stato possibile aggiornare il profilo.",
        session: "Non e' stato possibile creare una sessione valida.",
      },
    },
    confirmation: {
      eyebrow: "Iscrizione ricevuta",
      title: "Grazie",
      bodyBeforeEmail: "Abbiamo registrato la tua iscrizione e inviato una conferma a",
      fallbackEmail: "la tua email",
      bodyAfterEmail: "Per rientrare nella dashboard usa la stessa email dalla home.",
      backHome: "Torna alla home e fai il primo accesso",
    },
    registrationClosed: {
      title: "Iscrizioni non aperte",
      body: "Nessun evento pubblicato accetta iscrizioni in questo momento.",
      groupLinkError: "Link gruppo non valido o non più attivo.",
    },
  },
  en: {
    common: {
      language: "Language",
      languageChanging: "Changing language",
      logout: "Log out",
      protectedArea: "Protected area",
      home: "Home",
      dateToBeDefined: "Dates to be confirmed",
      roles: {
        admin: "Admin",
        manager: "Manager",
        manager_viewer: "Manager viewer",
        accoglienza: "Welcome desk",
        capogruppo: "Group leader",
        partecipante: "Participant",
      },
      dashboardTabs: {
        admin: "Admin dashboard",
        manager: "Manager dashboard",
        accoglienza: "Welcome desk",
        capogruppo: "Group leader dashboard",
        partecipante: "Personal registration and QR",
      },
    },
    home: {
      eyebrow: "Registration and access",
      title: "Peace Registrations",
      intro:
        "Enter your email: if you already have a registration, you will receive a magic link; otherwise we will open the form for a new registration.",
      eventTitle: "Event",
      noEvent: "No published event is accepting registrations at the moment.",
    },
    emailAccess: {
      submit: "Continue",
      pending: "Sending...",
      magicLinkSent: "We sent you an access link. Please check your email.",
      errors: {
        email: "Enter a valid email address.",
        "rate-limit": "Too many attempts in a short time. Try again in a few minutes.",
        "no-event": "There are no open registrations at the moment.",
      },
      fallbackError: "We could not complete the request.",
    },
    login: {
      eyebrow: "Access",
      title: "Access Peace Registrations",
      intro:
        "Use the link you received by email to enter your personal area. If the link does not work, return to the home page and request a new one.",
      redirected: "To open your personal area, access it from the link received by email.",
      backHome: "Back to home",
      errors: {
        code: "The access code is invalid or has expired.",
        otp: "The access link is invalid or has expired.",
        profile: "The session was created, but the profile could not be updated.",
        session: "A valid session could not be created.",
      },
    },
    confirmation: {
      eyebrow: "Registration received",
      title: "Thank you",
      bodyBeforeEmail: "We registered your participation and sent a confirmation to",
      fallbackEmail: "your email",
      bodyAfterEmail: "To return to the dashboard, use the same email from the home page.",
      backHome: "Back to home and access for the first time",
    },
    registrationClosed: {
      title: "Registrations are not open",
      body: "No published event is accepting registrations at the moment.",
      groupLinkError: "The group link is invalid or no longer active.",
    },
  },
  fr: {
    common: {
      language: "Langue",
      languageChanging: "Changement de langue en cours",
      logout: "Se déconnecter",
      protectedArea: "Espace protégé",
      home: "Accueil",
      dateToBeDefined: "Dates à confirmer",
      roles: {
        admin: "Admin",
        manager: "Manager",
        manager_viewer: "Lecteur manager",
        accoglienza: "Accueil",
        capogruppo: "Responsable de groupe",
        partecipante: "Participant",
      },
      dashboardTabs: {
        admin: "Dashboard admin",
        manager: "Dashboard manager",
        accoglienza: "Accueil",
        capogruppo: "Dashboard responsable",
        partecipante: "Inscription personnelle et QR",
      },
    },
    home: {
      eyebrow: "Inscription et accès",
      title: "Inscriptions Paix",
      intro:
        "Saisis ton email : si tu as déjà une inscription, tu recevras un magic link ; sinon nous ouvrirons le formulaire pour une nouvelle inscription.",
      eventTitle: "Événement",
      noEvent: "Aucun événement publié n'accepte d'inscriptions pour le moment.",
    },
    emailAccess: {
      submit: "Continuer",
      pending: "Envoi...",
      magicLinkSent: "Nous t'avons envoyé un lien d'accès. Vérifie ton email.",
      errors: {
        email: "Saisis une adresse email valide.",
        "rate-limit": "Trop de tentatives rapprochées. Réessaie dans quelques minutes.",
        "no-event": "Il n'y a pas d'inscriptions ouvertes pour le moment.",
      },
      fallbackError: "Impossible de compléter la demande.",
    },
    login: {
      eyebrow: "Accès",
      title: "Accéder à Inscriptions Paix",
      intro:
        "Utilise le lien reçu par email pour entrer dans ton espace personnel. Si le lien ne fonctionne pas, reviens à l'accueil et demandes-en un nouveau.",
      redirected: "Pour ouvrir ton espace personnel, accède depuis le lien reçu par email.",
      backHome: "Retour à l'accueil",
      errors: {
        code: "Le code d'accès n'est pas valide ou a expiré.",
        otp: "Le lien d'accès n'est pas valide ou a expiré.",
        profile: "La session a été créée, mais le profil n'a pas pu être mis à jour.",
        session: "Impossible de créer une session valide.",
      },
    },
    confirmation: {
      eyebrow: "Inscription reçue",
      title: "Merci",
      bodyBeforeEmail: "Nous avons enregistré ton inscription et envoyé une confirmation à",
      fallbackEmail: "ton email",
      bodyAfterEmail: "Pour revenir au dashboard, utilise le même email depuis l'accueil.",
      backHome: "Retour à l'accueil et premier accès",
    },
    registrationClosed: {
      title: "Inscriptions non ouvertes",
      body: "Aucun événement publié n'accepte d'inscriptions pour le moment.",
      groupLinkError: "Le lien de groupe n'est pas valide ou n'est plus actif.",
    },
  },
  de: {
    common: {
      language: "Sprache",
      languageChanging: "Sprache wird geändert",
      logout: "Abmelden",
      protectedArea: "Geschützter Bereich",
      home: "Startseite",
      dateToBeDefined: "Termine werden noch bestätigt",
      roles: {
        admin: "Admin",
        manager: "Manager",
        manager_viewer: "Manager viewer",
        accoglienza: "Empfang",
        capogruppo: "Gruppenleitung",
        partecipante: "Teilnehmende Person",
      },
      dashboardTabs: {
        admin: "Admin-Dashboard",
        manager: "Manager-Dashboard",
        accoglienza: "Empfang",
        capogruppo: "Gruppenleitungs-Dashboard",
        partecipante: "Persönliche Anmeldung und QR",
      },
    },
    home: {
      eyebrow: "Anmeldung und Zugang",
      title: "Friedensanmeldungen",
      intro:
        "Gib deine E-Mail ein: Wenn du bereits angemeldet bist, erhältst du einen Magic Link; andernfalls öffnen wir das Formular für eine neue Anmeldung.",
      eventTitle: "Veranstaltung",
      noEvent: "Derzeit nimmt keine veröffentlichte Veranstaltung Anmeldungen entgegen.",
    },
    emailAccess: {
      submit: "Weiter",
      pending: "Wird gesendet...",
      magicLinkSent: "Wir haben dir einen Zugangslink gesendet. Bitte prüfe deine E-Mail.",
      errors: {
        email: "Gib eine gültige E-Mail-Adresse ein.",
        "rate-limit": "Zu viele Versuche in kurzer Zeit. Bitte versuche es in einigen Minuten erneut.",
        "no-event": "Derzeit sind keine Anmeldungen geöffnet.",
      },
      fallbackError: "Die Anfrage konnte nicht abgeschlossen werden.",
    },
    login: {
      eyebrow: "Zugang",
      title: "Friedensanmeldungen öffnen",
      intro:
        "Nutze den Link, den du per E-Mail erhalten hast, um deinen persönlichen Bereich zu öffnen. Wenn der Link nicht funktioniert, kehre zur Startseite zurück und fordere einen neuen an.",
      redirected: "Um deinen persönlichen Bereich zu öffnen, nutze den Link aus der E-Mail.",
      backHome: "Zur Startseite",
      errors: {
        code: "Der Zugangscode ist ungültig oder abgelaufen.",
        otp: "Der Zugangslink ist ungültig oder abgelaufen.",
        profile: "Die Sitzung wurde erstellt, aber das Profil konnte nicht aktualisiert werden.",
        session: "Es konnte keine gültige Sitzung erstellt werden.",
      },
    },
    confirmation: {
      eyebrow: "Anmeldung erhalten",
      title: "Danke",
      bodyBeforeEmail: "Wir haben deine Anmeldung registriert und eine Bestätigung gesendet an",
      fallbackEmail: "deine E-Mail",
      bodyAfterEmail: "Um zum Dashboard zurückzukehren, nutze dieselbe E-Mail auf der Startseite.",
      backHome: "Zur Startseite und zum ersten Zugang",
    },
    registrationClosed: {
      title: "Anmeldungen sind nicht geöffnet",
      body: "Derzeit nimmt keine veröffentlichte Veranstaltung Anmeldungen entgegen.",
      groupLinkError: "Der Gruppenlink ist ungültig oder nicht mehr aktiv.",
    },
  },
  es: {
    common: {
      language: "Idioma",
      languageChanging: "Cambiando idioma",
      logout: "Salir",
      protectedArea: "Área protegida",
      home: "Inicio",
      dateToBeDefined: "Fechas por confirmar",
      roles: {
        admin: "Admin",
        manager: "Manager",
        manager_viewer: "Lector manager",
        accoglienza: "Acogida",
        capogruppo: "Responsable de grupo",
        partecipante: "Participante",
      },
      dashboardTabs: {
        admin: "Panel admin",
        manager: "Panel manager",
        accoglienza: "Acogida",
        capogruppo: "Panel responsable",
        partecipante: "Inscripción personal y QR",
      },
    },
    home: {
      eyebrow: "Inscripción y acceso",
      title: "Inscripciones Paz",
      intro:
        "Introduce tu email: si ya tienes una inscripción, recibirás un magic link; si no, abriremos el formulario para una nueva inscripción.",
      eventTitle: "Evento",
      noEvent: "Ningún evento publicado acepta inscripciones en este momento.",
    },
    emailAccess: {
      submit: "Continuar",
      pending: "Enviando...",
      magicLinkSent: "Te hemos enviado un enlace de acceso. Revisa tu email.",
      errors: {
        email: "Introduce una dirección de email válida.",
        "rate-limit": "Demasiados intentos seguidos. Inténtalo de nuevo en unos minutos.",
        "no-event": "No hay inscripciones abiertas en este momento.",
      },
      fallbackError: "No se pudo completar la solicitud.",
    },
    login: {
      eyebrow: "Acceso",
      title: "Accede a Inscripciones Paz",
      intro:
        "Usa el enlace recibido por email para entrar en tu área personal. Si el enlace no funciona, vuelve al inicio y solicita uno nuevo.",
      redirected: "Para abrir tu área personal, accede desde el enlace recibido por email.",
      backHome: "Volver al inicio",
      errors: {
        code: "El código de acceso no es válido o ha caducado.",
        otp: "El enlace de acceso no es válido o ha caducado.",
        profile: "La sesión se creó, pero no se pudo actualizar el perfil.",
        session: "No se pudo crear una sesión válida.",
      },
    },
    confirmation: {
      eyebrow: "Inscripción recibida",
      title: "Gracias",
      bodyBeforeEmail: "Hemos registrado tu inscripción y enviado una confirmación a",
      fallbackEmail: "tu email",
      bodyAfterEmail: "Para volver al panel, usa el mismo email desde el inicio.",
      backHome: "Volver al inicio y acceder por primera vez",
    },
    registrationClosed: {
      title: "Inscripciones no abiertas",
      body: "Ningún evento publicado acepta inscripciones en este momento.",
      groupLinkError: "El enlace de grupo no es válido o ya no está activo.",
    },
  },
  nl: {
    common: {
      language: "Taal",
      languageChanging: "Taal wijzigen",
      logout: "Uitloggen",
      protectedArea: "Beveiligde omgeving",
      home: "Home",
      dateToBeDefined: "Data nog te bevestigen",
      roles: {
        admin: "Admin",
        manager: "Manager",
        manager_viewer: "Manager viewer",
        accoglienza: "Ontvangst",
        capogruppo: "Groepsleider",
        partecipante: "Deelnemer",
      },
      dashboardTabs: {
        admin: "Admin dashboard",
        manager: "Manager dashboard",
        accoglienza: "Ontvangst",
        capogruppo: "Dashboard groepsleider",
        partecipante: "Persoonlijke inschrijving en QR",
      },
    },
    home: {
      eyebrow: "Inschrijving en toegang",
      title: "Vredesinschrijvingen",
      intro:
        "Vul je e-mail in: als je al een inschrijving hebt, ontvang je een magic link; anders openen we het formulier voor een nieuwe inschrijving.",
      eventTitle: "Evenement",
      noEvent: "Er is momenteel geen gepubliceerd evenement waarvoor inschrijving open is.",
    },
    emailAccess: {
      submit: "Doorgaan",
      pending: "Verzenden...",
      magicLinkSent: "We hebben je een toegangslink gestuurd. Controleer je e-mail.",
      errors: {
        email: "Voer een geldig e-mailadres in.",
        "rate-limit": "Te veel pogingen kort na elkaar. Probeer het over enkele minuten opnieuw.",
        "no-event": "Er zijn momenteel geen inschrijvingen open.",
      },
      fallbackError: "De aanvraag kon niet worden voltooid.",
    },
    login: {
      eyebrow: "Toegang",
      title: "Toegang tot Vredesinschrijvingen",
      intro:
        "Gebruik de link die je per e-mail hebt ontvangen om je persoonlijke omgeving te openen. Werkt de link niet, ga dan terug naar home en vraag een nieuwe aan.",
      redirected: "Open je persoonlijke omgeving via de link die je per e-mail hebt ontvangen.",
      backHome: "Terug naar home",
      errors: {
        code: "De toegangscode is ongeldig of verlopen.",
        otp: "De toegangslink is ongeldig of verlopen.",
        profile: "De sessie is aangemaakt, maar het profiel kon niet worden bijgewerkt.",
        session: "Er kon geen geldige sessie worden aangemaakt.",
      },
    },
    confirmation: {
      eyebrow: "Inschrijving ontvangen",
      title: "Dank je",
      bodyBeforeEmail: "We hebben je inschrijving geregistreerd en een bevestiging gestuurd naar",
      fallbackEmail: "je e-mail",
      bodyAfterEmail: "Gebruik hetzelfde e-mailadres op de homepagina om terug te keren naar het dashboard.",
      backHome: "Terug naar home en eerste toegang",
    },
    registrationClosed: {
      title: "Inschrijvingen zijn niet open",
      body: "Er is momenteel geen gepubliceerd evenement waarvoor inschrijving open is.",
      groupLinkError: "De groepslink is ongeldig of niet meer actief.",
    },
  },
  uk: {
    common: {
      language: "Мова",
      languageChanging: "Зміна мови",
      logout: "Вийти",
      protectedArea: "Захищена зона",
      home: "Головна",
      dateToBeDefined: "Дати буде уточнено",
      roles: {
        admin: "Адміністратор",
        manager: "Менеджер",
        manager_viewer: "Перегляд менеджера",
        accoglienza: "Прийом",
        capogruppo: "Керівник групи",
        partecipante: "Учасник",
      },
      dashboardTabs: {
        admin: "Панель адміністратора",
        manager: "Панель менеджера",
        accoglienza: "Прийом",
        capogruppo: "Панель керівника групи",
        partecipante: "Особиста реєстрація та QR",
      },
    },
    home: {
      eyebrow: "Реєстрація та доступ",
      title: "Реєстрація миру",
      intro:
        "Введіть вашу електронну адресу: якщо ви вже зареєстровані, отримаєте magic link; інакше ми відкриємо форму нової реєстрації.",
      eventTitle: "Подія",
      noEvent: "Наразі немає опублікованої події з відкритою реєстрацією.",
    },
    emailAccess: {
      submit: "Продовжити",
      pending: "Надсилання...",
      magicLinkSent: "Ми надіслали вам посилання для доступу. Перевірте електронну пошту.",
      errors: {
        email: "Введіть дійсну електронну адресу.",
        "rate-limit": "Забагато спроб поспіль. Спробуйте ще раз за кілька хвилин.",
        "no-event": "Наразі немає відкритої реєстрації.",
      },
      fallbackError: "Не вдалося завершити запит.",
    },
    login: {
      eyebrow: "Доступ",
      title: "Увійти до Реєстрації миру",
      intro:
        "Скористайтеся посиланням, отриманим електронною поштою, щоб увійти до особистої зони. Якщо посилання не працює, поверніться на головну і запросіть нове.",
      redirected: "Щоб відкрити особисту зону, увійдіть за посиланням з електронного листа.",
      backHome: "Назад на головну",
      errors: {
        code: "Код доступу недійсний або минув термін його дії.",
        otp: "Посилання для доступу недійсне або минув термін його дії.",
        profile: "Сесію створено, але профіль не вдалося оновити.",
        session: "Не вдалося створити дійсну сесію.",
      },
    },
    confirmation: {
      eyebrow: "Реєстрацію отримано",
      title: "Дякуємо",
      bodyBeforeEmail: "Ми зареєстрували вашу участь і надіслали підтвердження на",
      fallbackEmail: "вашу електронну пошту",
      bodyAfterEmail: "Щоб повернутися до панелі, використайте ту саму адресу на головній сторінці.",
      backHome: "Повернутися на головну і увійти вперше",
    },
    registrationClosed: {
      title: "Реєстрацію не відкрито",
      body: "Наразі немає опублікованої події з відкритою реєстрацією.",
      groupLinkError: "Посилання групи недійсне або більше не активне.",
    },
  },
};

export function getMessages(locale: SupportedLocale): PublicMessages {
  return messages[locale] ?? messages[DEFAULT_LOCALE];
}
