# Qualità dati, duplicati e scambio Excel — blocco 6

La tabella condivisa admin/manager offre `Esporta iscritti`, limitato ai filtri
e alle colonne visibili, e `Importa iscritti da Excel` in modale con istruzioni
e modello. Il controllo duplicati ha una vista dedicata nel menu Partecipanti, accanto
a Partecipanti e Senza gruppo (`view=duplicates`).

## Formato canonico

Fonte unica: `lib/data-quality/format.ts`, versione `pace-partecipanti-v1`.
`GET .../api?kind=template` genera un modello `.xlsx` con `Partecipanti` vuoto,
`Esempi` separato, `Istruzioni` e `Cataloghi` dell'evento corrente. ExcelJS è
caricato solo dal server; il browser non interpreta i file.

Intestazioni obbligatorie, in ordine:

```text
nome, cognome, data_nascita, email, telefono, paese, citta, gruppo,
servizio, stato_servizio, tag, stato, consenso_privacy, versione_privacy, data_consenso
```

- Nome e cognome: 2–120 caratteri; almeno uno tra email e telefono.
- Date come testo `AAAA-MM-GG`, reali, dal 1900 e non future. Nascita facoltativa.
- Telefono come testo E.164 con `+` e 7–15 cifre; separatori comuni/`00`
  normalizzati senza accettare lettere o stringhe arbitrarie. Email normalizzata.
- Paese/città: testo libero fino a 120 caratteri, facoltativo.
- Gruppo/servizio: UUID oppure nome normalizzato univoco tra le opzioni attive
  dell'evento. Gruppi anche assegnabili. Nessuna creazione automatica.
- Tag: UUID o nomi univoci separati da `;`; marcatori interni.
- Stato iscrizione: `submitted` (default), `confirmed`, `cancelled`.
- Stato servizio: `assigned` (default con servizio presente),
  `preference_pending`, `proposal_pending`, `declined`. Richiede un servizio;
  una preferenza esportata non viene trasformata in assegnazione.
- Consenso: `si`, versione dell'informativa effettivamente accettata e data
  originale obbligatorie. L'operatore attesta la disponibilità del consenso
  già raccolto; nessuna accettazione viene inventata dal semplice caricamento.
- Nuove iscrizioni individuali, source `import`, senza modificare identità
  esistenti. Presenze inizialmente unknown, QR opaco cifrato e consenso
  tracciato. Dati di accessibilità, figli accompagnati e questionari completi
  restano nei flussi dedicati.

