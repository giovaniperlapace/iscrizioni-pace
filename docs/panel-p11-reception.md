# P11 — verifica QR e presenze effettive

Implementazione locale del 2026-09-12 su `codex/panel-p0-p10`, base `99b8bc3`.
Fetch iniziale: branch e upstream allineati, nessun commit di `origin/main`
(`0bc2997`) ancora da integrare. La cartella `output/` preesistente non è stata
modificata; nessun pull necessario. Nella richiesta successiva l'utente ha
espressamente autorizzato migration staging, commit e push del branch panel.
Nessuna modifica production o invio email.

Migration applicata e verificata nello staging il 2026-09-12. Resta il collaudo
funzionale autenticato della preview prima della chiusura della milestone.
Il passaggio a P12 è separato.

## Flusso disponibile

Dashboard accoglienza → codice partecipante esatto o contenuto opaco del QR →
server action → verifica della sessione e dell'evento corrente → RPC atomica →
risposta minima → scelta e conferma delle presenze.

La console manuale rende il backend collaudabile prima della fotocamera P12:

- un codice valido mostra nome, codice pubblico e stato di presenza; per il
  nucleo mostra anche i nomi dei minori, senza età o date di nascita;
- nessun componente assente viene selezionato automaticamente; `Registra
  ingresso` aggiunge solo le persone selezionate e conserva gli altri ingressi;
- `Correggi presenze` sostituisce esplicitamente l'insieme dei presenti della
  famiglia; `Annulla ingresso` annulla soltanto i componenti selezionati;
- scuole: nome scuola, classe, quantità previste e quantità effettive separate
  per studenti/accompagnatori; il primo ingresso richiede quantità esplicite;
- una seconda registrazione di ingresso non cambia quantità o timestamp già
  presenti: per modificarli occorre usare la correzione;
- correzione e annullamento richiedono una conferma visibile. Il comando include
  la revisione letta: un conflitto impone una nuova verifica;
- l'esito incerto mantiene in memoria l'intero comando e il suo UUID, blocca
  la modifica dei campi e permette di riprovare esattamente la stessa richiesta;
- un codice non valido elimina dalla vista l'identità della verifica precedente.

Interfaccia interna in italiano, coerente con il backoffice. Nessuna modifica
alle sette lingue del programma pubblico, alle email o all'area partecipante.

## Schema e compatibilità

Migration unica: `supabase/migrations/20260912150000_reception_check_ins.sql`.
La fonte resta `check_ins`, estesa senza una seconda tabella di presenze:

- adulto: `registration_id`, `child_id = null`;
- minore: `registration_id` + `child_id`, con FK composta alla famiglia;
- scuola: `school_booking_id`, senza `registration_id`, e conteggi aggregati;
- indici univoci distinti per adulto, minore e scuola nell'evento. Gli indici
  adulti/minori conservano anche lo scope dei momenti legacy;
- `cancelled_at` mantiene la riga storica, `updated_at`/`updated_by` tracciano
  l'ultima variazione. Un nuovo ingresso esplicito può riattivare una presenza
  annullata; una vecchia richiesta già elaborata non può farlo;
- `check_in_revision` su iscrizioni e prenotazioni protegge le correzioni;
- `check_in_requests` conserva UUID richiesta, attore, evento, timestamp e digest
  del comando. Non conserva il token, il corpo della richiesta o nomi.

Le righe legacy restano presenze del solo adulto; non si inventano presenze dei
minori. I momenti legacy restano conservati, ma la nuova RPC registra solo
l'ingresso generale all'evento. Non cambia intenzioni giornaliere, panel,
prenotazioni, capienze, QR o stato dell'iscrizione.

Un minore con storia di ingresso, anche annullato, non può essere cancellato
fisicamente o sostituito con un'altra identità. Il salvataggio della stessa
famiglia con `replace_owned_registration_children` diventa un no-op, conservando
gli ID; modificare quel nucleo richiede una revisione operativa. Le famiglie
senza storia dei minori conservano il comportamento precedente. Questo limite
è intenzionale: il vecchio delete/insert non deve cancellare o riassegnare una
presenza. Anche le modifiche dirette dell'identità del minore sono protette.

## Autorizzazione, verifica e audit

`executeReceptionCommand` autentica con `auth.getUser`, legge solo i ruoli
dell'utente verificato e ricava l'evento corrente. Il client non può indicare
attore, evento, iscrizione o prenotazione da cercare: può inviare solo token
opaco o codice pubblico esatto. Gli ID dei componenti sono ammessi nella
selezione, ma la RPC ne verifica l'appartenenza alla famiglia risolta.

`reception_check_in` è SECURITY INVOKER, EXECUTE solo `service_role`. Ripete la
verifica dell'admin globale o del ruolo manager/accoglienza nell'evento e tiene
i lock fino al commit. Manager viewer, capogruppo, partecipante, anonimo e
operatore di altro evento non possono usarla. I privilegi diretti di scrittura
su `check_ins` degli utenti authenticated sono rimossi: non si può saltare
audit, idempotenza o verifica QR. Accoglienza riceve soltanto la proiezione RPC,
non letture dirette di QR, check-in, contatti o schede. Manager/viewer e gli
scope di lettura personali già previsti restano distinti.

I QR sono SHA-256 sul server prima dell'RPC. Viene accettato soltanto l'ultimo
token della registrazione/prenotazione, attivo, non revocato e non scaduto;
collisioni fra namespace individuale/scuola sono rifiutate. Token sconosciuto,
evento errato, iscrizione eliminata/annullata/draft/waitlisted e prenotazione
scuola non operativa restituiscono lo stesso `{status: "invalid"}`, senza
identità o dettagli. Il codice partecipante è un fallback manuale autorizzato:
non richiede la disponibilità di un QR, ma richiede un'iscrizione operativa.

