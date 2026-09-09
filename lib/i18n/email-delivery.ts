import type { SupportedLocale } from "./config.ts";

// Public sender guidance stays the same when the delivery provider changes.
export const EMAIL_DELIVERY_COPY: Record<SupportedLocale, { checkSpam: string; safeSender: string }> = {
  it: {
    checkSpam: "Controlla anche la cartella spam per non perdere le nostre email.",
    safeSender: "Salva registrationspeace@santegidio.org tra gli indirizzi sicuri per non perdere le comunicazioni.",
  },
  en: {
    checkSpam: "Check your spam folder too so you do not miss our emails.",
    safeSender: "Add registrationspeace@santegidio.org to your safe senders list so you do not miss any communications.",
  },
  fr: {
    checkSpam: "Vérifie aussi le dossier spam pour ne pas manquer nos emails.",
    safeSender: "Ajoute registrationspeace@santegidio.org à tes expéditeurs autorisés pour ne manquer aucune communication.",
  },
  de: {
    checkSpam: "Prüfe auch deinen Spam-Ordner, damit du unsere E-Mails nicht verpasst.",
    safeSender: "Füge registrationspeace@santegidio.org zur Liste sicherer Absender hinzu, damit du keine Mitteilungen verpasst.",
  },
  es: {
    checkSpam: "Revisa también la carpeta de spam para no perderte nuestros correos.",
    safeSender: "Añade registrationspeace@santegidio.org a tu lista de remitentes seguros para no perderte ninguna comunicación.",
  },
  nl: {
    checkSpam: "Controleer ook je spammap, zodat je onze e-mails niet mist.",
    safeSender: "Voeg registrationspeace@santegidio.org toe aan je lijst met veilige afzenders, zodat je geen berichten mist.",
  },
  uk: {
    checkSpam: "Перевіряйте також папку «Спам», щоб не пропустити наші листи.",
    safeSender: "Додайте registrationspeace@santegidio.org до списку надійних відправників, щоб не пропустити повідомлення.",
  },
};
