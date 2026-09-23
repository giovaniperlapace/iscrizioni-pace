# Manager Viewer e iscrizione personale

## Comportamento

Manager Viewer ha due sole voci nel menu operativo: Statistiche e Gestione
iscritti. Conserva la consultazione dei partecipanti, i filtri e l'export già
previsti. Comunicazioni, Gestione ruoli, Gestione gruppi e Impostazioni non
sono accessibili neanche tramite URL diretto. Il controllo precede i loader
operativi e usa l'evento corrente: un incarico Manager su un altro evento non
abilita le sezioni riservate. Manager dell'evento e Admin globale mantengono
le sei voci. I controlli esistenti sulle azioni operative restano invariati.

Manager e Manager Viewer hanno la tab **Iscrizione e QR personale** e possono
tornare alla dashboard manager. La stessa autorizzazione condivisa è usata dal
proxy e dalla scelta del ruolo di sessione. La vecchia esclusione dell'area
personale è rimossa; non occorre un secondo indirizzo email.

Un'iscrizione esistente collegata all'account mostra dati personali e QR. In
assenza di iscrizione, **Avvia la mia iscrizione** apre il modulo con l'email
della sessione. Il salvataggio esistente associa il nuovo partecipante all'ID
Auth solo se l'email del modulo coincide con quella autenticata. Restano
obbligatorie la compilazione e le conferme previste dal modulo: l'assegnazione
di un ruolo non genera presenze, consensi, date di nascita o iscrizioni vuote.

## Account esistenti

Controllo in produzione il 23 settembre 2026, in transazione `READ ONLY`:

- 10 account distinti con ruolo Manager o Manager Viewer nell'evento corrente;
- 6 già associati a un'iscrizione non eliminata dell'evento;
- 4 senza iscrizione, da compilare nella propria area;
- 0 iscrizioni scollegate associabili per email, 0 conflitti o ambiguità.

La verifica confronta `auth.users.email`, contatti, proprietario del partecipante
e iscrizioni non eliminate dell'evento corrente. Non associa persone per nome
o somiglianza e non trasferisce iscrizioni da indirizzi diversi. Non sono state
eseguite scritture sui dati reali né inviati messaggi.

## Verifica e rilascio

- Regressioni sui ruoli e sulle tab nelle sette lingue, sul confine server delle
  sezioni e sui menu effettivamente renderizzati, compresi URL impliciti/legacy
  e account con ruoli su eventi diversi.
- Lettura personale oltre 1.000 schede anche per Manager/Viewer, modifica della
  propria iscrizione e associazione alla sola email autenticata.
- `tests/browser/manager-access.mjs`: UI reale con dati e azioni sintetici,
  tab operative/personali, menu desktop/mobile, iscrizione assente/presente,
  scheda personale, anteprima e download QR nelle sette lingue. Eseguire da solo
  con dev server locale su porta 3012 (`BASE_URL` per cambiare porta). La route
  temporanea viene rimossa al termine; nessun invio reale.
- Collaudo con `npm ci` in copia pulita: il checkout ordinario contiene Next
  16.3.0 e tipi generati obsoleti, mentre il lockfile richiede 16.2.9.
  Superati 493 test, lint, TypeScript e build production. Browser sintetico
  completato per entrambi i ruoli, sette lingue, desktop/mobile, senza errori.

Non serve una migration: RLS, dati e meccanismo di collegamento esistente non
cambiano. Dopo il commit locale `2f44258`, l'utente ha autorizzato la
pubblicazione in produzione tramite push su main e deployment automatico
Vercel. La precedente richiesta di non pubblicare è superata.
