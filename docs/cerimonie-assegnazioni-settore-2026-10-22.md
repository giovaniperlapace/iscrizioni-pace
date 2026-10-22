# Cerimonie: assegnazioni al settore — 22 ottobre 2026

## Stato

Rilascio autorizzato esplicitamente dall’utente dopo la revisione locale.
Migration applicata e registrata in produzione; pubblicazione del codice su
`main` in corso, partendo da `70aa523`. Nessuna assegnazione, revoca, presenza,
stampa o email reale di collaudo.

## Richiesta e comportamento

- L’ingresso ordinario del Manager apre le cerimonie; al login il precedente
  menu Manager ricordato non sostituisce questa vista iniziale. Le voci
  esplicite del menu restano raggiungibili e il Viewer mantiene la sua vista.
- Sala principale e sala collegata F sono entrambe presenti, anche affiancate
  su telefono. F contiene 400 quadratini; la sala principale conserva le
  3.140 sedie della disposizione reale. Sono visibili solo A, A1, A2, B, C, D,
  E e F. Palco in alto e due aree posteriori di E conservati.
- I quadratini rappresentano disponibilità e riserve del settore. Il colore
  non individua più una sedia assegnata: nessun numero/blocco/fila selezionabile.
  Restano 3.540 posti fisici, 3.250 assegnabili e 290 riservati al protocollo.
- Clic su un settore: pop-up con disponibilità e modalità Singoli/Gruppi.
  Scelta del gruppo, ricerca globale dei nomi, presenza dichiarata visibile,
  assegnazione nominale oppure quantità. Singoli sceglie una persona;
  Gruppi permette più nomi e selezione esplicita della pagina corrente.
  La quantità richiede un gruppo cui riservarla; una persona senza gruppo
  viene scelta nominalmente. Minori sempre scelti esplicitamente.
- Tutte le iscrizioni attive, sia `submitted` sia `confirmed`, sono incluse:
  nessun filtro obbligatorio di presenza. Presenza confermata, assenza dichiarata
  e dato ancora sconosciuto sono distinti; i presenti dichiarati precedono gli
  altri. I check-in non sono usati né modificati.
- Riepilogo del gruppo nell’intero risultato, indipendente da ricerca/pagina:
  persone iscritte, persone con settore, persone ancora da assegnare, eventuali
  minori senza sedia. Per ciascuna riserva: quantità, nomine e residuo da abbinare.
  Le persone già assegnate comprendono sia assegnazioni dirette sia nomine di
  gruppo. Una persona con scelta senza sedia non viene contata come seduta.
- Le assegnazioni nominali dei Manager consumano prima la riserva del gruppo
  selezionato nello stesso settore. Una nuova riserva per quantità è invece
  un’aggiunta esplicita e richiede capienza libera.
- Il capogruppo sceglie dotazione/settore e uno o più membri, con ricerca e
  pagine da 100, anche senza presenza confermata. Un’unica conferma salva il
  lotto in transazione. Restano annullamento della nomina e scelta del minore
  senza sedia. UI in italiano, inglese, francese, tedesco, spagnolo, neerlandese
  e ucraino; nessuna scelta di posto numerato.
- Cronologia e revoche restano disponibili. Le vecchie coordinate delle sedie
  non sono mostrate per un settore ormai privo di numerazione.

## Database e controlli

Migration revisionabile: `20261022200000_ceremony_sector_assignments.sql`.

Per le cerimonie esistenti nell’evento corrente la migration chiude i soli
claim attivi delle sedie e imposta i settori senza numerazione, incrementando
la revisione sotto lo stesso lock evento dei writer. Conserva righe storiche,
nomi, nomine, quantità, riserve, UUID e geometria delle mappe, quote e capienze.
L’audit distingue la conversione da una revoca; non vengono create false voci
«posto liberato dalla riserva» nella cronologia corrente.

Il trigger impedisce nuovi collegamenti a sedie nei settori senza numerazione.
Le RPC preesistenti conservano privilegi e verifiche; il contesto gruppo delle
assegnazioni nominali è verificato nuovamente nel DB. Due RPC nuove, solo
service role, offrono directory paginata e assegnazione multipla capogruppo.
Quest’ultima riusa la funzione canonica di abbinamento, con scope riletto,
nessun bypass dei ruoli cumulati, revisione e rollback dell’intero lotto.

