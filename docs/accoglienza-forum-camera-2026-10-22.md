# Accoglienza Forum: esiti nella fotocamera — 22 ottobre 2026

La console condivisa in modalità fotocamera mantiene visibile il video dopo la
lettura. Esiti, identità e comandi sono sovrapposti alla parte inferiore del
riquadro; gli elenchi lunghi scorrono dentro il riquadro. Nessun focus automatico
sposta la pagina alla ricezione della scheda. La modalità manuale e quella USB
mantengono la scheda separata.

La prenotazione valida mostra «Iscrizione al Forum verificata» in verde.
«Segna entrata» registra la presenza soltanto su azione esplicita; minori e
famiglie mantengono la selezione nominale. Il video rimane attivo durante
ispezione, conferma e salvataggio. Su successiva richiesta dell’utente, «Scansiona un altro QR» è rimosso dalla
fotocamera. Dopo il salvataggio la scheda sfuma in due secondi, con comandi
inerti, poi la lettura riprende automaticamente. Il latch è conservato per
non riaprire subito lo stesso QR ancora inquadrato. Prima della conferma un
QR differente può sostituire la scheda; letture durante operazioni, selezioni
modali o esiti incerti restano bloccate. Errori, retry della stessa
richiesta e revoca dell'incarico riusano la sessione canonica.

Ogni incarico mostra Iscritti (Assegnatari per le cerimonie) ed Entrati. La
rilettura esistente dopo salvataggio e rimozione aggiorna i conteggi dal server,
senza incrementi ottimistici o polling. Gli ingressi non sono occupazione attuale.

## Verifica

- 1.056 test applicativi superati.
- TypeScript e build production superati.
- Lint dei cinque file applicativi/test modificati superato. Il lint globale
  rimane bloccato da tre `no-explicit-any` e un warning preesistenti in
  `tests/ceremony-navigation.test.mts`, estraneo alla modifica.
- Browser Chrome con sorgenti originali, API locali e PostgreSQL temporaneo:
  desktop/mobile, errore nel riquadro, iscrizione verde, nessun ingresso alla
  sola lettura, stream ancora live prima/dopo il salvataggio senza riavvio,
  incremento Entrati dopo conferma, cambio incarico e revoca.
- Collaudo con QR fittizi: stessa UI, download e reset; zero chiamate operative.
  Aggiornata l'aspettativa cerimonie al settore, coerentemente con il modello
  corrente che non presenta più fila/posto.
- Controllo visuale degli screenshot mobile: esito e comandi nel riquadro,
  nessun overflow orizzontale.

Nessuna migration, presenza remota, invio o stampa fisica. Commit e push su
`main` autorizzati dall’utente dopo il collaudo. Lo stato del deployment
non è verificato in questo verbale.

## Verifica della dissolvenza

Ripetuti con successo 1.056 test, TypeScript, build e collaudo browser completo.
Il browser verifica opacità intermedia, rimozione automatica della scheda,
stream ancora live senza riavvio e mancata riapertura del QR fermo per ulteriori
1,2 secondi. Lint dei file modificati superato. Nessuna operazione remota di prova.
