# Incongruenze statistiche — 14 settembre 2026

## Riscontro e causa

Verifica iniziale in sola lettura: 257 iscrizioni, 276 persone incluse 19
presenze familiari di minori; 245 assegnazioni correnti pertinenti e 12 persone
realmente senza gruppo. Le query delle statistiche admin/manager inviavano
insieme tutti gli UUID: URL di 10.257 e 10.174 caratteri, HTTP 414 per gruppi
e presenze. Gli errori ignorati diventavano array vuoti: tutte le persone
apparivano senza gruppo e prive di fasce di presenza.

Il rilascio `a5ecd87` delle 11:18 correggeva il loader condiviso dei blocchi,
ma le statistiche non lo usavano. Il loro codice risaliva a giugno. Non è
stata osservata perdita di assegnazioni od orari nel database.

La mancata gerarchia territoriale esponeva due ulteriori difetti:
- 23 persone avevano città e paese tramite `city_id`/`country_id` (Roma/Italia),
  mentre le statistiche leggevano soltanto `city_other`/`country_other`.
  22 erano inserimenti capogruppo, una un'iscrizione pubblica storica.
- Due schede contenevano `RM` e `Roma` come paese dall'11–12 settembre,
  pur avendo città Roma e gruppi Tiburtina e Flaminio.

Le 12 iscrizioni senza gruppo non vanno riassegnate automaticamente: 7 furono
spostate dalla migration del 5 settembre, con audit
`participant.group_assignment_migrated` e precedente stato `probable`;
5 non hanno assegnazioni nella storia disponibile.

## Correzione

`event-statistics.server.ts` è il loader unico per admin e manager e i loro
filtri statistici. I chiamanti mantengono autenticazione e scope evento.
Tutte le sorgenti hanno paginazione stabile; relazioni per blocchi di 100
UUID, incluse tutte le fasce di presenza. Errori di lettura, gerarchia
incompleta/ciclica, partecipanti mancanti o assegnazioni correnti ambigue
interrompono l'intero riepilogo. Boundary dedicati admin/manager mostrano un
messaggio con Riprova, senza conteggi parziali o falsi valori mancanti.

`geography.ts` condivide fra statistiche, tabella e export il fallback dal
testo personale non vuoto ai nomi dei record collegati nel catalogo. I testi
correnti hanno precedenza su eventuali collegamenti storici; la gerarchia del
gruppo conserva la precedenza territoriale nel motore statistico. Minori,
filtri e regole di inclusione delle iscrizioni rimangono invariati.

`country-validation.ts` verifica il paese del modulo pubblico sul server e
nel campo Altro del browser. Ammette le opzioni esistenti e nomi di paesi e
territori nelle sette lingue, compresi quelli non europei; non interpreta
Roma/RM come Italia. Il browser mostra un messaggio localizzato e conserva
la compilazione. La verifica non modifica automaticamente le schede storiche
né introduce nuovi vincoli SQL o restrizioni alle policy RLS.

## Correzione dati autorizzata

Dopo l'approvazione dell'utente, eseguita transazione con blocco delle due
schede e precondizioni su ID, valori originali, iscrizione, evento, gruppo
corrente e catalogo Roma/Italia. Cambiati soltanto `country_other` a Italia e
`country_id` al record IT (oltre all'eventuale timestamp del trigger esistente).
Due righe aggiornate, due record audit `admin.participant_country_corrected`,
batch `statistics-countries-2026-09-14`, con valori precedenti e nuovi;
postcondizioni verificate prima del commit. Nessuna assegnazione modificata,
nessun invio email o modifica ad account, presenze, snapshot o consensi.

## Verifiche

- Test del loader con 1.201 iscrizioni, minore, oltre 1.000 gruppi, 7.206 fasce,
  limite URL simulato, errori nelle pagine/blocchi successivi e fallback catalogo.
- Test validazione: opzioni europee, paesi extraeuropei, lingue, rifiuto città e
  provincia, verifica server prima delle scritture.
- Copia isolata dal lockfile: 267 test, lint, typecheck e build production passati.
- Browser su fixture locale del vero modulo: Roma rifiutata, Malawi accettato;
  nessuna iscrizione inviata. Messaggio errore e Riprova verificati, desktop e
  mobile, senza errori browser. La prova del componente non simula un'interruzione
  del database attraverso una sessione operatore autenticata.
- Nuovo loader sul database reale, solo lettura: al controllo successivo 278
  persone (nuove iscrizioni intercorse), 12 senza gruppo, zero senza città,
  solo Italia, 29 senza fasce. Presenze per 25/26/27 ottobre:
  mattina 216/219/211, pomeriggio 235/217/217. Sono conteggi di quel momento,
  non costanti del sistema.
