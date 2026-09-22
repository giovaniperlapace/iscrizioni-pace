# Aggiunte nelle schede operative — 22 settembre 2026

> Aggiornamento rilascio 22 settembre 2026: migration applicata e registrata in
> produzione nella stessa transazione delle altre due attività, prima del push
> su main autorizzato. Controlli integrati: 439 test, lint, TypeScript, build,
> SQL e browser superati. Le indicazioni sotto sul mancato rilascio descrivono
> lo stato preparatorio. Verificate invarianza di 13 tabelle operative e RLS;
> la sola migration email ha scollegato 11 identità eliminate, con audit.
> Test incrociato: `psql -U postgres -v ON_ERROR_STOP=1 -f tests/sql/combined-operational-release.sql`
> esclusivamente in un database temporaneo vuoto.

La verifica ha confermato che le schede Manager/Admin e capogruppo consentivano
solo modifica/rimozione dei figli già presenti e non esponevano la modifica dei
bisogni di accessibilità.

Entrambe le schede ora usano i medesimi moduli per:

- aggiungere figli all’iscrizione, anche quando non ne esistono, fino a dieci;
- aggiornare le tre opzioni esistenti di accessibilità (udito, cammino/gradini,
  sedia a rotelle/ausili), con testi nelle sette lingue.

I nuovi figli mantengono il modello esistente: sono collegati all’iscrizione del
genitore e ne ereditano gruppo, presenze e QR. Si conservano le date storiche
ammesse dagli inserimenti assistiti; i limiti 0–17 del modulo pubblico non
vengono estesi alle correzioni operative. Nomi obbligatori, massimo 120 caratteri,
data valida e non futura. L’inserimento usa la prima posizione disponibile senza
rinumerare i fratelli. UUID di richiesta conservato dopo errore: un reinvio della
stessa richiesta già accettata non crea duplicati né un secondo audit.

L’accessibilità viene caricata solo all’apertura della scheda modificabile tramite
azione autenticata; errori di lettura non diventano valori vuoti salvabili.
Confronto dello snapshot originario prima della scrittura; conflitti `PT409`,
nessun nuovo uso di `40001`. Si preservano chiavi storiche del questionario e
`needs_operational_support`, che è una richiesta distinta di ricontatto. Nessuna
modifica ai consensi o allo snapshot storico del questionario.

## Database e rilascio

Migration `20260922190000_operational_registration_additions.sql`, da applicare
prima della pubblicazione dell’app. Non è stata applicata in produzione in
questa attività. Non riscrive i dati e non modifica le policy RLS.

Le quattro RPC sono eseguibili soltanto da `service_role`: il server deriva
l’attore dalla sessione. La funzione comune blocca l’iscrizione e autorizza Admin
globale, Manager dell’evento, oppure capogruppo con membership e gerarchia attive,
assegnazione corrente ed evento corrente. Iscrizioni eliminate escluse.
Inserimento figlio/modifica accessibilità e audit sono atomici.

## Collaudo riproducibile

- `node --test tests/operational-registration-additions.test.mts`: validazione,
  attore derivato dalla sessione, payload ammessi, errori, conflitti, invalidazione.
- `psql -v ON_ERROR_STOP=1 -f tests/sql/operational-registration-additions.sql`
  **solo su database temporaneo vuoto**: ruoli/grant, scope e gerarchie,
  eliminati, idempotenza, limite dieci, buchi nelle posizioni, conflitti,
  conservazione degli altri dati, audit.
- `BASE_URL=http://localhost:3012 node tests/browser/operational-registration-additions.mjs`
  con server locale avviato: route temporanea, azioni sintetiche, sette lingue,
  salvataggi/errori, desktop/mobile. Eseguire separatamente dalla suite e dalla
  build perché monta e rimuove una route di collaudo.

Non sono state effettuate scritture su partecipanti reali né invii email.

Verifica conclusiva: 437 test della suite superati, lint, TypeScript e build
production superati. SQL temporaneo superato; browser nelle sette lingue,
mobile, errori/conflitti e successo verificati. Avviso React sulle chiavi dei
messaggi dopo inserimento corretto e ricontrollato nel browser.
