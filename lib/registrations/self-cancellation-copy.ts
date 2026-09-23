import type { SupportedLocale } from "../i18n/config";

type CancellationCopy = {
  title: string; intro: string; impact: string; history: string; again: string;
  keep: string; confirm: string; pending: string; failed: string; session: string; success: string;
};
export const SELF_CANCELLATION_COPY: Record<SupportedLocale, CancellationCopy> = {
  it: {
    title: "Annulla la mia iscrizione", intro: "Vuoi annullare la tua iscrizione a questo evento?",
    impact: "La tua partecipazione e quella dei figli accompagnati collegati a questa iscrizione non saranno più attive. Il QR non sarà più utilizzabile e la scheda non sarà più modificabile.",
    history: "I dati già registrati saranno conservati nello storico.",
    again: "Se cambi idea, potrai effettuare una nuova iscrizione, anche con la stessa email, quando le iscrizioni sono aperte. Dovrai inserire nuovamente i dati e usare il nuovo QR.",
    keep: "Mantieni la mia iscrizione", confirm: "Conferma annullamento", pending: "Annullamento in corso…",
    failed: "Non è stato possibile annullare l’iscrizione. Riprova o ricarica la pagina.", session: "La sessione è scaduta. Accedi di nuovo prima di riprovare.",
    success: "La tua iscrizione è stata annullata. Puoi iscriverti nuovamente, anche con la stessa email, quando le iscrizioni sono aperte.",
  },
  en: {
    title: "Cancel my registration", intro: "Do you want to cancel your registration for this event?",
    impact: "Your participation and that of accompanying children linked to this registration will no longer be active. Your QR code will no longer work and this registration can no longer be edited.",
    history: "Previously recorded data will be retained in the history.",
    again: "If you change your mind, you can register again, even with the same email, while registration is open. You will need to enter your details again and use the new QR code.",
    keep: "Keep my registration", confirm: "Confirm cancellation", pending: "Cancelling…",
    failed: "We could not cancel your registration. Try again or reload the page.", session: "Your session has expired. Sign in again before retrying.",
    success: "Your registration has been cancelled. You can register again, even with the same email, while registration is open.",
  },
  fr: {
    title: "Annuler mon inscription", intro: "Voulez-vous annuler votre inscription à cet événement ?",
    impact: "Votre participation et celle des enfants accompagnés liés à cette inscription ne seront plus actives. Votre code QR ne sera plus utilisable et cette inscription ne pourra plus être modifiée.",
    history: "Les données déjà enregistrées seront conservées dans l’historique.",
    again: "Si vous changez d’avis, vous pourrez vous réinscrire, même avec la même adresse email, lorsque les inscriptions sont ouvertes. Vous devrez saisir à nouveau vos données et utiliser le nouveau code QR.",
    keep: "Conserver mon inscription", confirm: "Confirmer l’annulation", pending: "Annulation en cours…",
    failed: "Impossible d’annuler votre inscription. Réessayez ou rechargez la page.", session: "Votre session a expiré. Reconnectez-vous avant de réessayer.",
    success: "Votre inscription a été annulée. Vous pourrez vous réinscrire avec la même adresse email lorsque les inscriptions sont ouvertes.",
  },
  de: {
    title: "Meine Anmeldung stornieren", intro: "Möchten Sie Ihre Anmeldung für diese Veranstaltung stornieren?",
    impact: "Ihre Teilnahme und die der mit dieser Anmeldung verknüpften begleiteten Kinder sind dann nicht mehr aktiv. Ihr QR-Code ist nicht mehr gültig und diese Anmeldung kann nicht mehr bearbeitet werden.",
    history: "Bereits erfasste Daten bleiben im Verlauf gespeichert.",
    again: "Wenn Sie es sich anders überlegen, können Sie sich während der Anmeldefrist erneut anmelden, auch mit derselben E-Mail-Adresse. Sie müssen Ihre Daten erneut eingeben und den neuen QR-Code verwenden.",
    keep: "Meine Anmeldung behalten", confirm: "Stornierung bestätigen", pending: "Wird storniert…",
    failed: "Ihre Anmeldung konnte nicht storniert werden. Versuchen Sie es erneut oder laden Sie die Seite neu.", session: "Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an.",
    success: "Ihre Anmeldung wurde storniert. Während der Anmeldefrist können Sie sich erneut anmelden, auch mit derselben E-Mail-Adresse.",
  },
  es: {
    title: "Cancelar mi inscripción", intro: "¿Quieres cancelar tu inscripción a este evento?",
    impact: "Tu participación y la de los hijos acompañados vinculados a esta inscripción dejarán de estar activas. Tu código QR dejará de funcionar y ya no podrás modificar esta inscripción.",
    history: "Los datos ya registrados se conservarán en el historial.",
    again: "Si cambias de idea, podrás inscribirte de nuevo, incluso con el mismo correo, mientras las inscripciones estén abiertas. Tendrás que volver a introducir tus datos y utilizar el nuevo código QR.",
    keep: "Mantener mi inscripción", confirm: "Confirmar cancelación", pending: "Cancelando…",
    failed: "No se ha podido cancelar tu inscripción. Inténtalo de nuevo o recarga la página.", session: "Tu sesión ha caducado. Vuelve a iniciar sesión antes de intentarlo de nuevo.",
    success: "Tu inscripción se ha cancelado. Puedes inscribirte de nuevo con el mismo correo mientras las inscripciones estén abiertas.",
  },
  nl: {
    title: "Mijn inschrijving annuleren", intro: "Wil je je inschrijving voor dit evenement annuleren?",
    impact: "Je deelname en die van de begeleide kinderen bij deze inschrijving zijn dan niet meer actief. Je QR-code werkt niet meer en je kunt deze inschrijving niet meer wijzigen.",
    history: "Eerder vastgelegde gegevens blijven in de geschiedenis bewaard.",
    again: "Als je van gedachten verandert, kun je je opnieuw inschrijven, ook met hetzelfde e-mailadres, zolang de inschrijving open is. Je moet je gegevens opnieuw invullen en de nieuwe QR-code gebruiken.",
    keep: "Mijn inschrijving behouden", confirm: "Annulering bevestigen", pending: "Bezig met annuleren…",
    failed: "Je inschrijving kon niet worden geannuleerd. Probeer het opnieuw of laad de pagina opnieuw.", session: "Je sessie is verlopen. Meld je opnieuw aan voordat je het opnieuw probeert.",
    success: "Je inschrijving is geannuleerd. Je kunt je opnieuw inschrijven met hetzelfde e-mailadres zolang de inschrijving open is.",
  },
  uk: {
    title: "Скасувати мою реєстрацію", intro: "Бажаєте скасувати свою реєстрацію на цей захід?",
    impact: "Ваша участь та участь дітей у супроводі, пов’язаних із цією реєстрацією, більше не будуть активними. QR-код більше не діятиме, а реєстрацію не можна буде редагувати.",
    history: "Раніше внесені дані залишаться в історії.",
    again: "Якщо передумаєте, ви зможете зареєструватися знову, навіть із тією самою електронною адресою, поки реєстрація відкрита. Потрібно буде повторно ввести дані та використовувати новий QR-код.",
    keep: "Зберегти мою реєстрацію", confirm: "Підтвердити скасування", pending: "Скасування…",
    failed: "Не вдалося скасувати реєстрацію. Спробуйте ще раз або оновіть сторінку.", session: "Сеанс завершився. Увійдіть знову, перш ніж повторити спробу.",
    success: "Вашу реєстрацію скасовано. Ви можете зареєструватися знову з тією самою електронною адресою, поки реєстрація відкрита.",
  },
};
