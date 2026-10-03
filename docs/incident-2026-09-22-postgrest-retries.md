# Dashboard e modulo indisponibili — 22 settembre 2026

Lo screenshot riportava il boundary «Dati temporaneamente non disponibili».
La sola home rispondeva HTTP 200, mentre le letture effettive fallivano.
I log Vercel correlano `/dashboard/partecipante` a `PGRST003`, con causa
`Timed out acquiring connection from connection pool`. Il modulo pubblico
falliva per lo stesso motivo. La scritta Partecipante nell'header non provava
una perdita del ruolo: anche le query dei ruoli erano in timeout.

## Causa e relazione con la modifica alle lingue

Tutte le dieci connessioni PostgREST 14.6 eseguivano ripetutamente
`review_participant_duplicate`, con attese sui lock delle tabelle operative.
Le transazioni ricominciavano continuamente, quindi l'età della query rimaneva
bassa anche se la richiesta HTTP non terminava. Il controllo sulla versione
dell'anteprima usava `raise serialization_failure` (SQLSTATE 40001) per una
versione ormai obsoleta: il retry non poteva mai renderla valida.

Questo comportamento di PostgREST 14 è documentato da
[Supabase](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).
Il codice era presente nella migration qualità del 5 settembre. Lo stesso
errore applicativo era usato nell'importazione e nella modifica dei figli.

La modifica alle lingue era stata applicata intorno alle 15:30 Europe/Rome.
I primi timeout nel periodo di log esaminato compaiono alle 15:41; la sola
vicinanza temporale non identifica la causa. La migration delle lingue era
committata, senza transazioni residue, e non aveva modificato righe o versioni
dei dati. È stata mantenuta: il guasto osservato era il ciclo delle revisioni.
Non è stato ricostruito quale singola interazione abbia avviato la prima
richiesta obsoleta.

## Ripristino

Alle 16:54:58 Europe/Rome sono state annullate esclusivamente le dieci query
attive della RPC duplicati tramite `pg_cancel_backend`. Le richieste hanno
terminato con errore e liberato il pool; non è stato riavviato il database.
Non sono state rilanciate decisioni di merge o invii email.

`20260922153000_nonretryable_stale_conflicts.sql` sostituisce i tre errori
applicativi con `PT409`, un conflitto terminale HTTP 409. Le definizioni sono
state confrontate con quelle live: l'unica differenza è il codice dell'errore.
Migration e registrazione applicate nella stessa transazione, verificando
l'invarianza dei grant. Nessuna modifica ai dati, alle policy o ai lock.
I gestori dell'app riconoscono PT409 e 40001 e invitano a ricaricare i dati.

## Verifiche

- SQL temporaneo: suite import/merge originale, poi migration e test dei tre
  conflitti PT409; nessuna scrittura parziale, scope e privilegi conservati.
- Chiamata HTTP alla RPC reale con ID sintetici e versione deliberatamente
  incompatibile: HTTP 409, `PT409`, `Review stale` in 182 ms. La funzione
  interrompe prima di leggere i record indicati o effettuare scritture.
  Lettura API successiva HTTP 200.
- Home, login e registrazione HTTP 200 in circa 0,1–0,3 secondi dopo ripristino.
- Query in transazione read-only con ruolo SQL authenticated del proprietario:
  ruolo e iscrizione corrente presenti e leggibili. Nessuna nuova sessione
  creata, nessuna email di accesso inviata.
- 424 test applicativi, lint, build production e typecheck superati nella copia
  pulita con dipendenze installate dal lockfile, inclusi i mapper conflitti.
- Chrome: modulo pubblico caricato; accesso a dashboard correttamente rimandato
  al login in assenza di sessione. Nessun invio del modulo.

Non è stato eseguito un merge reale né un nuovo invio di iscrizione. Il browser
Safari osservato dopo il ripristino mostrava la home senza sessione; il controllo
della dashboard autenticata si basa sulle query RLS e sui log, non su un nuovo
accesso interattivo. Le operazioni fallite durante il disservizio richiedono
verifica dell'esito prima di essere ripetute.
