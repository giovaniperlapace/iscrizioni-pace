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

## Revisione finale: riquadro fisso, colori ed ingresso comunque

Su nuova richiesta il riquadro mantiene dimensioni fisse: superata la riduzione
a 10rem descritta sopra. La scheda resta sotto il video, con animazione di
comparsa e dissolvenza dopo il salvataggio. Legenda espandibile in tutti gli
incarichi: giallo per Forum sbagliato e accoglienza generale mancante; arancione
per assenza di prenotazione o biglietto cerimonia; rosso per QR invalido e
altri errori bloccanti; verde per verifiche e ingressi riusciti. Il Forum
sbagliato usa i riferimenti strutturati della risposta, non il testo del messaggio.

Per la mancanza della sola accoglienza generale compare «Segna l’ingresso
comunque». Il comando riusa la RPC canonica con motivo `event_entry_override`,
ammesso soltanto per `panel_entry`/`enter`. La selezione nominale adulti/minori
resta esplicita; per le scuole rimangono le quantità nei limiti prenotati.
L’ingresso generale non viene creato: la deroga riguarda soltanto il Forum.
La RPC ricontrolla sotto lock incarico, evento, token, iscrizione, prenotazione,
capienza e persone/quantità. Motivo incluso nel fingerprint e nell’audit;
retry incerto identico, nessuna deroga su annullamento o correzione.

Verificati 1.059 test applicativi, TypeScript/build e lint dei file modificati.
SQL temporaneo: ingresso normale rifiutato senza accoglienza generale, deroga
esplicita con minore e scuola, replay, revoca/assenza incarico, rifiuto di
quantità scolastiche eccedenti e conservazione dell’assenza generale.
Browser originale desktop/mobile con API e DB temporanei: frame di altezza
invariata, colori, pulsante esplicito, contatori, dissolvenza e QR fermo.
Collaudo fittizio aggiornato anche nel foglio QR scaricabile; nessuna chiamata
operativa durante la prova e nessuna presenza reale registrata.

Migration `20261022210000` applicata e registrata atomicamente in produzione.
Backup completo prima dell’applicazione, permessi 600, indice e decodifica
integrale verificati:
`/root/backups/iscrizioni-pace/production-before-reception-override-1792701740.dump`
(20.130.305 byte), SHA-256
`1dc3ee3f7a064f8815cd2fa1cf9b2d6e66b531967b8ddc363ada88c08652b643`.
La copia di rilascio con guardie ha verificato il corpo canonico precedente
(MD5 `57e7529ce7a7b0a4e1d9ac97e1eb67bb`) e confrontato in una transazione
REPEATABLE READ tutti i dati: 68 tabelle/204.006 righe invariate; metadati,
owner e ACL di 225 funzioni invariati e nessun altro corpo modificato.

## Etichette riferite agli ingressi

Per la dashboard Forum/cerimonie, incluse modalità manuale e fotocamera,
collaudo, selezione famiglie e modali scuola: «Ingresso confermato»,
«Conferma ingresso», «Rimuovi ingresso», «Modifica ingressi» e relativi plurali.
I componenti condivisi ricevono una scelta esplicita di terminologia, così
l'accoglienza generale conserva i testi precedenti. I messaggi contenenti
nomi reali dei Forum non vengono riscritti. Presenze dichiarate e relative
regole restano concetti distinti dall’ingresso. Nessuna migration o variazione
operativa; solo testi. Test esistenti e collaudo browser aggiornati alle label,
compresa apertura/annullamento della finestra «Rimuovi ingresso».

Su ulteriore richiesta rimossa la legenda esplicativa dalla console,
conservando i colori dei messaggi e i relativi significati.


## Incarico e statistiche integrati nello scanner

Nome dell’incarico e contatori subito sotto, nella banda superiore del
riquadro scanner con fondo nel colore tenue del sito. La banda rimane
visibile anche quando il modulo manuale/USB viene nascosto dal risultato.
Pulsanti Cambia modalità e Cambia incarico sotto il titolo della dashboard:
stile secondario del sito, affiancati su desktop e a tutta larghezza su mobile.
Blocchi durante operazioni pendenti e aggiornamento conteggi conservati.
La prova con QR fittizi resta accessibile in fondo alla pagina; la rimozione
è rimandata a una successiva richiesta prima dell’evento.

Verifica di ordine e integrazione dei contatori aggiunta al collaudo browser
del flusso originale; dati sintetici e nessuna scrittura operativa reale.


### Precisazione: banda interna della fotocamera

Su indicazione visiva dell’utente, nome e statistiche sono ora sovrapposti
alla banda scura superiore interna dell’anteprima, non sopra la fotocamera.
Dimensioni del video fisse; intestazione indipendente dalla dissolvenza
dell’esito. Testo a capo per titoli lunghi e banda scorribile oltre il limite
di altezza, senza coprire il centro della scansione. Rimosso l’avviso
sull’occupazione della sala. Aggiorna conteggi è un pulsante a icona con
nome accessibile e tooltip; modalità manuale/USB conserva l’intestazione
compatta esterna. Il collaudo verifica posizione interna, altezza, nome,
contatori e aggiornamento dopo conferma senza riavviare la camera.
