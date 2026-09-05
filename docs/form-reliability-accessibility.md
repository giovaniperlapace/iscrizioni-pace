# Form e minimizzazione accessibilità — 5 settembre 2026

Implementazione preparata sul branch `codex/form-affidabili-accessibilita`.
La migration è stata eseguita su PostgreSQL locale con dati sintetici; **non
è stata applicata al database remoto**. Il codice va pubblicato prima della
migration, perché la versione precedente legge ancora la colonna da eliminare.

## Risultato applicativo

- Form capogruppo e altri form operativi in overlay: errori restituiti alla
  modale, conservazione dei campi nativi e dello stato dei componenti
  condizionali, errori accessibili accanto al campo e focus al primo errore.
- Errori senza un campo associato: messaggio nella stessa modale, con focus.
  Successo e autenticazione mantengono il normale comportamento di navigazione.
- Telefono internazionale, email, nomi e date verificati anche lato server.
  Il form manuale mostra subito la spiegazione del prefisso internazionale.
- Dati di accessibilità limitati alle tre opzioni strutturate. Nessun testo
  libero nei form, azioni, letture delle dashboard o nuovi snapshot. Il
  capogruppo non raccoglie più la richiesta separata di ricontatto. La richiesta
  personale di supporto resta disponibile al partecipante.
- Questionario `2026-09-05-accessibility-minimization`. Il consenso non cambia.
- Le bozze pubbliche precedenti vengono migrate in sessionStorage, anche per
  gli altri indirizzi presenti nel browser, eliminando solo il campo ritirato.
- Il form messaggio all'organizzazione mantiene il testo anche dopo un errore
  di validazione o di consegna. Non sono stati inviati messaggi di prova reali.

## Verifica remota in sola lettura

Rilevazione del 5 settembre 2026, senza esportazione di dati personali:

| Controllo | Conteggio |
| --- | ---: |
| Record di accessibilità | 68 |
| Record con testo libero valorizzato | 1 |
| Snapshot questionario | 68 |
| Snapshot manuali con chiave del testo libero, senza contenuto | 4 |
| Snapshot pubblici con indicatore di presenza del testo libero | 64 |
| Audit contenenti proprietà o marcatori ritirati | 0 |
| Record manuali con richiesta separata di ricontatto attiva | 0 |
| Record pubblici con richiesta personale di supporto attiva | 1 |

La verifica delle chiavi degli snapshot ha confermato che il vincolo della
migration è compatibile con tutte le versioni presenti. Le risposte strutturate
presenti nel remoto non contengono categorie aggiuntive.

## Migration e rilascio

File: `supabase/migrations/20260905120000_minimize_accessibility_data.sql`.

La transazione elimina la colonna del testo libero, rimuove le relative
proprietà e gli indicatori dagli snapshot, ripulisce eventuali metadati audit
e ritira il flag manuale di ricontatto, preservando le richieste personali
successive riconoscibili dall’audit. Gli identificativi delle versioni
storiche restano invariati. Un vincolo impedisce di inserire nuovi snapshot
con proprietà di accessibilità estranee al contratto. Le note interne dei
gruppi e le note dei servizi sono distinte e restano invariate.

1. Integrare e pubblicare il codice compatibile, verificando i form.
2. Applicare sul remoto concordato:

   ```sh
   npm run db:migrate:remote -- supabase/migrations/20260905120000_minimize_accessibility_data.sql
   ```

3. Verificare assenza della colonna, proprietà ritirate negli snapshot e audit,
   registrazione della migration, cache PostgREST e normale salvataggio delle
   opzioni strutturate. Ripetere i conteggi della rilevazione preliminare.

Le migration già applicate restano immutabili: il riferimento alla colonna
nello schema iniziale è la storia necessaria a ricostruire il database, non
un campo ancora utilizzabile dopo questa migration. Le occorrenze residue nei
test e nelle procedure di pulizia servono a verificare la rimozione.

La pulizia è irreversibile. Non creare dump o copie dei valori ritirati nel
repository. I backup antecedenti e i log di recupero del database seguono la
retention dell'infrastruttura: in caso di ripristino va riapplicata questa
migration prima di riaprire l'applicazione.

## Verifiche ripetibili

```sh
npm run lint
npm run typecheck
npm test
npm run build -- --webpack
```

Browser, contro un server locale già avviato (il runner monta e rimuove una
route temporanea; usa dati sintetici e non crea persone né invia email):

```sh
npm run dev -- --webpack --port 3105
node tests/browser/forms-reliability.mjs http://localhost:3105
```

Per la migration usare **esclusivamente un database vuoto e temporaneo**:

```sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/accessibility-minimization.sql
```

La fixture SQL verifica eliminazione effettiva, pulizia ricorsiva, blocco di
nuovi valori ritirati e conservazione di dati strutturati, richiesta personale
di supporto, note operative estranee e identificativi delle versioni storiche.

Esito locale finale: lint, TypeScript, 165 test automatici e build Next.js
con webpack superati. Regressioni browser desktop/mobile superate sui componenti
reali con dati sintetici: ordine del focus, prefisso telefonico, valori nativi
e condizionali conservati, errore server, risposta HTTP 422 e retry riuscito.
La fixture SQL è stata applicata e verificata su PostgreSQL 17.10 locale.
Non è stato eseguito un inserimento reale nel database di produzione.
