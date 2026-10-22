# Posti cerimonie — 22 ottobre 2026

## Decisione e comportamento

Voce autonoma «Posti cerimonie» nella barra laterale Admin/Manager, con icona
sedia. Rimossa la scheda Cerimonie dal menu Forum. I tre vecchi indirizzi
reindirizzano alla nuova sezione conservando inaugurazione/finale.

La superficie web è dedicata alle assegnazioni. Preparazione, settori, quote,
editor e pubblicazione della piantina non sono più esposti, neppure ad Admin.
Le relative Server Action rifiutano i comandi strutturali. La manutenzione
concordata attraverso ChatGPT usa le RPC canoniche riservate al servizio e
l'autorizzazione Admin; il database non identifica un prodotto chiamante come
«ChatGPT». Anche la modifica delle quote richiede ora Admin nella RPC.
Viewer e operatori di altri eventi restano esclusi.

Si può partire dai posti oppure dalle persone. Un riepilogo nominale mostra
l'abbinamento nell'ordine di selezione prima della conferma. Adulti e figli
si scelgono esplicitamente; nessun figlio è incluso automaticamente. Ogni
operazione interessa un settore e può comprendere più persone della famiglia.
I posti possono essere riservati senza nomi alla delegazione di un gruppo e
successivamente assegnati ai suoi membri. Una riserva esistente può essere
incrementata. In F si assegna il settore, senza inventare sedie numerate; la
nomina di un membro utilizza prima una riserva disponibile del suo gruppo.

Tutte le iscrizioni attive (`submitted` / `confirmed`, non eliminate) sono
assegnabili, indipendentemente dalle presenze dichiarate. La presenza «sì»
nel giorno e nella fascia della cerimonia dà priorità globale nell'elenco,
prima della paginazione; le dichiarazioni non vengono modificate. Per
l'inaugurazione è domenica 25 ottobre pomeriggio. Risposte no/non comunicate
restano visibili e selezionabili. La revisione dei biglietti non considera più
l'assenza dichiarata come invalidazione; conserva cancellazione, figli,
appartenenza e cambi di gruppo. Le regole di prenotazione Forum non cambiano.

## Dati e protezioni

Il loader riusa l'indice compatto server dell'elenco iscritti. Ricerca, filtri
e priorità si applicano all'intero evento; dettagli e figli si caricano per
100 persone alla volta. Alla UI arrivano soltanto nome, codice, provenienza,
gruppo, risposta alla presenza e figli della pagina. Il nuovo snapshot della
sala non carica la directory globale né le versioni storiche della piantina.
La selezione della UI viene conservata durante la navigazione dell'elenco.

`assign_ceremony_seats` rilegge ruolo, evento, revisione, iscrizione, figli e
appartenenza al gruppo. Riusa assegnazioni e nomine canoniche, sotto i medesimi
lock. Famiglia, riserva fisica e nomina sono un'unica transazione: un errore
annulla tutte le modifiche della richiesta. Una ricevuta rende sicuro il retry
con lo stesso identificativo. Due manager non possono ottenere lo stesso posto.

Gli UUID delle sedie restano indipendenti dalle coordinate. La pubblicazione
di una nuova versione conserva le assegnazioni in caso di spostamento grafico;
blocca eliminazione, cambio settore, fila o numero di una sedia occupata.
Capienze, 290 posti protocollo e disposizione del 21 ottobre sono invariati.
La futura etichetta fisica è ancora da concordare: proposta
`A-B2-F09-P01` (blocco, fila, posto), non applicata come rinumerazione.

## Verifiche

- 1.035 test applicativi, lint e TypeScript superati.
- Build production Webpack in copia isolata senza credenziali reali, con
  `npm ci` dal lockfile.
- PostgreSQL temporaneo: migrazioni complete e applicazione protetta della
  nuova migration; regressioni cerimonie, ruoli, minori, protocollo, replay,
  riserve e consumo delle quote F; errore sul secondo familiare senza effetti
  parziali. Gara Manager/Admin sul nuovo comando: un solo posto assegnato,
  l'altra richiesta incontra la revisione cambiata.
- Browser Chrome sul componente originale, Server Action e PostgreSQL
  temporaneo: genitore/figlio, persona prima del settore F, delegazione,
  protocollo disabilitato, desktop e telefono 390px senza overflow globale
  o errori JavaScript. Solo persone sintetiche, nessuna API operativa remota.
- Ricerca e priorità oltre pagina 1 su 1.203 iscrizioni sintetiche; regressioni
  del loader originale su 5.005 iscritti e conservazione dei filtri.
- Protezioni già presenti della versione della piantina ricontrollate via SQL:
  coordinate modificabili con assegnazioni conservate, rinumerazione occupata
  bloccata. Nessun test richiede la stampa fisica delle etichette.

## Produzione

Migration `20261022120000_ceremony_seats_desk` applicata e registrata nella
stessa transazione. Confronto prima/dopo: **68 tabelle, 191.862 righe canoniche,
ACL di 216 funzioni preesistenti**, proprietari, RLS e policy invariati. Modificate
soltanto le cinque funzioni previste; aggiunte le due RPC operative service-only.
Nessuna assegnazione o modifica della piantina reale durante il rilascio.

Backup custom completo verificato con `pg_restore --list` e decodifica integrale:
`/root/backups/iscrizioni-pace/production-before-ceremony-desk-1792659713.dump`,
18.774.803 byte, SHA-256
`9a93fafa2be0cc894a8d2b5e1624f8c66b76ff0660261d65b336b520132f6b38`.

La revisione con una sessione browser reale Manager/Admin e le etichette
fisiche restano da svolgere con chi gestirà la sala. Il collaudo sintetico non
viene presentato come una revisione autenticata in produzione.

Prima pubblicazione automatica da `main`: codice `9b1bf06`, deployment
`dpl_GR1tnD3b5SkTNy2bY3c9QuYUkLYN` **READY**. Lettura canonica live come
Manager: 11 settori, 3.140 sedie, nessuna directory globale/storia nel payload,
revisione 4 e nessuna assegnazione reale creata dal collaudo.

Rifinitura successiva dello stesso rilascio: selezione inaugurazione/finale
conservata espandendo il menu; comandi disabilitati durante il salvataggio.
Ripetuti con successo browser completo su database temporaneo e test
applicativi (1.035), lint e TypeScript.
