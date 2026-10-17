# Iscritti: pagine da 100 — 17 ottobre 2026

La tabella condivisa Admin/Manager/Viewer mostra al massimo 100 iscrizioni
per pagina. Filtri espliciti (Invio/Cerca), vista Senza gruppo e ordinamento
si applicano all'intero risultato autorizzato prima della suddivisione.
I minori restano sotto il genitore e non vengono separati su altre pagine.

## Comportamento

- Precedente, Successiva e selezione diretta della pagina sopra e sotto la
  tabella; intervallo visibile e totale del risultato sempre indicati.
- `participantPage` nell'URL conserva filtri applicati, vista, colonne,
  ordinamento e modalità del menu. Cronologia, ricaricamento e link diretti
  ripristinano la pagina. L'apertura/chiusura della scheda e i percorsi di
  ritorno dai salvataggi conservano questo parametro.
- I cambi pagina usano la cronologia locale e lo snapshot già caricato:
  nessuna nuova richiesta RSC e nessun invio dei filtri ancora in bozza.
  Il focus torna alla tabella; i comandi si disabilitano durante salvataggi
  rapidi o operazioni di accoglienza bloccanti.
- Cerca, Invio, Azzera filtri, cambio ordinamento e cambio vista ripartono
  dalla prima pagina. Cambiare le sole colonne mantiene la pagina.
- Pagine non valide tornano alla prima; una pagina oltre l'ultimo risultato
  mostra l'ultima disponibile, anche quando il risultato si riduce dopo
  un aggiornamento. Un elenco vuoto mostra 0–0 di 0 senza pagine navigabili.
- Conteggi iscrizioni/minori e filtri statistici restano globali sul risultato.
  L'export rimuove `participantPage` e continua a esportare tutti gli iscritti
  filtrati. Anche il loader dell'export ignora una pagina ricevuta direttamente.

## Prestazioni e limiti

La modifica limita il rendering iniziale e successivo alle 100 righe visibili,
comprese le relative sottoscrizioni agli indicatori di presenza. Nella fixture
da 1.203 iscrizioni vengono montate 100 righe anziché 1.203 (circa il 92% in
meno). Non è una misura del tempo di risposta del sito pubblicato.

Il caricamento server e lo snapshot trasmesso al browser restano completi.
La modifica alleggerisce il rendering e rende locale il cambio pagina, ma
non riduce il numero di righe lette dal database né il volume dello snapshot.
Una futura paginazione delle query richiederebbe anche filtri, ordinamenti,
conteggi e recupero schede coerenti sul server. Nessuna cache aggiunta.

Aggiornamento presenze dopo le azioni, riconciliazione a 15 minuti, controlli
di revisione, autorizzazioni, QR e stampa conservano il comportamento esistente.

## Verifiche

- 950 test applicativi superati. Casi aggiunti: 1.203 risultati senza salti
  o duplicati, pagina finale parziale, confini esatti, insieme vuoto, valori
  URL non validi e riduzione del risultato; ritorno dai salvataggi con pagina.
- Export sintetico oltre 1.000 iscrizioni verificato anche con un parametro
  pagina esplicito: risultato completo e ricerca del record lontano conservati.
- Lint completo, TypeScript e build production superati; build in copia
  isolata con `npm ci`, pagine originali ripristinate e nessuna credenziale DB.
- `tests/browser/participants-pagination.mjs`: tabella, filtri e router originali
  in copia isolata senza credenziali, 1.203 iscrizioni sintetiche, Admin/Manager/
  Viewer a 1.440 e 390 px. Verificati pagine, ricerche oltre la prima pagina,
  filtri combinati, ordinamento globale, bozze, cronologia, reload, schede,
  minori, indicatori presenza, URL export, statistiche e viste. Trasporto
  presenze sintetico; azioni accoglienza sostituite esclusivamente nella copia
  di prova con diniego, senza provare scritture o stampa in questa verifica.
- Controllo visivo dei comandi finali a 390 e 1.440 px: una riga compatta,
  target di almeno 44 px, nessuno sforamento orizzontale della pagina.
- Ricerca esplicita originale riprovata nelle quattro combinazioni Admin/
  Manager desktop/mobile con risposta RSC ritardata: nessuna ricerca durante
  la digitazione, bozza/focus/scroll conservati, Invio/Cerca/reset e ricerca
  ripetuta senza ricaricare il documento.
- `tests/browser/attendance-refresh.mjs`: 500 iscrizioni caricate, 100 righe
  visibili; benchmark separato su 500 indicatori con zero render a dato
  invariato e uno al cambiamento di una persona. Salvataggio/rimozione,
  invalidazione fra schede, intervallo di 15 minuti, errori, revoca e mobile
  superati senza errori runtime.

Verifiche senza migration, scritture applicative remote, email o stampa fisica.
Modifiche preesistenti ad AGENTS e al verbale hardware conservate.

## Rilascio richiesto

Il 17 ottobre l'utente ha richiesto commit e push su main della paginazione,
con il normale deployment Git Vercel production del progetto iscrizioni-pace.
Il rilascio non richiede migration né cambi di configurazione. Dal commit
sono escluse le modifiche preesistenti ad AGENTS e al verbale hardware.
