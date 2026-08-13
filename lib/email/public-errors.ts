export type CampaignEmailAction =
  | "recipients"
  | "preview"
  | "update_recipients"
  | "test"
  | "send";

export type PublicCampaignError = {
  message: string;
  status: 400 | 500;
  unexpected: boolean;
};

const EXPECTED_CAMPAIGN_ERRORS = [
  /^Nessun evento corrente configurato\.$/,
  /^I filtri non individuano destinatari raggiungibili\.$/,
  /^Nome, oggetto e messaggio sono obbligatori\.$/,
  /^Variabili non supportate: .+\.$/,
  /^Seleziona almeno un destinatario(?: valido)?\.$/,
  /^La lista destinatari non è più modificabile\.$/,
  /^Campagna non disponibile o già inviata\.$/,
  /^Non ci sono destinatari in attesa\.$/,
  /^Prima dell'invio definitivo è obbligatorio inviare il test\.$/,
  /^La campagna è già stata presa in carico da un altro invio\.$/,
  /^Puoi allegare al massimo \d+ file\.$/,
  /^Gli allegati non possono superare complessivamente \d+ MB\.$/,
  /^Il file .+ supera il limite di \d+ MB\.$/,
  /^Il tipo di file di .+ non è supportato\.$/,
  /^Solo le immagini possono essere mostrate nel corpo del messaggio\.$/,
  /^(?:Capogruppo|Destinatario) .+\.$/,
] as const;

const UNEXPECTED_MESSAGES: Record<CampaignEmailAction, string> = {
  recipients:
    "Non è stato possibile caricare i destinatari. Riprova tra qualche minuto.",
  preview:
    "Non è stato possibile preparare l'anteprima. Nessuna email è stata inviata. Riprova tra qualche minuto.",
  update_recipients:
    "Non è stato possibile aggiornare i destinatari. Nessuna email è stata inviata. Riprova tra qualche minuto.",
  test:
    "Non è stato possibile inviare l'email di prova. Nessuna email definitiva è stata inviata. Riprova tra qualche minuto.",
  send:
    "Non è stato possibile completare l'invio. Controlla lo stato della campagna prima di riprovare.",
};

export function publicCampaignError(
  cause: unknown,
  action: CampaignEmailAction
): PublicCampaignError {
  const message = cause instanceof Error ? cause.message.trim() : "";
  const expected = EXPECTED_CAMPAIGN_ERRORS.some((pattern) =>
    pattern.test(message)
  );

  if (expected) {
    return { message, status: 400, unexpected: false };
  }

  return {
    message: UNEXPECTED_MESSAGES[action],
    status: 500,
    unexpected: true,
  };
}
