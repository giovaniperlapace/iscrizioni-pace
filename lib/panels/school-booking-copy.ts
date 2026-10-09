import type { SupportedLocale } from "@/lib/i18n/config";

const it = {
  homeTitle: "Scuole",
  homeBody: "Prenota i posti per una classe senza inserire nomi o dati degli studenti.",
  homeCta: "Prenota per una scuola",
  eyebrow: "Prenotazioni scuole",
  title: "Porta una classe ai panel",
  intro: "Inserisci solo i dati della scuola e del docente referente. Ogni prenotazione riguarda una classe o un gruppo; dalla pagina docente potrai gestirne più di uno.",
  unavailable: "Le prenotazioni scuola non sono disponibili in questo momento.",
  teacher: "Docente referente",
  firstName: "Nome",
  lastName: "Cognome",
  email: "Email",
  phone: "Telefono",
  school: "Scuola e classe",
  schoolName: "Nome scuola",
  schoolCity: "Città",
  classDescription: "Classe o descrizione del gruppo",
  students: "Studenti",
  companions: "Accompagnatori",
  panels: "Scegli i panel",
  panelsHelp: "Per ogni panel puoi ridurre i posti rispetto al totale del gruppo. La disponibilità viene verificata nuovamente al momento dell’invio.",
  privacy: "Ho letto l’informativa privacy e acconsento al trattamento dei dati del docente per gestire la prenotazione. Non inserirò nomi o altri dati degli studenti.",
  submit: "Invia la prenotazione",
  confirmationTitle: "Prenotazione ricevuta",
  confirmationBody: "Abbiamo riservato i posti richiesti e inviato all’indirizzo del docente una conferma con QR e link personale. Controlla anche la cartella spam.",
  another: "Prenota un’altra classe",
  manage: "Accedi alle prenotazioni",
  invalid: "Controlla i campi, il consenso e i panel selezionati.",
  capacity: "I posti richiesti non sono più disponibili. Rivedi le quantità o scegli un altro panel.",
  overlap: "I panel selezionati si sovrappongono.",
  rate: "Sono stati effettuati troppi tentativi. Riprova più tardi.",
};

type Copy = typeof it;

