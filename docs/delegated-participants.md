# Partecipanti gestiti dal capogruppo e recapito delegato

Implementazione del blocco 4 del 5 settembre 2026. Stato: verificato localmente,
non applicato al database production e non distribuito su main.

## Comportamento

Il capogruppo può inserire una persona anche senza email e senza telefono.
Il form distingue email personale e modalità di consegna: per default le
comunicazioni vengono consegnate al capogruppo. La consegna personale richiede
un’email valida. Il form conserva i valori dopo gli errori e richiede il
consenso dichiarato. Il recapito si può scegliere anche dalla scheda di una
persona già iscritta, mantenendo intatta la sua email personale.

Il capogruppo che salva la scelta diventa il responsabile delle comunicazioni.
La responsabilità operativa continua a seguire le membership dei gruppi e i
loro discendenti attivi nell’evento corrente. Il creatore o il referente
registrato non mantiene l’accesso dopo la perdita dello scope.

La scheda comprende anagrafica e contatti consentiti, gruppo, servizio, tag,
presenze, stato, codice personale e QR scaricabile. Riusa i componenti di
presentazione e QR dell’area personale. Non espone azioni personali di
modifica presenze, iscrizione panel, messaggi all’organizzazione o dati di
accessibilità al capogruppo.

## Schema e autorizzazioni

Migration: `20260905190000_delegated_participants.sql`, in un’unica transazione.

- `registration_responsibilities`: una riga per iscrizione, responsabile in
  `profiles`, modalità `personal|delegated`, dichiarante, data e fonte.
- `create_managed_registration(actor,payload)`: eseguibile solo dal service
  role; verifica membership, evento corrente, consenso e identità del contatto.
  Crea insieme persona, iscrizione, contatti eventuali, assegnazione, consenso,
  figli, presenze, risposte, QR e audit. Le validazioni complete del form sono
  eseguite dal server prima della RPC. Un errore annulla l’intera creazione.
- `update_managed_participant`, `set_registration_delivery` e
  `read_managed_registration_card`: RPC autenticate con attore dalla sessione,
  verifica dello scope corrente e audit nella stessa transazione.
- RLS di `registration_responsibilities` usa `app.can_read_registration`;
  nessuna scrittura diretta per utenti autenticati. La funzione di lettura
  iscrizioni conserva owner/admin/manager/viewer e verifica ora anche gli
  antenati e l’assegnazione corrente per il capogruppo. Nessun accesso alla
  scheda completa viene aggiunto all’accoglienza.
- Le aperture del QR sono auditate senza token. La lettura ordinaria della
  tabella QR non viene ampliata ai capigruppo: passa dalla RPC autorizzata.
- Il backfill conserva il creatore manuale quando è ancora autorizzato e ha un
  recapito; altrimenti seleziona un referente corrente disponibile. Le righe
  sono marcate `legacy_backfill` e auditate. I contatti storici rimangono intatti.

Se viene eliminato l’account del responsabile, i riferimenti diventano nulli
e il recapito delegato non è più utilizzabile; lo storico e gli audit restano.

Il nome dichiarato nel consenso manuale è quello del capogruppo, accompagnato
sempre dal suo ID: non viene presentato come firma diretta del partecipante.
La migrazione non ricostruisce o altera retroattivamente consensi storici.

## Account e campagne

Senza email personale non viene creato alcun account o magic link. Aggiungere
un’email aggiorna la stessa persona; il successivo login verificato la collega
all’account sul medesimo ID. Le ricerche del callback e dell’identità operativa
escludono sempre i contatti legacy con `is_delegate_contact=true`.

Il capogruppo non può sostituire l’email di un account già collegato; può
aggiornare gli altri contatti. Non vengono unificate automaticamente identità
preesistenti o riclassificate email storiche in base a una somiglianza.

La risoluzione dei destinatari è paginata, senza limite implicito di 1.000
righe di PostgREST. Una delega esplicita prevale sull’email personale. Anteprima
e invio riverificano recapito e responsabilità. La coda congelata non viene
reindirizzata automaticamente a un nuovo referente: le consegne non più valide
falliscono con il codice operativo esistente `delivery_failed`.

## Verifiche

Esito locale: 177 test unitari/regressioni superati, lint, typecheck e build
riusciti; fixture PostgreSQL e prove browser desktop/mobile in sette lingue
completate senza errori. Nessuna email reale inviata.

Comandi eseguiti:

```sh
npm test
npm run typecheck
npm run lint
npm run build
node tests/browser/managed-participants.mjs http://localhost:3110
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/delegated-participants.sql
```

La fixture SQL richiede un database PostgreSQL **vuoto e temporaneo**. Carica
lo schema reale necessario e usa solo identità sintetiche. Copre rollback di
un inserimento incompleto, consenso, QR e figli, backfill, email personale
aggiunta allo stesso ID, protezione email account collegato, RLS per owner,
capogruppo padre, altro capogruppo, manager, viewer, admin e accoglienza, e
blocco di lettura/invio dopo la rimozione della membership.

Il test browser monta e rimuove una route temporanea; non eseguirlo in parallelo
al test di copertura degli slug riservati. Verifica i componenti reali, il
parser server del form, gli errori senza perdita dei dati, l’invio senza
contatti personali, download PNG, mobile e sette lingue. La fixture non
costituisce un login end-to-end su Supabase remoto: questo controllo resta da
eseguire sull’ambiente di rilascio dopo l’applicazione della migration.

## Rilascio

Tentativo del 5 settembre 2026: implementazione committata e pubblicata sul
branch `codex/delegated-participants` (`f28b051`), PR #7. Build Vercel con
ambiente production completata e pronta, ma non promossa al dominio pubblico:
`https://iscrizioni-pace-o12puq4kl-giovaniperlapaces-projects.vercel.app`.
Il controllo preliminare del database è riuscito (68 iscrizioni, nessuna email
in coda); i successivi collegamenti SSH a `91.99.81.31:22` sono andati in
timeout. La migration non è stata applicata, main non è stato integrato e il
dominio pubblico conserva il deployment precedente. Riprendere dal controllo
dell'accesso SSH e dello stato migration prima di promuovere il deployment.

1. Applicare prima la migration all’ambiente concordato, conservando il codice
   attuale finché la transazione è completata. Il nuovo codice richiede le RPC.
2. Distribuire il branch verificato. Coordinare una breve finestra senza
   inserimenti manuali: quelli del codice precedente, tra migration e deploy,
   non scriverebbero ancora la responsabilità esplicita.
3. Verificare con un capogruppo di test autorizzato inserimento senza email,
   apertura della scheda, download, aggiunta di email e scelta del recapito.
   Provare un altro capogruppo fuori scope. Preparare solo l’anteprima della
   campagna e l’eventuale prova autorizzata all’operatore; nessun invio massivo.
4. Controllare conteggi di responsabilità, audit e assenza di contatti personali
   fabbricati; aggiornare questo documento e AGENTS.md con l’esito del rilascio.

Le tabelle aggiunte sono additive; un rollback del codice può lasciarle presenti.
Il codice precedente però non interpreta le scelte esplicite di recapito: in
caso di rollback sospendere gli invii campagne fino al ripristino del resolver
compatibile. Non eliminare audit o responsabilità per simulare un rollback.
