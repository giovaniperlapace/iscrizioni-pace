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
Il riferimento visibile adottato su successiva indicazione dell’utente è
«Settore A · Blocco 2 · Fila 9 · Sedia 1». La proposta abbreviata precedente
è superata. Stampa e disposizione delle etichette fisiche restano da concordare.

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

## Palco in alto e nomenclatura esplicita

Su indicazione successiva dell’utente la panoramica e i dettagli mostrano il
palco sul lato superiore. Le file crescono allontanandosi dal palco e le sedie
da sinistra a destra guardandolo. B1 (file 1–5) e B2 (file 6–10) hanno fasce,
intestazioni, cornici colorate e pulsanti distinti: il clic apre esattamente il
settore scelto. Restano sei blocchi fisici B, rappresentati dalle rispettive
metà in dodici schede (38 schede settore/blocco in tutta la panoramica).

«Settore … · Blocco … · Fila … · Sedia …» è condiviso da nomi accessibili,
ricerca, tabella, riepilogo, biglietto personale e consultazione accoglienza.
Nel disegno il settore/blocco compare nell’intestazione e ciascuna sedia
riporta «Fila … / Sedia …». I blocchi posteriori conservano le posizioni
laterali 1 (H1) e 6 (H2). Nessun nuovo numero fisico viene assegnato.

La trasformazione avviene solo nel rendering; dati canonici e collegamenti
restano invariati. Nessuna migration o scrittura remota. Verificati browser
desktop/390px su componenti originali con PostgreSQL temporaneo, direzione
di file/sedie, palco sopra la prima fascia, selezione indipendente B2,
protocollo e assegnazioni nominali. 1.035 test, lint, TypeScript e build
production con npm ci in copia isolata superati.


## Percorso unico dai posti e riepilogo nel QR di gruppo

Richiesta successiva del 22 ottobre: si scelgono sempre prima i posti; soltanto
poi compare la scelta persona/familiari o delegazione. Eliminati i due pulsanti
che invertivano il percorso. Cambiare destinatario conserva la selezione; le
sedie già riservate a un gruppo ammettono solo la nomina dei suoi membri.
Il settore F espone quantità e pulsanti meno/più per entrambi i destinatari.
Il salvataggio nominale richiede altrettante persone selezionate esplicitamente.

La scheda Accoglienza del QR gruppo mostra tutte le riserve attive della
propria delegazione, anche prima delle nomine: cerimonia, settore, quantità,
blocco, fila e intervalli contigui. Le sedie 1, 2 e 4 producono «Sedie 1–2, 4»;
non si include il posto 3. Settore F: sola quantità. Nessuna presenza cerimonia
implicita. Le assegnazioni personali restano distinte dalle riserve al gruppo.

La lettura parte soltanto dopo il successo della RPC canonica del QR, con evento
corrente verificato e gruppo restituito dalla RPC, non da parametri del client.
Allocazioni e sedie sono lette a pagine da 500, con lotti di 200 allocazioni;
revoche escluse e revisione del piano riletta prima di restituire il riepilogo.
La UI segnala un eventuale errore di lettura senza trasformarlo in «nessun posto»
e senza perdere l’esito di una presenza già salvata. Nessuna migration.

Verifiche: 1.039 test passati, inclusi 1.205 posti riservati (oltre il limite di
pagina), buchi negli intervalli, file/blocchi distinti, revoche, scope, letture
fallite e revisione cambiata. Suite SQL e concorrenza su PostgreSQL temporaneo.
Browser su componenti originali, azioni server e database sintetico: famiglia,
contatore F e quantità incoerente bloccata, cambio destinatario senza perdere
le sedie, riserva B2 e F, scansione USB sintetica del QR gruppo e riepilogo reale
delle riserve appena salvate; desktop e mobile senza errori JavaScript.
Nessuna assegnazione operativa, scansione remota o stampa fisica di collaudo.

Lint senza avvisi, TypeScript e build production Webpack da `npm ci` in copia
isolata superati. Nessuna route di collaudo inclusa nella build di rilascio.


## Blocchi posteriori E7/E8 al posto di H1/H2

Il 22 ottobre l’utente richiede che i due blocchi posteriori appartengano al
settore E e conferma esplicitamente **Blocco 7 a sinistra, Blocco 8 a destra**.
Il settore E ha quindi 740 posti (600 + 70 + 70) e una sola cornice nella
panoramica, con gli ultimi due blocchi nella fascia posteriore. I settori H1/H2
scompaiono dalle selezioni operative. Restano 3.540 posti fisici, 3.250
assegnabili, 290 protocollo e F con 400 posti senza numerazione.

I 140 UUID sono conservati. Le file restano 1–7 e le sedie 1–10; il riferimento
interno passa da `H1-r01`/`H2-r01` a `E-b7-r01`/`E-b8-r01`, senza cambiare le
coordinate. La nomenclatura condivisa restituisce, per esempio,
«Settore E · Blocco 7 · Fila 1 · Sedia 1», anche nei biglietti e nei QR gruppo.
Il parser conserva la compatibilità con i riferimenti storici H.

Migration `20261022150000_opening_rear_blocks_sector_e`: aggiornamento mirato
alla piantina inaugurazione dell’evento corrente sotto lo stesso lock delle
assegnazioni. Archivia intatta la mappa precedente, pubblica una nuova versione,
trasferisce le identità delle sedie a E, unisce capienze/quote e incrementa la
revisione. Non disabilita trigger né modifica funzioni di autorizzazione o
assegnazione. La preparazione di una nuova piantina usa già E7/E8 mantenendo la
stessa formula degli UUID originari.

La lettura preliminare production ha trovato revisione 4, mappa pubblicata 1,
11 settori e nessuna assegnazione. La migration ricontrolla comunque lo stato:
qualsiasi assegnazione o claim in H, anche storico, una bozza aperta o quote
inattese causano l’annullamento integrale. Le assegnazioni esistenti in E e
negli altri settori restano identiche; non viene tentata alcuna fusione di
assegnazioni H eventualmente comparse durante il lavoro.

Verifiche completate:

- 1.040 test applicativi, lint senza avvisi, TypeScript e build production
  Webpack da `npm ci` in copia isolata senza credenziali operative.
- SQL su PostgreSQL temporaneo: conversione della vecchia piantina con una
  vera assegnazione sintetica in E; conservazione di claim, nomine, allocazioni,
  UUID, coordinate e storico; rifiuto della revisione precedente; assegnazione
  Manager a E7 dopo la conversione. Configurazioni inattese e H occupato
  producono rollback completo. Regressioni cerimonie e gara Manager/Admin passate.
- Browser originale → Server Action → PostgreSQL temporaneo: otto blocchi E,
  7/8 allineati a sinistra/destra sul retro, 70 sedie ciascuno, disponibilità
  unificata 740 e decremento dopo riserve, QR gruppo con intervalli separati
  per E7 ed E8. Desktop e telefono 390px, nessun errore JavaScript o overflow
  globale. Conservate le prove famiglia, contatore F, B1/B2 e protocollo.
- Procedura protetta di rilascio collaudata sullo stesso DB temporaneo:
  confronto dei dati estranei alla modifica, ACL di funzioni/tabelle, RLS,
  policy, trigger, identità sedie, contenuti delle mappe e storico audit.

Rilascio production da completare: prima il codice compatibile con entrambe
le configurazioni, poi la migration dopo backup verificato. Nessuna
assegnazione, presenza, scansione remota o stampa fisica di collaudo.