const translations: Record<SupportedLocale, Copy> = {
  it,
  en: { ...it, homeTitle: "Schools", homeBody: "Reserve seats for a class without entering student names or personal details.", homeCta: "Book for a school", eyebrow: "School bookings", title: "Bring a class to the panels", intro: "Enter only the school and lead teacher details. Each booking covers one class or group; you can manage several from the teacher page.", unavailable: "School bookings are not available at the moment.", teacher: "Lead teacher", firstName: "First name", lastName: "Last name", email: "Email", phone: "Phone", school: "School and class", schoolName: "School name", schoolCity: "City", classDescription: "Class or group description", students: "Students", companions: "Accompanying adults", panels: "Choose panels", panelsHelp: "You can reduce seats for each panel. Availability is checked again when you submit.", privacy: "I have read the privacy notice and consent to processing the teacher’s data to manage this booking. I will not enter student names or other student data.", submit: "Submit booking", confirmationTitle: "Booking received", confirmationBody: "We reserved the requested seats and emailed the teacher a confirmation with the QR code and personal link. Please also check spam.", another: "Book another class", manage: "Access bookings", invalid: "Check the fields, consent and selected panels.", capacity: "The requested seats are no longer available. Adjust quantities or choose another panel.", overlap: "The selected panels overlap.", rate: "Too many attempts were made. Try again later." },
  fr: { ...it, homeTitle: "Écoles", homeBody: "Réservez des places pour une classe sans saisir les noms ni les données des élèves.", homeCta: "Réserver pour une école", eyebrow: "Réservations scolaires", title: "Amenez une classe aux panels", intro: "Saisissez uniquement les données de l’école et du professeur référent. Chaque réservation concerne une classe ou un groupe; la page professeur permet d’en gérer plusieurs.", unavailable: "Les réservations scolaires ne sont pas disponibles actuellement.", teacher: "Professeur référent", firstName: "Prénom", lastName: "Nom", email: "E-mail", phone: "Téléphone", school: "École et classe", schoolName: "Nom de l’école", schoolCity: "Ville", classDescription: "Classe ou description du groupe", students: "Élèves", companions: "Accompagnateurs", panels: "Choisissez les panels", panelsHelp: "Vous pouvez réduire les places pour chaque panel. La disponibilité sera vérifiée à nouveau lors de l’envoi.", privacy: "J’ai lu l’information sur la confidentialité et j’accepte le traitement des données du professeur pour gérer la réservation. Je ne saisirai aucune donnée d’élève.", submit: "Envoyer la réservation", confirmationTitle: "Réservation reçue", confirmationBody: "Les places ont été réservées et un e-mail avec QR et lien personnel a été envoyé au professeur. Vérifiez aussi les spams.", another: "Réserver une autre classe", manage: "Accéder aux réservations", invalid: "Vérifiez les champs, le consentement et les panels choisis.", capacity: "Les places demandées ne sont plus disponibles. Modifiez les quantités ou choisissez un autre panel.", overlap: "Les panels choisis se chevauchent.", rate: "Trop de tentatives. Réessayez plus tard." },
  de: { ...it, homeTitle: "Schulen", homeBody: "Reserviere Plätze für eine Klasse, ohne Namen oder Daten der Schüler einzugeben.", homeCta: "Für eine Schule buchen", eyebrow: "Schulbuchungen", title: "Eine Klasse zu den Panels bringen", intro: "Gib nur die Daten der Schule und der verantwortlichen Lehrkraft ein. Jede Buchung gilt für eine Klasse oder Gruppe; auf der Lehrkraft-Seite kannst du mehrere verwalten.", unavailable: "Schulbuchungen sind derzeit nicht verfügbar.", teacher: "Verantwortliche Lehrkraft", firstName: "Vorname", lastName: "Nachname", email: "E-Mail", phone: "Telefon", school: "Schule und Klasse", schoolName: "Name der Schule", schoolCity: "Stadt", classDescription: "Klasse oder Gruppenbeschreibung", students: "Schüler", companions: "Begleitpersonen", panels: "Panels auswählen", panelsHelp: "Für jedes Panel kann die Platzzahl reduziert werden. Die Verfügbarkeit wird beim Absenden erneut geprüft.", privacy: "Ich habe die Datenschutzhinweise gelesen und stimme der Verarbeitung der Lehrkraftdaten zur Buchungsverwaltung zu. Ich gebe keine Schülerdaten ein.", submit: "Buchung senden", confirmationTitle: "Buchung erhalten", confirmationBody: "Die Plätze wurden reserviert und der Lehrkraft eine Bestätigung mit QR-Code und persönlichem Link gesendet. Bitte auch Spam prüfen.", another: "Weitere Klasse buchen", manage: "Buchungen öffnen", invalid: "Prüfe Felder, Einwilligung und ausgewählte Panels.", capacity: "Die gewünschten Plätze sind nicht mehr verfügbar. Passe die Anzahl an oder wähle ein anderes Panel.", overlap: "Die ausgewählten Panels überschneiden sich.", rate: "Zu viele Versuche. Bitte später erneut versuchen." },
  es: { ...it, homeTitle: "Escuelas", homeBody: "Reserva plazas para una clase sin introducir nombres ni datos del alumnado.", homeCta: "Reservar para una escuela", eyebrow: "Reservas escolares", title: "Trae una clase a los paneles", intro: "Introduce solo los datos de la escuela y del docente responsable. Cada reserva corresponde a una clase o grupo; podrás gestionar varias desde la página docente.", unavailable: "Las reservas escolares no están disponibles ahora.", teacher: "Docente responsable", firstName: "Nombre", lastName: "Apellidos", email: "Email", phone: "Teléfono", school: "Escuela y clase", schoolName: "Nombre de la escuela", schoolCity: "Ciudad", classDescription: "Clase o descripción del grupo", students: "Estudiantes", companions: "Acompañantes", panels: "Elige los paneles", panelsHelp: "Puedes reducir las plazas para cada panel. La disponibilidad se comprobará de nuevo al enviar.", privacy: "He leído la información de privacidad y consiento el tratamiento de los datos del docente para gestionar la reserva. No introduciré datos del alumnado.", submit: "Enviar reserva", confirmationTitle: "Reserva recibida", confirmationBody: "Hemos reservado las plazas y enviado al docente una confirmación con QR y enlace personal. Revisa también spam.", another: "Reservar otra clase", manage: "Acceder a las reservas", invalid: "Revisa los campos, el consentimiento y los paneles elegidos.", capacity: "Las plazas solicitadas ya no están disponibles. Ajusta las cantidades o elige otro panel.", overlap: "Los paneles elegidos se solapan.", rate: "Demasiados intentos. Vuelve a intentarlo más tarde." },
  nl: { ...it, homeTitle: "Scholen", homeBody: "Reserveer plaatsen voor een klas zonder namen of gegevens van leerlingen in te voeren.", homeCta: "Boek voor een school", eyebrow: "Schoolboekingen", title: "Breng een klas naar de panels", intro: "Vul alleen de gegevens van de school en de verantwoordelijke leerkracht in. Elke boeking geldt voor één klas of groep; via de leerkrachtpagina beheer je er meerdere.", unavailable: "Schoolboekingen zijn momenteel niet beschikbaar.", teacher: "Verantwoordelijke leerkracht", firstName: "Voornaam", lastName: "Achternaam", email: "E-mail", phone: "Telefoon", school: "School en klas", schoolName: "Naam school", schoolCity: "Plaats", classDescription: "Klas of groepsbeschrijving", students: "Leerlingen", companions: "Begeleiders", panels: "Kies panels", panelsHelp: "Per panel kun je het aantal plaatsen verlagen. De beschikbaarheid wordt bij verzending opnieuw gecontroleerd.", privacy: "Ik heb de privacyverklaring gelezen en stem in met de verwerking van de leerkrachtgegevens voor deze boeking. Ik voer geen leerlinggegevens in.", submit: "Boeking verzenden", confirmationTitle: "Boeking ontvangen", confirmationBody: "De plaatsen zijn gereserveerd en de leerkracht ontving een e-mail met QR-code en persoonlijke link. Controleer ook spam.", another: "Nog een klas boeken", manage: "Boekingen openen", invalid: "Controleer velden, toestemming en gekozen panels.", capacity: "De gevraagde plaatsen zijn niet meer beschikbaar. Pas aantallen aan of kies een ander panel.", overlap: "De gekozen panels overlappen.", rate: "Te veel pogingen. Probeer het later opnieuw." },
  uk: { ...it, homeTitle: "Школи", homeBody: "Забронюйте місця для класу без введення імен чи даних учнів.", homeCta: "Забронювати для школи", eyebrow: "Шкільні бронювання", title: "Приведіть клас на панельні зустрічі", intro: "Вкажіть лише дані школи та відповідального вчителя. Одне бронювання стосується одного класу або групи; на сторінці вчителя можна керувати кількома.", unavailable: "Шкільні бронювання зараз недоступні.", teacher: "Відповідальний учитель", firstName: "Ім’я", lastName: "Прізвище", email: "Електронна пошта", phone: "Телефон", school: "Школа і клас", schoolName: "Назва школи", schoolCity: "Місто", classDescription: "Клас або опис групи", students: "Учні", companions: "Супроводжуючі", panels: "Оберіть панелі", panelsHelp: "Для кожної панелі кількість місць можна зменшити. Наявність буде повторно перевірена під час надсилання.", privacy: "Я прочитав(ла) повідомлення про конфіденційність і погоджуюся на обробку даних учителя для керування бронюванням. Я не вводитиму дані учнів.", submit: "Надіслати бронювання", confirmationTitle: "Бронювання отримано", confirmationBody: "Місця заброньовано, а вчителю надіслано підтвердження з QR-кодом і особистим посиланням. Перевірте також спам.", another: "Забронювати інший клас", manage: "Відкрити бронювання", invalid: "Перевірте поля, згоду та вибрані панелі.", capacity: "Запитані місця вже недоступні. Змініть кількість або виберіть іншу панель.", overlap: "Вибрані панелі накладаються у часі.", rate: "Забагато спроб. Спробуйте пізніше." },
};