Richieste di scrittura con UUID idempotente; dopo esito incerto la selezione è
bloccata e si può ripetere solo la stessa richiesta. Le letture Manager usano
HTTP `private, no-store`, timeout di 25 secondi, scarto delle risposte tardive
e controllo della revisione tra directory e piantina. Aggiornamenti su apertura,
ricerca/pagina, salvataggio/revoca e pulsante esplicito; nessun polling.

La preparazione di nuove sedi resta manutenzione concordata. Per una futura
configurazione numerata occorre convertirla esplicitamente al settore prima
di usare il nuovo flusso; non sono state inventate sedi della cerimonia finale.

## Verifiche eseguite

- `npm test`: 1.053 test superati; `npm run lint` e `npm run typecheck` riusciti.
- `npm ci` e build production Webpack in copia isolata, priva di credenziali
  operative: riusciti. Route temporanee di collaudo rimosse prima della build.
- PostgreSQL temporaneo: tutte le migration e suite cerimonie preesistenti;
  conversione di riserve già presenti con claim storici conservati; parità
  di quantità/mappe; conteggi misti diretti/gruppo; riuso della riserva;
  annullamento senza perdita della dotazione; rollback completo se il lotto
  eccede la capienza; replay, ruoli e scope.
- Directory con 108 persone: ricerca prima della pagina e riepilogo completo,
  anche quando il risultato della ricerca contiene una sola persona.
- Concorrenza: ultimo posto del settore e ultimo posto della dotazione
  capogruppo, una richiesta salvata e una in conflitto; nessun doppio consumo.
- Browser su componenti originali, HTTP e Server Action contro PostgreSQL
  temporaneo: desktop 1440px e telefono 390px, piantine e conteggio dei 400
  quadratini F, dialog accessibile con Escape, nessun overflow orizzontale,
  tutti gli stati di presenza, risposta persa e retry, assegnazione singola
  che consuma la riserva, gruppo di 100 diviso 20 in A e 80 in B, sette lingue.
- Il browser rinnova un cookie nelle letture HTTP senza navigare la pagina.
  Numero finito di letture verificato; nessuna chiamata operativa remota,
  email, stampa fisica o presenza reale di collaudo.

## Passaggio alla produzione

L’utente ha autorizzato backup, migration e pubblicazione. Backup completo
verificato con `pg_restore --list`, decodifica integrale e SHA-256:
`/root/backups/iscrizioni-pace/production-before-sector-assignments-1792694179.dump`,
19.975.628 byte, permessi 600, SHA-256
`c3e07844f5a15742ed3d962ce02fcd905c105161b484dda8ed8958e4048d8480`.

Migration `20261022200000` applicata e registrata atomicamente tramite lo
script del repository, con guardie di conservazione prima collaudate sul DB
temporaneo anche con sedie occupate. Confrontate 68 tabelle e 202.645 righe:
sole modifiche previste a numerazione/revisione e nuovo audit; quantità,
nomine, quote, mappe e storico invariati. Conservati ACL/owner delle 223
funzioni preesistenti, ACL/RLS delle 68 tabelle, policy e trigger; modificate
solo le cinque definizioni previste, aggiunte due RPC service-only.

Stato rilevato: inaugurazione validata, revisione 11, otto settori senza
numerazione, 3.540 posti fisici e 3.250 assegnabili. Una assegnazione e una
nomina storiche già revocate conservate; nessun claim attivo da chiudere.
Letture canoniche live con scope reale e transazione poi annullata: Manager
4.673 persone, pagina da 100, 128 gruppi e otto settori; capogruppo 51 membri.
Nessun nominativo esposto nel verbale. Execute delle nuove RPC negato ad
anon/authenticated e consentito al solo service role.

Pubblicazione del codice e verifica del dominio in corso. Il flusso autenticato
completo è stato collaudato con componenti originali e PostgreSQL temporaneo;
non sono state create assegnazioni reali per la prova.
