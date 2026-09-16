import type { SupportedLocale } from "../i18n/config.ts";

const COPY: Record<SupportedLocale, { title: string; message: string; button: string; cancel: string }> = {
  it: { title: "Accedi alla tua iscrizione", message: "Conferma per aprire la tua area personale.", button: "Conferma e accedi", cancel: "Torna alla pagina iniziale" },
  en: { title: "Access your registration", message: "Confirm to open your personal area.", button: "Confirm and sign in", cancel: "Back to the home page" },
  fr: { title: "Accédez à votre inscription", message: "Confirmez pour ouvrir votre espace personnel.", button: "Confirmer et se connecter", cancel: "Retour à l’accueil" },
  de: { title: "Auf Ihre Anmeldung zugreifen", message: "Bestätigen Sie, um Ihren persönlichen Bereich zu öffnen.", button: "Bestätigen und anmelden", cancel: "Zurück zur Startseite" },
  es: { title: "Accede a tu inscripción", message: "Confirma para abrir tu área personal.", button: "Confirmar y acceder", cancel: "Volver al inicio" },
  nl: { title: "Open je inschrijving", message: "Bevestig om je persoonlijke omgeving te openen.", button: "Bevestigen en inloggen", cancel: "Terug naar de startpagina" },
  uk: { title: "Відкрийте свою реєстрацію", message: "Підтвердьте, щоб відкрити особистий кабінет.", button: "Підтвердити та увійти", cancel: "На головну сторінку" },
};

const FIELDS = ["code", "token_hash", "token", "type", "role", "redirect_to"];
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("'", "&#39;");

// Deliberately no scripts, auto-submit, prefetch, or link to a token-consuming GET.
// A native POST works even with JavaScript disabled and inside mail browsers.
export function renderMagicLinkConfirmation(params: URLSearchParams, locale: SupportedLocale): string {
  const copy = COPY[locale];
  const fields = FIELDS.flatMap(name => {
    const value = params.get(name);
    return value === null ? [] : [`<input type="hidden" name="${name}" value="${escape(value)}">`];
  }).join("");
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="strict-origin"><title>${copy.title}</title>
<style>html{color-scheme:light}body{margin:0;background:#f4f7fa;color:#183248;font:16px/1.6 system-ui,sans-serif}main{min-height:100svh;display:grid;place-items:center;padding:24px;box-sizing:border-box}.card{width:100%;max-width:540px;background:white;border:1px solid #dbe5ed;border-radius:20px;overflow:hidden;box-shadow:0 16px 50px #163b5710}header{padding:28px;background:#174b72;color:white}.brand{margin:0;font-size:14px;font-weight:700;letter-spacing:.05em}.place{margin:8px 0 0;font-size:14px}.content{padding:32px}h1{font-size:28px;line-height:1.25;margin:0 0 16px}p{margin:0 0 24px}button{font:inherit;font-weight:650;border:0;border-radius:10px;background:#174b72;color:white;width:100%;padding:14px 20px;cursor:pointer}button:hover{background:#103b5c}button:focus-visible,a:focus-visible{outline:3px solid #e19b28;outline-offset:4px}a{display:inline-block;color:#174b72;margin-top:24px;font-size:14px}@media(max-width:420px){.content{padding:24px}h1{font-size:24px}}</style></head><body><main><section class="card" aria-labelledby="title"><header><p class="brand">UNARMED AND DISARMING PEACE</p><p class="place">Assisi · 25–27 October 2026</p></header><div class="content"><h1 id="title">${copy.title}</h1><p>${copy.message}</p><form method="post" action="/auth/callback">${fields}<button type="submit">${copy.button}</button></form><a href="/">${copy.cancel}</a></div></section></main></body></html>`;
}

export const MAGIC_LINK_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  // no-referrer makes native navigation POSTs send Origin:null in Chromium.
  // Keep same-origin CSRF validation while never exposing the token/query.
  "Referrer-Policy": "strict-origin",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
};
