# Caricamento dei comandi condiviso

Dal 25 settembre 2026 l’overlay approvato nella dashboard Manager è attivo in
tutto il sito. `ButtonProgress` è l’unica animazione; `ProgressButton`,
`PendingSubmitButton`, `PendingLink` e `PendingDownload` condividono questo
componente. Non occorre un provider né un layout specifico del Manager.
Le modali operative continuano a riutilizzare gli stessi componenti.

L’overlay usa il colore corrente al 25%, parte rapidamente e continua ad
avanzare oltre il 90%, sempre più lentamente e senza una soglia di arresto.
Il completamento dipende dalla fine dell’operazione reale; un errore lo
nasconde senza raggiungere il 100%. È un avanzamento stimato, non una misura
inviata dal server. Timings approvati conservati: aggiornamento ogni 50 ms,
partenza esponenziale con costante 500 ms, coda inversa alla radice del tempo
(scala 6 secondi), transizione 100 ms e completamento visibile 130 ms.
Indicativamente: 94% a 10 secondi, 97% a un minuto e circa 99% a cinque minuti.
`prefers-reduced-motion` conserva un indicatore statico.

I controlli occupati mantengono i propri blocchi contro gli invii ripetuti e
gli annunci accessibili. Il selettore lingua, l’export capogruppo, il modulo
pubblico/link di gruppo e la conferma personale usano lo stesso overlay.
I pulsanti con azioni che restituiscono errori li passano a `progressError`.
Il cursore CSS di attesa è stato rimosso; rimangono gli indicatori autonomi
per il caricamento dei risultati dei filtri, fuori dai pulsanti.

## Conteggi fermi

Il vecchio `LinkStatus` aggiungeva un elemento invisibile ma presente nel
layout flex: con `justify-between` diventava un terzo elemento e spostava
il numero delle persone. Ora l’intero elemento di stato è `sr-only`, fuori
dal flusso, come l’overlay assoluto. Nessuna modifica ai conteggi o alle
fasce d’età.

## Verifica

- `npm ci`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`
  nella copia del rilascio, senza le modifiche parallele estranee.
- `node tests/browser/button-progress.mjs http://localhost:3108`: operazioni
  reali di React/Next con azioni e risposte locali sintetiche, errori, download,
  interruttori esterni, attese lunghe, reinvio rapido, portal, sette lingue,
  mobile e movimento ridotto. Il componente reale delle statistiche è usato
  con soli URL diretti a una pagina locale ritardata: coordinate e dimensioni
  di etichetta e conteggio devono restare uguali prima/durante/dopo.
- `tests/browser/pending-feedback.mjs` conserva il collaudo dei filtri e dei
  controlli condivisi. Il vecchio comando `manager-button-progress.mjs`
  richiama la suite globale.
- `FOCUSED=1 BASE_URL=http://localhost:3108 node tests/browser/self-registration.mjs`
  verifica anche il caricamento della conferma personale nella modale reale,
  con cancellazione simulata: errore recuperabile e navigazione di successo.

Nessuna migration, scrittura su persone reali o email di collaudo.
