# Campagne: filtro settore cerimonia finale — 26 ottobre 2026

Filtro «Settore cerimonia finale» nella platea Partecipanti: Basilica inferiore
arancione, Piazza inferiore viola, Prato Basilica superiore verde. Valore vuoto:
tutti i partecipanti. Filtro combinabile con ricerca, gruppi e altri filtri.
Si applica al settore nominale dell'adulto, come la variabile esistente
`settore_cerimonia_finale`; appartenenza al gruppo e settori dei figli non
attribuiscono implicitamente un settore all'adulto.

La fonte è il registro delle nomine pubblicate, diretto Manager o da riserva
capogruppo: evento corrente, piano finale validato nel nuovo layout, iscrizioni
submitted/confirmed non eliminate, nomine e assegnazioni non revocate.
Escluse bozze, dotazioni di gruppo ancora da abbinare e nomine dei minori.
Lettura paginata integrale, errori bloccanti, nessun fallback a tutti.

Cambiando settore si eliminano le selezioni fuori filtro e si invalidano
anteprima/prova. Il filtro è salvato in `filters_snapshot.closingSector`;
server ricontrolla anteprima, modifica destinatari, prova e avvio invio.
La coda ricontrolla il settore corrente prima di preparare l'invio: spostati o
revocati diventano skipped con motivo leggibile nel report, senza invio né
reinvio implicito. Snapshot senza filtro conservano il comportamento precedente;
i reinvii esistenti copiano già lo snapshot. Recapiti/deleghe invariati.

Nessuna migration, modifica a posti/coda o invio reale. Le email automatiche
dei badge restano disattivate; le campagne mantengono la normale prova e
conferma esplicita dell'operatore. Nessuna campagna creata durante il collaudo.

## Verifiche

- 1.212 test nella working copy, 1.198 nella copia pulita del rilascio da npm ci;
  TypeScript, lint mirato e build production passati.
- Test: 1.005 nomine oltre le pagine da 500, scope evento/piano/adulto, valori
  invalidi, letture fallite, destinatari diretti/delegati, esclusione senza
  posto, revoca/cambio settore prima della coda e compatibilità vecchie campagne.
- Regressioni worker Postmark, rate limit, esiti incerti, allegati personali,
  selezione oltre 1.000 righe e autorizzazioni Manager/Admin passate.
- Query Supabase reale in sola lettura riuscita: zero nomine attive al controllo.
- Browser sul componente originale con quattro destinatari sintetici: tre
  settori e uno senza posto. Seleziona tutti (4), filtro verde (1 selezionato),
  cambio viola (0 selezionati), filtro arancione (solo nome arancione).
  Nessun invio/API di modifica; storico non disponibile nella fixture priva
  di credenziali, limite atteso e distinto dal filtro verificato.
- Review React: dati minimi serializzati, filtro memoizzato, selezione con Set,
  reset di prova/anteprima nel gestore evento, select con label accessibile.

Backup completo verificato prima del rilascio: 32.050.340 byte,
`/root/backups/iscrizioni-pace/production-before-campaign-sector-filter-1793045352175.dump`.
SHA-256: `be48963696dd5c1c1023324854ad27dc7355ee7cb3ab17c2154e0cf84ccfff2d`.
Rilascio limitato al filtro campagne; promemoria Forum locali esclusi.
