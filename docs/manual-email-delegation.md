# Email personale o del capogruppo

Dal 2026-09-08, l’inserimento manuale distingue:

- **Email personale**: obbligatoria senza delega. Il partecipante riceve le
  comunicazioni al proprio indirizzo e può richiedere un Magic Link dalla home.
  Dal 2026-09-11 riceve automaticamente le istruzioni dopo il salvataggio
  completo. Il primo Magic Link crea l’utenza e la callback verificata collega
  la scheda. Dettagli: `docs/account-access-notifications.md`.
- **Voglio usare la mia email**: il campo personale scompare. Il partecipante
  non ha email né account personale; il capogruppo gestisce la scheda e riceve
  le comunicazioni per suo conto. Anche il telefono è facoltativo.

L’email del capogruppo non viene copiata nei contatti del partecipante. La sua
iscrizione personale e gli invii a lui destinati restano destinatari distinti.
La scelta non attiva il consenso opzionale alle comunicazioni future.

## Conservazione e consegna

La creazione registra il referente autenticato nello snapshot questionario:
`answers.contact.useLeaderEmail` e `communicationDelegateUserId`.
L’audit e `registrations.created_by` identificano lo stesso attore.
Il browser invia solo la scelta, mai l’ID autorevole del referente.

Il resolver delle campagne dà precedenza all’email personale corrente.
Quando manca, la delega esplicita seleziona solo il creatore registrato,
purché ancora raggiungibile e autorizzato sul gruppo corrente o un antenato
attivo nello stesso evento. La perdita di scope o l’eliminazione della sua
iscrizione impediscono l’invio, senza passaggio automatico a un altro referente.
Il fallback delle schede storiche senza delega esplicita rimane compatibile.

Dalla scheda il capogruppo può aggiungere l’email personale: diventano disponibili
comunicazioni dirette e Magic Link, senza una nuova iscrizione o un cambio QR.
Gli invii in attesa ricalcolano il destinatario prima della consegna; gli invii
storici restano invariati. Nessun invito viene inviato automaticamente.

Nessuna nuova tabella, migration, modifica RLS o operazione sui dati reali.
La scelta viene salvata prima dell’assegnazione operativa, così un errore nello
snapshot non attiva il fallback storico verso un altro referente. La creazione
manuale rimane composta da più scritture, come nel flusso precedente.

## Verifica locale

Eseguire lint, typecheck, test e build tramite gli script npm. Per il browser,
avviare `npm run dev -- --port 3106` e `node tests/browser/manual-email.mjs`.

La fixture usa componente e parser reali con un’azione sintetica che non scrive
su Supabase né invia email. I test del resolver coprono più referenti, antenati,
perdita di scope, email aggiunta, eventi estranei, iscrizioni eliminate,
errori di lettura e aggiornamento di una consegna precedentemente delegata.
Queste prove non sostituiscono un collaudo autenticato completo su Supabase.
