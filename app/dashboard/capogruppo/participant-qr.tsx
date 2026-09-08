import { Download, QrCode } from "lucide-react";
import type { RegistrationQrPreview } from "@/lib/qrcode/registration-qr";
import type { SupportedLocale } from "@/lib/i18n/config";

const COPY = {
  it: {
    title: "QR code del partecipante",
    download: "Scarica immagine",
    active: "QR code attivo",
    revoked: "QR code revocato",
    expired: "QR code scaduto",
    unavailable: "QR code non disponibile",
    help: "Puoi scaricare questo QR per aiutare il partecipante ad accedere all’evento. Vale anche per i figli associati alla sua iscrizione.",
    fallback:
      "Se il QR non è disponibile, comunica il codice partecipante all’accoglienza.",
    until: "Valido fino al",
  },
  en: {
    title: "Participant QR code",
    download: "Download image",
    active: "QR code active",
    revoked: "QR code revoked",
    expired: "QR code expired",
    unavailable: "QR code unavailable",
    help: "Download this QR code to help the participant access the event. It also covers the children linked to this registration.",
    fallback:
      "If the QR code is unavailable, give the participant code to the welcome desk.",
    until: "Valid until",
  },
  fr: {
    title: "QR code du participant",
    download: "Télécharger l’image",
    active: "QR code actif",
    revoked: "QR code révoqué",
    expired: "QR code expiré",
    unavailable: "QR code indisponible",
    help: "Téléchargez ce QR code pour aider le participant à accéder à l’événement. Il couvre aussi les enfants liés à cette inscription.",
    fallback:
      "Si le QR code est indisponible, communiquez le code du participant à l’accueil.",
    until: "Valable jusqu’au",
  },
  de: {
    title: "QR-Code des Teilnehmers",
    download: "Bild herunterladen",
    active: "QR-Code aktiv",
    revoked: "QR-Code widerrufen",
    expired: "QR-Code abgelaufen",
    unavailable: "QR-Code nicht verfügbar",
    help: "Laden Sie diesen QR-Code herunter, um dem Teilnehmer beim Zugang zur Veranstaltung zu helfen. Er gilt auch für die mit dieser Anmeldung verbundenen Kinder.",
    fallback:
      "Wenn der QR-Code nicht verfügbar ist, geben Sie den Teilnehmercode am Empfang an.",
    until: "Gültig bis",
  },
  es: {
    title: "Código QR del participante",
    download: "Descargar imagen",
    active: "Código QR activo",
    revoked: "Código QR revocado",
    expired: "Código QR caducado",
    unavailable: "Código QR no disponible",
    help: "Descarga este QR para ayudar al participante a acceder al evento. También cubre a los hijos asociados a su inscripción.",
    fallback:
      "Si el QR no está disponible, comunica el código del participante en la acogida.",
    until: "Válido hasta el",
  },
  nl: {
    title: "QR-code van de deelnemer",
    download: "Afbeelding downloaden",
    active: "QR-code actief",
    revoked: "QR-code ingetrokken",
    expired: "QR-code verlopen",
    unavailable: "QR-code niet beschikbaar",
    help: "Download deze QR-code om de deelnemer te helpen toegang te krijgen tot het evenement. Hij geldt ook voor de kinderen die aan deze inschrijving zijn gekoppeld.",
    fallback:
      "Als de QR-code niet beschikbaar is, geef de deelnemerscode door aan de ontvangst.",
    until: "Geldig tot",
  },
  uk: {
    title: "QR-код учасника",
    download: "Завантажити зображення",
    active: "QR-код активний",
    revoked: "QR-код відкликано",
    expired: "Термін дії QR-коду минув",
    unavailable: "QR-код недоступний",
    help: "Завантажте цей QR-код, щоб допомогти учаснику потрапити на подію. Він також діє для дітей, пов’язаних із цією реєстрацією.",
    fallback: "Якщо QR-код недоступний, повідомте код учасника на прийомі.",
    until: "Дійсний до",
  },
} satisfies Record<SupportedLocale, Record<string, string>>;

export function LeaderParticipantQr({
  qr,
  participantName,
  participantCode,
  locale,
}: {
  qr: RegistrationQrPreview;
  participantName: string;
  participantCode: string | null;
  locale: SupportedLocale;
}) {
  const copy = COPY[locale];
  const active = qr.state === "active" && Boolean(qr.dataUrl);
  const label =
    copy[qr.state === "active" && !active ? "unavailable" : qr.state];
  const filename = `qr-${participantCode?.replace(/[^A-Za-z0-9_-]/g, "") || "partecipante"}.png`;
  return (
    <section
      aria-label={copy.title}
      className="rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-semibold text-[var(--peace-ink)]">{copy.title}</h4>
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <span
            aria-hidden="true"
            className={`size-3 rounded-full ${active ? "bg-[#2f8f4e]" : "bg-[#c94b3b]"}`}
          />
          {label}
        </span>
      </div>
      <div className="grid items-center gap-5 sm:grid-cols-[12rem_1fr]">
        {active && qr.dataUrl ? (
          // The opaque credential is rendered server-side as a PNG, like the personal QR.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr.dataUrl}
            alt={`${copy.title}: ${participantName}`}
            width={192}
            height={192}
            className="mx-auto h-auto w-full max-w-48 rounded-md border border-[var(--peace-border-strong)] bg-white p-3"
          />
        ) : (
          <div
            aria-hidden="true"
            className="mx-auto grid aspect-square w-full max-w-48 place-items-center rounded-md border border-[var(--peace-border)] bg-white text-[var(--peace-muted)]"
          >
            <QrCode size={48} />
          </div>
        )}
        <div className="grid justify-items-start gap-3">
          <p className="max-w-xl text-sm leading-6 text-[var(--peace-muted)]">
            {active ? copy.help : copy.fallback}
          </p>
          {active && qr.expiresAt ? (
            <p className="text-sm text-[var(--peace-muted)]">
              {copy.until}{" "}
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Europe/Rome",
              }).format(new Date(qr.expiresAt))}
            </p>
          ) : null}
          {active && qr.downloadDataUrl ? (
            <a
              href={qr.downloadDataUrl}
              download={filename}
              aria-label={`${copy.download}: ${participantName}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white hover:bg-[var(--peace-blue-900)]"
            >
              <Download size={18} aria-hidden="true" />
              {copy.download}
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#8aa6bd] px-4 text-sm font-semibold text-white"
            >
              <Download size={18} aria-hidden="true" />
              {copy.download}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
