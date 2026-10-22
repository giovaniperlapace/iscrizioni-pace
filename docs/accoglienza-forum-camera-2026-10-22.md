# Accoglienza Forum: esiti nella fotocamera — 22 ottobre 2026

Su ulteriore richiesta dell’utente, la console fotocamera mostra sul video solo
una fascia breve con esito/rimando alla scheda. Al riconoscimento l’anteprima si
riduce gradualmente a 10rem e la scheda completa appare subito sotto: nome,
prenotazione, selezione persone e conferma non coprono più il video. La scheda
entra con traslazione di 12px e dissolvenza in 300ms, con bordo evidenziato.
Dopo il movimento, lo scorrimento `nearest` porta in vista la scheda soltanto
quanto necessario. Con movimento ridotto richiesto dal sistema, ingresso e
scorrimento sono immediati. Nessun focus viene sottratto all’operatore.
La modalità manuale e quella USB mantengono il comportamento precedente.

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

## Verifica della scheda separata dal video

1.056 test, build con TypeScript, lint dei file modificati e collaudo completo
browser desktop/mobile superati. Verificata geometricamente la scheda sotto
il video e la fascia di esito inferiore a 80px; screenshot mobile ispezionato.
Restano verificati stream live, salvataggio esplicito, contatori, dissolvenza,
riarmo senza rilettura del QR fermo, revoche e assenza di chiamate operative
nel collaudo. Nessuna migration o scrittura operativa remota.
