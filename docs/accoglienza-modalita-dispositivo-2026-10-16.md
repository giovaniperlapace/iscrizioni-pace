# Accoglienza: computer e telefono — 16 ottobre 2026

## Comportamento

La dashboard presenta due scelte esplicite prima dell’incarico. Computer usa
lo scanner USB e conserva stampa delle etichette individuali e del gruppo,
selezione dei destinatari, contatori e badge completo. Telefono usa la
fotocamera e offre solo consultazione e gestione delle presenze: non monta
pannelli di stampa, non legge la coda etichette e non mostra il collegamento
al collaudo stampante. Entrambe conservano l’inserimento manuale del codice.

La scelta è una modalità operativa, non un rilevamento del dispositivo o
un nuovo confine di autorizzazione. Non è salvata in localStorage né dedotta
dalla larghezza della finestra. Gli account e le azioni restano protetti dai
controlli Admin già presenti; le altre dashboard e i servizi di stampa non
sono modificati.

All’ingresso evento, anche da fotocamera, la lettura apre la scheda senza
registrare ingressi. Registra presenze e Modifica presenze conservano
selezione, conferma, revisioni e annullamento. Il nuovo QR viene letto solo
dopo Passa al prossimo codice; i fotogrammi ricevuti durante la scheda non
consumano il blocco anti-ripetizione del prossimo codice. I flussi degli altri
incarichi mantengono le proprie regole di registrazione e consultazione.

Cambia modalità è indisponibile durante selezioni, richieste, stampa, esiti
incerti e sessioni bloccate. A operazione conclusa smonta la console,
rilascia la fotocamera e cancella scheda e cronologia in memoria; le presenze
salvate restano persistenti. La modalità si conserva al cambio incarico.

## Verifiche

- 895 test applicativi superati, compresi controlli Admin e sessione presenze.
- Browser sintetico con componenti originali: scelta modalità, ingresso e
  annullamento singolo, registrazione selettiva e correzione gruppo,
  letture ignorate durante la scheda, uscita senza modifiche, assenza di
  pannelli/iframe/richieste di stampa da telefono, rilascio fotocamera,
  ritorno a USB e stampa simulata dal computer.
- Fotocamera negata e codice manuale; risposta incerta in lettura/scrittura,
  ripetizione dello stesso comando e blocco del cambio modalità; revoca
  accesso e assenza di errori JavaScript.
- Regressioni USB e fotocamera precedenti superate, incluse selezione stampa
  gruppo, doppio clic, minori/scuole, errori, correzioni, focus e layout mobile.
- Lint, TypeScript e build production Webpack superati in copia isolata senza
  credenziali applicative; verifica visiva delle schermate desktop e telefono
  senza sovrapposizioni o scorrimento orizzontale.

Test dedicato: `tests/browser/reception-device-modes.mjs`, usando la fixture
sintetica `tests/browser/usb-reception-fixture.tsx`. Gli script browser creano
una route temporanea solo nella copia di collaudo e la rimuovono al termine.

Nessuna migration, modifica a dati reali, email, stampa fisica, configurazione
hardware o pubblicazione eseguita. Le prove fisiche restano sospese.

## Rilascio autorizzato

L’utente autorizza commit e push su main tramite il deployment Git Vercel.
Il rilascio include solo la distinzione computer/telefono già collaudata;
le successive modifiche di semplificazione dell’Accoglienza rimangono locali.
Nessuna migration necessaria.

Verifica pre-rilascio sull’attuale main: 898 test, lint, TypeScript, build
production Webpack e collaudo browser modalità telefono/computer superati.