File massimo 2 MiB, 500 righe. Valori testuali semplici: date numeriche,
formule, link esterni, macro, colonne/fogli inattesi sono respinti. Yauzl
verifica e drena ogni entry prima di ExcelJS: 100 entry, 10 MiB decompressi
complessivi, limiti su coordinate/celle, nessuna estrazione su filesystem.
L'export scrive celle esplicitamente stringa, anche per valori che iniziano con
`=`, `+`, `-`, `@`; nessuna formula viene generata. Parser e writer si basano
sulle API ufficiali [ExcelJS](https://github.com/exceljs/exceljs) e
[yauzl](https://github.com/thejoshwolfe/yauzl).

## Motore duplicati

`lib/data-quality/duplicates.ts` è condiviso tra revisione, preview Excel e
inserimento manuale capogruppo. Normalizzazione Unicode, accenti, spazi,
punteggiatura, email e telefono; Levenshtein limitato sui nomi normalizzati.

- Esatta: nome/cognome e nascita uguali, più email o telefono uguali.
- Molto probabile: nomi uguali e almeno un segnale forte, oppure nomi simili
  con nascita e contatto uguali, senza conflitti di nascita.
- Possibile: omonimia, contatto condiviso o nomi simili corroborati da nascita,
  contatto oppure paese+città. Date di nascita differenti abbassano la classe.
- Falso positivo verificato: decisione esplicita persistita per la coppia.
  Fingerprint SHA-256 dei campi confrontati; se cambiano i dati, il caso si
  riapre. Nessuna duplicazione dei dati personali nei fingerprint persistiti.

La distanza testuale da sola non produce merge né una corrispondenza forte.
La ricerca in console confronta candidati indicizzati per nomi, contatti,
nascita e territorio, senza perdere i casi ammessi dal motore; risultati a
pagine da 50. Il capogruppo riceve un errore sul campo di motivazione senza
vedere dati di persone fuori dal suo scope. Per una nuova persona distinta
serve una motivazione 3–500 caratteri, con audit e falsa positività persistita.
Rimane il precedente vincolo manuale sull'email già registrata. Un candidato
archiviato richiede prima verifica admin, sia nell'import sia nell'inserimento
manuale, per non aggirare il soft delete.

## Importazione senza scritture prima della conferma

1. Upload autenticato e verifica dello scope corrente. Lettura, validazione,
   confronto con iscrizioni dell'evento (anche archiviate, mostrate solo come
   avviso generico) e confronto interno al file. Nessuna scrittura DB.
2. Preview cifrata e autenticata AES-GCM, legata a operatore, evento, scopo,
   scadenza di 20 minuti, UUID dell'import e versione dei dati letti. Non viene
   salvato il file né una bozza contenente i dati personali.
3. Ogni errore richiede correzione/nuovo upload o scarto motivato. Ogni
   corrispondenza richiede scarto o motivazione di persona distinta. Checkbox
   finale e riepilogo delle quantità; validazione ripetuta dal server.
4. `commit_participant_import` effettua tutte le scritture e l'audit in una
   transazione. Lock brevi chiudono il divario tra versione e scritture;
   variazioni concorrenti causano errore `40001`, senza import parziali.
5. UUID e hash del payload in `participant_imports`, con lock advisory per
   reinvii simultanei: stesso invio restituisce le quantità già elaborate;
   stesso UUID con payload diverso viene respinto. Decisioni di persona
   distinta persistite anche tra righe dello stesso file. Audit delle righe
   scartate senza copiarne il contenuto.

## Merge e storico

Confronto affiancato con dati identificativi, contatti, gruppo, servizio, tag,
stato e collegamento alla scheda completa. Per unire servono scelta del
record da conservare, motivazione e conferma esplicita.

`review_participant_duplicate` serializza la revisione, controlla scope e
versione e conserva nome/cognome/valori presenti del record scelto. Completa
nascita/geografia/contatti mancanti, recupera gruppo e servizio solo se assenti,
unisce tag e presenze, con prevalenza delle scelte di presenza esistenti.
Il record perdente viene soft-deleted e collegato con `merged_into_id`:
QR revocato, invii pendenti esclusi; identità, consensi, questionari e storico
restano conservati nella scheda originaria. Il normale ripristino è impedito
per un record unito.

Limitazioni esplicite: conservare il record collegato all'account; due account,
identità coinvolte in altri eventi o record da archiviare con minori,
check-in, momenti o dati di accessibilità richiedono riconciliazione dedicata.
Il merge viene annullato integralmente, compreso l'eventuale completamento di
campi già avviato, senza scartare i dati dipendenti.

## Export, scope e audit

`GET .../api?kind=export` rilegge tutti i risultati con client di sessione e
RLS, paginazione da 500 e relazioni a blocchi da 300. Usa gli stessi helper
filtri della tabella: ricerca, contatti, gruppo, servizio, tag, coda
Senza gruppo e `stat`. La selezione statistica include i minori tramite
l'iscrizione familiare. L'archivio è riservato agli admin.
Lo stato tecnico non è un filtro operativo: eventuali vecchi parametri
`status` sono ignorati sia nella tabella sia nell'export.

L'export contiene un solo foglio `Iscritti` con le colonne visibili della
tabella, nello stesso ordine: il client invia sempre `columns`, anche se la
scelta proviene dal browser o dalla vista Senza gruppo. Il server valida i
nomi tramite `parseTablePreferences`; senza parametro usa le colonne
predefinite. Partecipante resta obbligatorio. Gruppi, servizi (anche non più
attivi) e tag usano nomi leggibili; Età è calcolata all'inizio dell'evento.
Nessun foglio aggiuntivo con dati non selezionati. L'audit registra le colonne
esportate, senza i valori. Questo file è destinato alla consultazione;
per importare usare il modello canonico scaricabile dalla modale.

Import e decisioni: admin/manager dell'evento. Viewer: consultazione, template
ed export. RPC con attore eseguibili esclusivamente da `service_role`, con
controlli SQL di scope ripetuti. Nuove tabelle protette da RLS, nessuna policy
preesistente allargata. Mutazioni HTTP con controllo Origin, autenticazione,
limite reale del body prima del parsing, risposta `private, no-store`.

Audit: `participants.exported`, `registration.imported`, `import.row_skipped`,
`import.committed`, `participant.merged`, `duplicate.false_positive`,
`duplicate.false_positive_manual`, oltre ad audit operativi e soft delete.
Niente corpi Excel, token QR o copie degli indirizzi nei log nuovi.

## Verifiche e rilascio

### Correzione permesso schema server — 2026-09-06, applicata

Riprodotto dalla console locale l'errore della RPC `quality_event_version`:
`42501: permission denied for schema app`. In produzione `service_role` aveva
già EXECUTE su `app.quality_authorize`, ma mancava USAGE sullo schema `app`.
I ruoli `anon` e `authenticated` hanno già USAGE, senza EXECUTE su questo
helper riservato al server. La fixture SQL preesistente concedeva USAGE
esplicitamente, nascondendo la differenza rispetto al database reale.

Blocco di manutenzione autorizzato dall'utente, applicato e registrato con
`20260906120000_service_role_app_schema_usage.sql`:

```sql
begin;
grant usage on schema app to service_role;
commit;
```

Non concede CREATE sullo schema né ulteriori privilegi sulle funzioni e non
modifica le policy RLS. Suite SQL completa passata su PostgreSQL 17 temporaneo,
con regressione del grant mancante, viewer e manager fuori scope. RPC/PostgREST
verificata dopo il rilascio: operatore autorizzato ammesso, attore non autorizzato
rifiutato. Conteggi/hash invariati per registrations, participants, audit_logs,
duplicate_reviews, participant_imports e qr_tokens; nessun import o merge reale.
Il loader condiviso specifica inoltre la FK del gruppo corrente: il join
generico era ambiguo per PostgREST e bloccava anche l'export.

`Importa iscritti da Excel` apre una modale nativa nella dashboard, tramite
`import=excel`, con modello, istruzioni espandibili e anteprima. X/Escape
chiudono conservando la consultazione corrente. La modale usa colori, bordi e
pulsanti condivisi con il sito. I tre passaggi guidano alla preparazione,
scelta del file e conferma. Il selettore `Scegli file Excel` mostra il nome del
file; la sostituzione azzera l'anteprima per evitare conferme sul file precedente.
`IMPORT_GUIDE` contiene istruzioni con esempi e termini comprensibili agli
operatori, riutilizzate nella modale, nella pagina istruzioni e nel foglio
Istruzioni del modello. Il modello resta distinto dall'esportazione tabellare.
La route legacy
`/dashboard/participants/data-quality` reindirizza alla modale. Il controllo
duplicati si apre nella vista `view=duplicates` del menu condiviso
`Sezioni partecipanti`, accanto a Partecipanti e Senza gruppo. Le tre viste
mostrano una sola tabella alla volta. I cambi vista azzerano i filtri di ricerca,
gruppo, servizio, tag e statistiche; conservano dashboard, sidebar e colonne.
Il controllo riguarda l'intero evento ed è caricato tramite Suspense soltanto
quando si apre Duplicati. Ogni coppia mostra entrambe le persone, email, gruppo,
motivi del rilevamento, confronto e azioni dirette. `Modifica` apre la scheda
condivisa; il confronto e `Escludi` usano un dialog nativo con X/Escape e scroll
interno. Escludere richiede motivazione e conferma, marca la coppia come persone
distinte e conserva entrambe le iscrizioni. La vista `Esclusi` permette la
consultazione successiva; cambiando l'identità la segnalazione si riapre.
Unioni e permessi restano quelli del motore esistente. Le chiusure e i salvataggi
conservano la vista Duplicati, `duplicateShow`, `duplicatePage` e sidebar. L'esportazione
Excel è sotto i filtri, con pulsante verde `Esporta iscritti`, icona download
e descrizione dei filtri applicati.

```sh
npm run lint
npm run typecheck
npm test
npm run build -- --webpack
# Solo database PostgreSQL VUOTO, locale e temporaneo:
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/data-quality.sql
# Dev server già avviato: fixture sintetica, nessuna scrittura production.
node tests/browser/data-quality.mjs http://localhost:3116
node tests/browser/participants-navigation.mjs http://localhost:3116
```

Le suite verificano ranking e falsi positivi, invalidità/date/cataloghi,
formule/link/limiti, template e roundtrip, export oltre la millesima riga,
filtro minori, token alterati/scaduti/fuori scope, rollback di import e merge,
audit fallito, idempotenza, servizi fuori evento, viewer/manager fuori scope,
account conservati, QR revocati e ripristino di merge vietato. Browser:
anteprima senza commit, blocco errori, scarto motivato, conferma esplicita,
scelta survivor, errore persistente e desktop/mobile senza overflow.

Migration additiva `20260905210000_data_quality_excel.sql`: applicare prima
del push/deployment del codice. Non importa, unisce o modifica persone
esistenti. Verificare conteggi/hash di storico invariati, privilegi RPC e
schema PostgREST dopo l'applicazione. In caso di rollback del codice,
conservare tabelle, `merged_into_id` e trigger di protezione.

Dipendenze: ExcelJS 4.4, yauzl 3; override mirato di uuid 11.1.1 per ExcelJS,
più aggiornamento compatibile brace-expansion. L'audit npm conserva segnalazioni
preesistenti dello stack (Next/PostCSS/sharp e dipendenze editor), da trattare
in un blocco di aggiornamento dedicato; nessun downgrade di ExcelJS o upgrade
indiscriminato del framework in questa modifica.

### Verifica production del 2026-09-05

Migration applicata e registrata, cache PostgREST aggiornata. Conteggi e hash
invariati sulle dieci tabelle controllate: 68 iscrizioni, 165 identità e
contatti, 68 consensi, 68 questionari, 72 assegnazioni storiche, 0 servizi
assegnati, 68 QR, 12 minori e 661 audit. Nessun import o merge eseguito su dati
reali. Le nuove colonne/tabelle rispondono HTTP 200; la RPC rifiuta un attore
non autorizzato con `42501`. RLS attiva sulle due tabelle; tre RPC riservate
al servizio, senza esecuzione anonima o authenticated. Verifiche locali:
186 test, SQL su database temporaneo vuoto, browser desktop/mobile, lint,
typecheck e build sia webpack sia con il comando production.
