import { startPublicEmailFlow } from "@/app/actions";
import { EmailAccessForm } from "@/app/email-access-form";
import Link from "@/components/pending-link";
import { getMessages } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/server";

export async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  const copy = getMessages(locale).login;
    const labels = {
      it: ["Accesso riservato", "Durante la pausa l’accesso è riservato ad admin e manager.", "Se l’indirizzo è abilitato, riceverai un link per accedere."],
      en: ["Staff access", "During the pause, access is limited to admins and managers.", "If the address is authorised, you will receive a sign-in link."],
      fr: ["Accès réservé", "Pendant la pause, l’accès est réservé aux administrateurs et managers.", "Si l’adresse est autorisée, vous recevrez un lien de connexion."],
      de: ["Interner Zugang", "Während der Pause haben nur Administratoren und Manager Zugang.", "Wenn die Adresse berechtigt ist, erhalten Sie einen Anmeldelink."],
      es: ["Acceso reservado", "Durante la pausa, el acceso está reservado a administradores y managers.", "Si la dirección está autorizada, recibirás un enlace de acceso."],
      nl: ["Beperkte toegang", "Tijdens de pauze hebben alleen beheerders en managers toegang.", "Als het adres toegang heeft, ontvangt u een inloglink."],
      uk: ["Службовий вхід", "Під час паузи доступ мають лише адміністратори та менеджери.", "Якщо адресу авторизовано, ви отримаєте посилання для входу."],
    }[locale];
    return <main className="app-page text-[var(--peace-ink)]"><section className="app-container max-w-2xl py-16">
      <h1 className="text-3xl font-semibold">{labels[0]}</h1>
      <p className="my-6">{labels[1]}</p>
      <EmailAccessForm action={startPublicEmailFlow} defaultEmail="" error={params.error} sent={params.sent}
        copy={{ ...getMessages(locale).emailAccess, magicLinkSent: labels[2] }} />
      <Link href="/" className="btn-secondary mt-8 inline-flex">{copy.backHome}</Link>
    </section></main>;
}
