# Scuole: conferma delle quantità — 26 ottobre 2026

Segnalazione: impossibile premere la conferma dopo aver indicato le quantità.
La UI disabilitava il pulsante per quantità mancanti, fuori limite o totale zero,
senza mostrare i limiti né spiegare il motivo. Lettura aggregata di produzione:
una delle cinque prenotazioni attive ha 20 studenti e 1 accompagnatore per il
Forum, mentre la scuola ha 20 studenti e 2 accompagnatori. Nessun dato modificato.
Il flusso con quantità ammesse è risultato funzionante anche prima della modifica.

La finestra ora espone i massimi canonici, richiede esplicitamente 0 per una
categoria assente e spiega gli errori. Il pulsante resta cliccabile per attivare
la validazione nativa dei campi. La guardia sul submit continua a impedire invii
non validi, incluso il totale zero. Nessun aumento delle quote, migration o
scrittura operativa in produzione.

Regressione browser sui componenti originali, dati sintetici e PostgreSQL locale:
campi vuoti, accompagnatori oltre limite e totale zero non scrivono ingressi;
correzione a 8 studenti e 1 accompagnatore registra esattamente evento e Forum.
Verificati anche QR, autorizzazioni, replay e concorrenza del flusso scuole.
Test generali, TypeScript e build inizialmente bloccati dalla dipendenza locale
pdfkit mancante: ripristino delle dipendenze dal lockfile prima della verifica finale.

Verifica finale in copia isolata: 1.163 test, TypeScript e build production
passati; lint mirato e browser/SQL passati. Lockfile normalizzato soltanto nella
copia temporanea per compatibilità con npm locale; nessuna modifica alle dipendenze
del repository. Integrati i due commit main già pubblicati sulla finestra della coda.

L’utente precisa 16 studenti e 4 accompagnatori: tutte le cinque prenotazioni
attive prevedono meno di 4 accompagnatori. La correzione UI non autorizza quantità
oltre prenotazione; richiesti scuola e Forum per risolvere il dato specifico.

## Risoluzione del caso Forum 1

L’utente ha identificato il Forum 1, con una sola prenotazione scuola attiva.
Lettura canonica: prenotazione generale e Forum entrambe da 18 studenti e
3 accompagnatori. Adeguate atomicamente a 16 studenti e 4 accompagnatori
indicati dall’utente (21 → 20 posti), con lock su scuola, Forum e settore,
guardie su stato/valori precedenti/evento corrente/assenza ingressi,
validazione canonica di capienza e sovrapposizioni e audit
`school_booking.operational_count_correction` con attore manutenzione esplicito.
Nessuna identità operatore impersonata. QR e stato email confrontati e invariati.
Verifica dopo commit DB: 16/4 sia nella scuola sia nella prenotazione Forum,
zero ingressi attivi. L’operatore deve rileggere il QR e confermare l’arrivo.

Backup completo remoto custom prima della correzione, accesso 0600,
28.326.074 byte; elenco e decodifica integrale pg_restore verificati.
SHA-256: `f1bdd79d81b2c0e3fa04170777b4e6bb5e35e9f7c3bd86db64325f93993f67db`.

Codice `a911f19` produzione READY, alias del dominio verificato e login HTTP 200.
Commit e push eseguiti su richiesta; nessuna modifica allo schema database.

## Nuova regola richiesta: registrare i numeri effettivi anche se diversi

L’utente ha chiarito che la conferma deve essere possibile anche con quantità
superiori a quelle prenotate. Superata quindi la necessità di adeguare la
prenotazione per consentire il check-in. Il precedente adeguamento puntuale
resta nello storico; questa modifica non riscrive prenotazioni o ingressi.

La UI mostra quantità prenotate e avviso non bloccante di differenza. I campi
accettano interi 0–1000 studenti / 0–100 accompagnatori, totale positivo. La
migration 20261026110000 modifica le sole guardie quantitative nelle RPC Forum
ed evento e restituisce i conteggi prenotati Forum come riferimento. Non cambia
firma, ACL, ruolo, incarico, QR, prenotazione obbligatoria, capienza fisica di
settore/sala, revisione, audit, idempotenza, annullamenti o ricevute.
Il primo ingresso congiunto registra i numeri effettivi in evento e Forum;
l’evento già presente non viene modificato dalle successive operazioni Forum.

Verifiche: 1.163 test, TypeScript e build da installazione isolata; lint mirato;
SQL con quantità sopra prenotazione, correzione sopra conteggi evento,
capienza insufficiente senza scritture, replay, concorrenza e prenotazioni
invariate. Browser originale mobile/desktop: prenotati 10+2, confermati 16+4,
API reale contro PostgreSQL temporaneo e lettura dell’ingresso generale.
Il runner storico `run-reception-checks.mjs` si ferma su una migration
preesistente con LOCK TABLE fuori transazione; la verifica delle RPC aggiornate
è stata completata nel runner Forum corrente, inclusa accoglienza generale.

Backup completo remoto custom 29.149.311 byte, modo 0600, pg_restore verificato;
SHA-256 `619fc4f20c6d656af68f5e67172451d511b560c6d9f26d8913130623ec8d9225`.
