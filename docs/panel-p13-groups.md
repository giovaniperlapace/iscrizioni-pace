# P13-G — QR gruppo e preparazione dei badge

Aggiornamento successivo del 6 ottobre 2026: codice pubblicato sul branch panel
(commit `9c4a9f1`); tutte le 20 migration applicabili mancanti, incluse P13 e
P13-G, applicate e registrate nello staging. Installazione, privilegi, API e
invarianza dei check-in verificati. Resta esclusa la rinomina storica dei gruppi
assenti in staging. Collaudo autenticato/hardware ancora aperto. Il dettaglio
operativo corrente è in AGENTS e nel piano; le note locali sotto sono lo storico.

Stato al 6 ottobre 2026: implementazione software locale sul branch panel.
Migrazione `20261006150000_group_reception.sql` non applicata a database remoti.
Nessun commit, push o deployment. P13 resta aperta; non sono avviate P14/P15.

## Decisioni confermate

- Il QR comprende esclusivamente gli iscritti assegnati direttamente al gruppo
  selezionato, senza sottogruppi. Le membership autorizzano il capogruppo anche
  nella sua gerarchia, ma non allargano il contenuto di un singolo QR.
- Per ora i minori non ricevono un QR autonomo: sono selezionabili individualmente
  per l'ingresso e restano collegati al QR del genitore.
- L'ingresso reale viene confermato dall'operatore: date dichiarate assenti o
  non comunicate non fanno sparire membri correnti dall'elenco degli arrivati.
  Non si modificano le presenze previste o le prenotazioni panel.

## Percorso operativo

1. Nella gestione dei link del capogruppo, ogni gruppo assegnabile ha la sezione
   «QR accoglienza del gruppo»: mostra/scarica, revoca e rinnova con conferma.
   Testi disponibili nelle sette lingue. La prima apertura crea la credenziale;
   le aperture successive riusano la stessa. La revoca resta valida finché non
   viene richiesto espressamente il rinnovo. Nessuna email automatica.
2. All'accoglienza evento lo stesso scanner riconosce il QR gruppo. La conferma
   mostra adulti e minori: selezione individuale, seleziona tutto e deseleziona.
   Nessun ingresso al solo riconoscimento, neppure per un gruppo con un membro.
   Sono possibili lettura manuale del contenuto QR e correzione esplicita.
3. «Prepara badge senza registrare ingressi» permette di passare direttamente
   alla coda. Dopo un ingresso parziale sono proposti i QR dei nuclei arrivati;
   l'operatore può selezionare tutti i QR personali del gruppo.
4. Il lotto conserva sul server ordine, elementi e stato. Si riprende rileggendo
   il QR e premendo «Riprendi la coda salvata». Un solo lotto non verificato per
   gruppo evita di perdere code aperte dietro nuove creazioni. Membri usciti dal
   gruppo non sono più stampabili e non bloccano la creazione successiva.
5. «Prepara i badge in attesa» carica in sequenza i QR personali attivi senza
   rigenerarli. Nome, codice e QR compaiono nell'anteprima separata; da lì si
   apre la finestra di stampa del browser. Il formato è generico, non calibrato
   su etichette. «Preparato · da verificare» non significa stampa riuscita.
6. Dopo la verifica fisica l'operatore conferma il singolo badge. Una ristampa
   va richiesta esplicitamente per quell'elemento. Se una risposta di preparazione
   si perde, l'elemento resta preparato: verificare l'esito o chiedere ristampa.
   Errori QR non producono sostituzioni automatiche di token.

## Modello e garanzie

- Credenziale gruppo `G:` + token casuale opaco, distinto dai token personali
  e scuola. Hash per lookup, token cifrato per recupero; mai nel routing URL,
  localStorage, audit o log. Evento ricavato sul server, attore da `getUser()`.
- `group_reception_tokens`, `group_badge_batches`, `group_badge_items`: RLS
  abilitata e nessun accesso diretto di anon/authenticated. RPC service-only con
  autorizzazione DB a ogni chiamata, anche retry, lettura e preparazione stampa.
- La credenziale è gestibile dal capogruppo nel proprio scope e da admin/manager;
  le operazioni ingresso/coda richiedono incarico evento tramite i ruoli esistenti.
  Un incarico panel/sala da solo non abilita operazioni di gruppo.
- Iscrizioni correnti submitted/confirmed, non eliminate né annullate. Snapshot
  completo include composizione e revisioni delle presenze; confronto prima
  della scrittura, lock e transazione impediscono conferme parziali nascoste.
- Le presenze riusano `check_ins` e incrementano le revisioni canoniche di ogni
  iscrizione interessata. I log `reception.enter/correct/cancel` con origine
  `group_qr` alimentano il report esistente; nessun conteggio di gruppo aggiuntivo
  si somma alle presenze individuali. Retry identico restituisce lo stato corrente.
- Lock brevi sulle tabelle gruppi/assegnazioni/minori proteggono anche nuove righe;
  iscrizioni bloccate per ID ordinato. È una scelta conservativa: sotto carico
  può serializzare modifiche amministrative concorrenti, da misurare nel collaudo.
- Elenco aggregato DB completo (verificato oltre 1.000 persone), massimo difensivo
  10.000 soggetti: oltre il limite l'operazione fallisce senza mostrare un elenco
  parziale. Nomi e contatti non sono conservati nella coda: riletti solo per i
  membri ancora autorizzati. Gli audit contengono ID e dati operativi minimi.
- Le modifiche della coda confrontano il numero di tentativi per impedire che
  una vecchia richiesta di ristampa annulli una preparazione più recente.
- Le immagini sono solo nella pagina corrente; dopo reload si recupera lo stato
  della coda, non si ristampano automaticamente gli elementi già preparati.
  Ingresso e stampa sono operazioni indipendenti, quindi un guasto stampa non
  annulla gli ingressi e una ristampa non crea presenze.

## Verifiche e limiti

- 758 test applicativi superati; lint e build staging con TypeScript.
- PostgreSQL 17 temporaneo: migration canoniche, compatibilità dei check-in
  precedenti, permessi, ingresso parziale/completo, minori, esclusione sottogruppi,
  token revocato, snapshot cambiato, tentativi duplicati, coda e ristampa.
- Concorrenza: otto retry di gruppo con sette replay; due correzioni concorrenti
  con un solo successo e un conflitto; conservate prove famiglia/scuola.
- Browser locale, fixture sintetica: elenco senza preselezione, solo minore
  arrivato, selezione badge del nucleo, preparazione, anteprima separata,
  conferma operatore e ristampa. Desktop 1280×900 e mobile 390×700; corretto
  footer che copriva l'ultima selezione mobile. Fixture in
  `tests/browser/group-reception-fixture.tsx`; route temporanea rimossa.
- Aggiornato il test testuale delle statistiche rimasto al vecchio segnaposto
  P10, ora sostituito dall'indicazione P13 sugli ingressi non disponibili.
- Da completare: applicazione ordinata in staging, collaudo autenticato dei ruoli
  e del QR capogruppo nelle sette lingue, scansione su dispositivi reali,
  carico multi-postazione, calibrazione etichette e guasti stampante P14/P15.
  Le prove locali non equivalgono all'accettazione sul campo della milestone.