Ogni verifica sintatticamente valida e ogni comando elaborato produce audit
`reception.*` con evento, attore, timestamp, fonte `qr_scan`/`manual`, soggetto
tecnico ed esito. Le mutazioni conservano stato prima/dopo con ID tecnici,
timestamp e quantità, senza nomi, token, contatti o note libere. I motivi sono
codici chiusi (`selection_error`, `count_error`, `entry_cancelled`). Gli errori
RPC non vengono stampati né restituiti al browser. Un errore audit annulla
anche check-in, revisione e registro di idempotenza nella stessa transazione.

## Verifiche eseguite

- Dipendenze installate coerenti col lockfile: Next 16.3.0, React 19.2.8.
- `npm run lint`, `npm run typecheck`, `npm test`: 330 test verdi, inclusi 8
  nuovi test di input, identità server, ruoli, proiezione e gestione errori.
- `node tests/sql/run-reception-checks.mjs`: PostgreSQL 17 temporaneo, tutte le
  migration dello schema reale. Esclusa soltanto la migration dati storica
  `20260813170000` con prerequisiti assenti nella fixture, come nello staging.
  Il runner non legge env applicativi né URL remoti; richiede binari PostgreSQL
  locali (`P11_PG_BIN` opzionale). Il cluster è rimosso al termine.
- SQL: valido/sconosciuto/revocato/scaduto/vecchio token, eventi estranei,
  registrazioni non operative, famiglia parziale, minore estraneo, scuole,
  quantità, collisione namespace, annullamento della prenotazione dopo verifica,
  fallback codice, conservazione integrale di un check-in legacy pre-migration,
  storia minori, RLS e privilegi per tutti i ruoli;
  audit forzatamente fallito con rollback completo.
- Concorrenza reale su connessioni separate: 8 ingressi famiglia e 8 scuola,
  nessun duplicato; 8 copie dello stesso UUID → 1 salvataggio + 7 replay;
  due correzioni della stessa revisione → 1 salvataggio + 1 conflitto.
- `node tests/browser/reception.mjs http://localhost:3111`: componente reale
  con azione simulata e soli dati sintetici, desktop e 390 px. Selezione famiglia,
  correzione/annullamento, conferma, codice invalido, retry con UUID conservato,
  conflitto e quantità scuola. Nessun errore browser o overflow orizzontale.
  La route temporanea della fixture viene rimossa. Persistenza/RLS/concorrenza
  sono verificate separatamente dal runner SQL; questa prova non equivale a
  una sessione Supabase autenticata end-to-end sullo staging.
- Build ottimizzata con `npm run build:staging` (comprende `staging:verify`),
  configurazione staging, nessun deployment.

## Passo successivo e limiti

Applicata e registrata il 2026-09-12 esclusivamente allo staging
`supabase-db-jiio6ou5wzmma2xwas53cf1d`, tramite il runner previsto dal progetto.
Una copia temporanea della migration, con i soli BEGIN/COMMIT esterni rimossi,
ha mantenuto DDL e registrazione nella transazione unica `psql -1` del runner;
aggiunti limiti locali di attesa lock/esecuzione. Il file canonico non è stato
modificato. SHA-256 canonico:
`5df58950736327e9e9e76399c99ee42071ca7e6d799c83800d05e4d90d87f8fc`.

Evidenze del rilascio SQL:

- schema e privilegi pre-migration salvati in
  `/tmp/pace-p11-release/schema-before.sql` (directory privata locale);
- conteggi/hash di tutte le colonne preesistenti invariati su 41 tabelle
  pubbliche, controllati dopo migration e prova con rollback;
- i corpi delle cinque funzioni definite dalla migration coincidono esattamente
  con il file locale; registrazione `20260912150000:reception_check_ins` presente;
- EXECUTE RPC solo service_role e scrittura diretta authenticated negata;
- PostgREST service role: RPC risolta e richiesta senza attore correttamente
  rifiutata (403/42501). Anonimo rifiutato (401/42501). Il collegamento HTTPS
  ha usato l'IP staging verificato con SNI e validazione certificato, senza
  alterare il DNS globale;
- `tests/sql/reception-staging-rollback-check.sql`: famiglia e minore della
  fixture panel, scuola sintetica, verifica/ingresso/retry/correzione/conflitto/
  annullamento/audit. Intenzioni giornaliere e panel conservati. Il QR sintetico
  e il ruolo temporaneo sull'account di test, come tutte le scritture del
  collaudo, sono stati annullati dal rollback. Nessun nuovo account o email.

Commit e push sul branch panel sono autorizzati e seguono l'esito positivo
SQL. Il collaudo browser autenticato sulla preview rimane la revisione
funzionale prima di P12. Non applicare questa migration a production senza
una futura richiesta esplicita.

Non eliminare il registro di idempotenza mentre l'evento è operativo. Il retry
nella console sopravvive alla risposta incerta, non al ricaricamento della
pagina: dopo un reload verificare nuovamente il codice prima di operare.
Correzioni con quantità scuola oltre il prenotato sono rifiutate; adeguare prima
la prenotazione con il backoffice autorizzato. Un soggetto annullato/eliminato
o con QR revocato non torna valido per il solo fatto di avere una presenza
storica. Le presenze già registrate restano conservate, non sono cancellate
automaticamente dai cambi di stato delle prenotazioni.

Restano P12 fotocamera/uso sui dispositivi reali, P13 statistiche effettive e
l'eventuale accesso panel separatamente approvato, P14–P15 stampanti/etichette,
P16 prova sul campo e runbook. Nessun check-in offline o riconciliazione
automatica della storia famiglia è introdotto qui.
