# Partecipazione e stampa: due azioni sulla stessa selezione — 16 ottobre 2026

L’utente corregge il flusso: conferma della partecipazione e stampa devono stare
nello stesso punto, ma essere due pulsanti indipendenti che utilizzano la stessa
persona o selezione multipla. Superato il precedente comando combinato.

## Gestione partecipanti

Sotto nome e codice resta soltanto lo stato, non più un pulsante di modifica:
**Partecipazione non confermata** oppure **Partecipazione confermata**, con data.
L’errore di lettura resta distinto da una partecipazione non confermata.

Nella scheda partecipante, all’inizio del riquadro QR, sono presenti **Conferma
partecipazione** e **Stampa etichetta QR**. Per il singolo la conferma richiede un
clic, senza una nuova modale; il riscontro verde con spunta arriva dalla risposta
del server. Il riepilogo nell’elenco si aggiorna dopo il salvataggio.

In presenza di minori, lo stesso elenco alimenta entrambi i comandi. Confermare
non stampa e stampare non conferma; la selezione rimane dopo ciascuna operazione.
I minori utilizzano il QR del genitore, senza registrare il genitore quando non
è selezionato. Correzione e annullamento restano azioni esplicite separate.

Il riquadro verifica dal codice pubblico che il soggetto adulto corrisponda alla
registrazione aperta. Nessuna azione prima della verifica; Manager e lettori
mantengono la consultazione. Iscrizioni non operative escluse dalla conferma.
La chiusura ordinaria della scheda è bloccata durante operazioni e risultati
incerti, con avviso anche prima di abbandonare la pagina.

## Accoglienza

Rimosso **Registra presenze e stampa QR**. Restano due pulsanti distinti sullo
stesso elenco: **Conferma partecipazione** e **Stampa i QR del gruppo** (oppure
**Stampa etichetta QR** per il singolo/famiglia). Il telefono continua a offrire
soltanto le presenze; la stampa resta nella modalità computer.

Il componente delle azioni è condiviso con la scheda partecipante. Selezione
vuota iniziale per famiglie/gruppi, nessuna presenza alla sola lettura del QR,
conteggi di stampa, deduplicazione del QR genitore, blocco dei doppi clic,
revisioni, audit e retry della stessa richiesta conservati. Un’incertezza della
presenza richiede verifica, senza stampare automaticamente dopo il retry.

## Verifiche

- 898 test applicativi; TypeScript e lint.
- Browser sintetico sul riquadro partecipante: nessuna modale per confermare
  il singolo, nessun pulsante sotto il nome, aggiornamento dello stato, stampa
  indipendente, minore selettivo e QR genitore, errore/ristampa, conflitti,
  retry identico, blocco chiusura, identità errata e revoca.
- Browser sintetico Accoglienza USB e telefono: selezione comune persistente,
  assenza del comando combinato, nessuna stampa alla conferma e nessuna
  conferma alla stampa, correzioni, famiglie/gruppi, scuole, layout mobile,
  rilascio fotocamera e fallback manuale.
- Prove con renderer originale e stampa simulata; nessun dato reale modificato,
  nessuna email, stampa fisica, nuova migration o modifica hardware.

Rilascio autorizzato tramite commit/push su main e normale deployment Git Vercel.
Le modifiche parallele alla stabilità del QR gruppo e i verbali hardware sono
esclusi dal commit di questa richiesta.

Build production Webpack in copia pulita con npm ci, lint completo e TypeScript
superati. Superate anche le regressioni SQL/concorrenza su PostgreSQL temporaneo,
usando le migration già pubblicate e senza includere quelle in lavorazione
nell’altra conversazione. Le route browser sintetiche sono state rimosse prima
della build.