export function getSchoolBookingCopy(locale: SupportedLocale): Copy {
  return translations[locale];
}

type TeacherFlowCopy = {
  accessIntro: string;
  accessSent: string;
  accessError: string;
  confirmationEmailFailed: string;
  saved: string;
  cancelled: string;
  dashboardIntro: string;
  empty: string;
  bookingStatuses: Record<"draft" | "submitted" | "confirmed" | "cancelled", string>;
  qrAlt: string;
  downloadQr: string;
  cancelBooking: string;
  saveChanges: string;
  locationUnavailable: string;
};

const teacherFlowTranslations: Record<SupportedLocale, TeacherFlowCopy> = {
  it: {
    accessIntro: "Inserisci l’email verificata del docente. Se esistono prenotazioni, riceverai un nuovo link personale.",
    accessSent: "Controlla l’email: se l’indirizzo è associato a una prenotazione, abbiamo inviato un nuovo link.",
    accessError: "Non è stato possibile inviare il link. Controlla l’indirizzo e riprova.",
    confirmationEmailFailed: "La prenotazione e i posti sono salvati, ma l’email non è partita. Richiedi un nuovo link di accesso: non inviare di nuovo la prenotazione.",
    saved: "Modifiche salvate.",
    cancelled: "Prenotazione annullata e posti liberati.",
    dashboardIntro: "Ogni scheda corrisponde a una classe o a un gruppo. Le prenotazioni annullate restano consultabili.",
    empty: "Non risultano prenotazioni scuola collegate a questa email.",
    bookingStatuses: { draft: "Bozza", submitted: "Ricevuta", confirmed: "Confermata", cancelled: "Annullata" },
    qrAlt: "QR code della classe",
    downloadQr: "Scarica QR",
    cancelBooking: "Annulla prenotazione",
    saveChanges: "Salva modifiche",
    locationUnavailable: "Sede da definire",
  },
  en: {
    accessIntro: "Enter the teacher’s verified email. If bookings exist, you will receive a new personal link.",
    accessSent: "Check your email: if the address is linked to a booking, we sent a new access link.",
    accessError: "We could not send the link. Check the address and try again.",
    confirmationEmailFailed: "The booking and seats are saved, but the email was not sent. Request a new access link; do not submit the booking again.",
    saved: "Changes saved.",
    cancelled: "Booking cancelled and seats released.",
    dashboardIntro: "Each card represents one class or group. Cancelled bookings remain available for reference.",
    empty: "No school bookings are linked to this email.",
    bookingStatuses: { draft: "Draft", submitted: "Received", confirmed: "Confirmed", cancelled: "Cancelled" },
    qrAlt: "Class QR code",
    downloadQr: "Download QR",
    cancelBooking: "Cancel booking",
    saveChanges: "Save changes",
    locationUnavailable: "Location to be confirmed",
  },
  fr: {
    accessIntro: "Saisissez l’e-mail vérifié du professeur. Si des réservations existent, vous recevrez un nouveau lien personnel.",
    accessSent: "Consultez votre e-mail : si l’adresse est liée à une réservation, nous avons envoyé un nouveau lien.",
    accessError: "Impossible d’envoyer le lien. Vérifiez l’adresse et réessayez.",
    confirmationEmailFailed: "La réservation et les places sont enregistrées, mais l’e-mail n’a pas été envoyé. Demandez un nouveau lien sans refaire la réservation.",
    saved: "Modifications enregistrées.",
    cancelled: "Réservation annulée et places libérées.",
    dashboardIntro: "Chaque fiche correspond à une classe ou à un groupe. Les réservations annulées restent consultables.",
    empty: "Aucune réservation scolaire n’est liée à cet e-mail.",
    bookingStatuses: { draft: "Brouillon", submitted: "Reçue", confirmed: "Confirmée", cancelled: "Annulée" },
    qrAlt: "Code QR de la classe",
    downloadQr: "Télécharger le QR",
    cancelBooking: "Annuler la réservation",
    saveChanges: "Enregistrer",
    locationUnavailable: "Lieu à confirmer",
  },
  de: {
    accessIntro: "Gib die bestätigte E-Mail-Adresse der Lehrkraft ein. Falls Buchungen bestehen, erhältst du einen neuen persönlichen Link.",
    accessSent: "Prüfe deine E-Mails: Ist die Adresse mit einer Buchung verknüpft, wurde ein neuer Link gesendet.",
    accessError: "Der Link konnte nicht gesendet werden. Prüfe die Adresse und versuche es erneut.",
    confirmationEmailFailed: "Buchung und Plätze sind gespeichert, aber die E-Mail wurde nicht gesendet. Fordere einen neuen Link an und sende die Buchung nicht erneut.",
    saved: "Änderungen gespeichert.",
    cancelled: "Buchung storniert und Plätze freigegeben.",
    dashboardIntro: "Jede Karte steht für eine Klasse oder Gruppe. Stornierte Buchungen bleiben einsehbar.",
    empty: "Mit dieser E-Mail-Adresse sind keine Schulbuchungen verknüpft.",
    bookingStatuses: { draft: "Entwurf", submitted: "Eingegangen", confirmed: "Bestätigt", cancelled: "Storniert" },
    qrAlt: "QR-Code der Klasse",
    downloadQr: "QR herunterladen",
    cancelBooking: "Buchung stornieren",
    saveChanges: "Änderungen speichern",
    locationUnavailable: "Ort wird noch festgelegt",
  },
  es: {
    accessIntro: "Introduce el correo verificado del docente. Si hay reservas, recibirás un nuevo enlace personal.",
    accessSent: "Revisa el correo: si la dirección está asociada a una reserva, hemos enviado un nuevo enlace.",
    accessError: "No se pudo enviar el enlace. Revisa la dirección e inténtalo de nuevo.",
    confirmationEmailFailed: "La reserva y las plazas están guardadas, pero el correo no se envió. Solicita un nuevo enlace sin repetir la reserva.",
    saved: "Cambios guardados.",
    cancelled: "Reserva cancelada y plazas liberadas.",
    dashboardIntro: "Cada ficha corresponde a una clase o grupo. Las reservas canceladas siguen disponibles para consulta.",
    empty: "No hay reservas escolares vinculadas a este correo.",
    bookingStatuses: { draft: "Borrador", submitted: "Recibida", confirmed: "Confirmada", cancelled: "Cancelada" },
    qrAlt: "Código QR de la clase",
    downloadQr: "Descargar QR",
    cancelBooking: "Cancelar reserva",
    saveChanges: "Guardar cambios",
    locationUnavailable: "Lugar por confirmar",
  },
  nl: {
    accessIntro: "Vul het geverifieerde e-mailadres van de leerkracht in. Als er boekingen zijn, ontvang je een nieuwe persoonlijke link.",
    accessSent: "Controleer je e-mail: als het adres aan een boeking is gekoppeld, hebben we een nieuwe link gestuurd.",
    accessError: "De link kon niet worden verzonden. Controleer het adres en probeer opnieuw.",
    confirmationEmailFailed: "De boeking en plaatsen zijn opgeslagen, maar de e-mail is niet verzonden. Vraag een nieuwe link aan en boek niet opnieuw.",
    saved: "Wijzigingen opgeslagen.",
    cancelled: "Boeking geannuleerd en plaatsen vrijgegeven.",
    dashboardIntro: "Elke kaart staat voor een klas of groep. Geannuleerde boekingen blijven zichtbaar.",
    empty: "Er zijn geen schoolboekingen aan dit e-mailadres gekoppeld.",
    bookingStatuses: { draft: "Concept", submitted: "Ontvangen", confirmed: "Bevestigd", cancelled: "Geannuleerd" },
    qrAlt: "QR-code van de klas",
    downloadQr: "QR downloaden",
    cancelBooking: "Boeking annuleren",
    saveChanges: "Wijzigingen opslaan",
    locationUnavailable: "Locatie wordt bevestigd",
  },
  uk: {
    accessIntro: "Введіть підтверджену електронну адресу вчителя. Якщо бронювання існують, ви отримаєте нове особисте посилання.",
    accessSent: "Перевірте пошту: якщо адресу пов’язано з бронюванням, ми надіслали нове посилання.",
    accessError: "Не вдалося надіслати посилання. Перевірте адресу та спробуйте ще раз.",
    confirmationEmailFailed: "Бронювання та місця збережено, але лист не надіслано. Запросіть нове посилання й не надсилайте бронювання повторно.",
    saved: "Зміни збережено.",
    cancelled: "Бронювання скасовано, місця звільнено.",
    dashboardIntro: "Кожна картка відповідає класу або групі. Скасовані бронювання залишаються доступними для перегляду.",
    empty: "До цієї електронної адреси не прив’язано шкільних бронювань.",
    bookingStatuses: { draft: "Чернетка", submitted: "Отримано", confirmed: "Підтверджено", cancelled: "Скасовано" },
    qrAlt: "QR-код класу",
    downloadQr: "Завантажити QR",
    cancelBooking: "Скасувати бронювання",
    saveChanges: "Зберегти зміни",
    locationUnavailable: "Місце буде уточнено",
  },
};

export function getTeacherFlowCopy(locale: SupportedLocale): TeacherFlowCopy {
  return teacherFlowTranslations[locale];
}
