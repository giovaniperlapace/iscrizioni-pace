# Iscritti: aggiornamento presenze e fluidità — 17 ottobre 2026

La pagina Gestione iscritti rileggeva tutte le presenze dell’evento ogni dieci
secondi. Ogni risposta sostituiva il contesto React condiviso e ridisegnava
tutti gli indicatori, anche con dati invariati; ogni data ricreava inoltre
il formatter locale. Il salvataggio nella scheda azzerava temporaneamente
gli indicatori prima della nuova lettura.

## Comportamento

- Lettura all’apertura, poi aggiornamento dopo una conferma, correzione o
  rimozione riuscita tramite la sessione canonica di Accoglienza. Vale anche
  per la scheda partecipante, per i gruppi e per le scuole. Le sole letture,
  gli errori e i comandi Forum/sala non emettono questo avviso.
- Il segnale locale avvisa le liste montate nella stessa pagina e le altre
  schede della stessa origine mediante BroadcastChannel. Trasporta soltanto
  il tipo di avviso e un identificativo casuale della scheda, senza persone,
  QR o dati delle presenze. La scheda mittente non elabora due volte il segnale.
- Ogni lettore rilegge il proprio endpoint autenticato. Nessuna fiducia nel
  messaggio come prova della presenza, nessuna cache persistente o condivisa
  tra sessioni, nessuna modifica a ruoli, RLS o RPC.
- Per le modifiche da altri dispositivi resta una riconciliazione ogni quindici
  minuti, su successiva richiesta dell’utente, sospesa a pagina nascosta.
  Al ritorno alla finestra si rilegge se ci
  sono avvisi pendenti o l’ultima lettura risale ad almeno un minuto prima.
  Ripristinare la connessione avvia una lettura. È disponibile **Aggiorna presenze**.
- La frequenza periodica nominale passa da 360 a 4 letture l’ora per provider
  visibile e inattivo (90 volte meno). Salvataggi, ritorno alla pagina, recupero
  della connessione e richieste manuali possono aggiungere letture.
- Le statistiche degli ingressi restano su richiesta, senza polling né avvisi
  automatici, come stabilito il 14 ottobre.

## Rendering e concorrenza

Il provider mantiene uno store in memoria per evento e tipo di vista. Ogni
indicatore si iscrive soltanto al proprio orario/stato tramite
`useSyncExternalStore`; per le scuole si preserva anche l’identità degli oggetti
con orario e quantità invariati. Il formato data riusa un unico formatter.
La lettura non ricarica pagina, tabella o moduli e conserva filtri e selezione.

Durante una lettura ordinaria resta l’ultimo dato verificato. Errori, timeout,
revoca o redirect rimuovono invece il dato e mostrano indisponibilità, mai una
falsa assenza. HTTP 401/403 e redirect fermano i tentativi automatici; Riprova
riesegue il controllo autorizzato.

Richieste contemporanee vengono accorpate. Se un salvataggio arriva durante
una lettura, la risposta precedente viene scartata e si esegue una sola nuova
lettura. Smontare il provider interrompe la richiesta e rimuove timer, canali
e listener; le risposte tardive non aggiornano il nuovo contesto.

## Verifiche

- 948 test applicativi superati, lint completo e TypeScript.
- Build production con `npm ci` in copia pulita senza credenziali. I cinque
  file applicativi modificati coincidono con quelli della build verificata.
- Otto test nuovi su intervalli, tab nascosta/ripresa, accorpamento, risposta
  precedente al salvataggio, errori/revoca, cleanup, notifiche dopo comandi,
  deduplicazione dei trasporti e statistiche su richiesta.
- Browser Chrome, componenti originali e trasporto sintetico: tabella di 500
  iscritti, zero render dei 500 indicatori su risposta invariata e un render
  per una persona modificata; nessuna lettura a 10 secondi; aggiornamento
  manuale, conferma/rimozione, altra scheda, errori,
  recupero, revoca e viewport mobile senza overflow.
- Suite browser ingressi esistente aggiornata al segnale esplicito: adulto e
  minore distinti, quantità scuola, report su richiesta, campi non salvati
  conservati nelle schede partecipante/scuola e permessi revocati. La fixture
  ora mantiene la sezione scuole sul lato server del confine RSC.
- Comandi browser nella copia isolata: `node tests/browser/attendance-refresh.mjs`
  con `PLAYWRIGHT_MODULE` del runtime e URL localhost; `node tests/browser/event-attendance.mjs`
  con lo stesso URL. Nessun errore runtime nelle prove concluse.
- L’intervallo è stato poi portato da 5 a 15 minuti su richiesta dell’utente;
  test a tempo simulato verificano nessuna rilettura dopo 5 minuti e una
  rilettura allo scadere dei 15. Testi e fixture browser allineati.

Nessuna migration, modifica di dati remoti, email o stampa fisica. Nessun
commit, push o deployment per questa richiesta. Lavori paralleli su scuole,
lista d’attesa capogruppo e verbali hardware conservati.

## Successivo rilascio autorizzato

L’utente ha poi richiesto il rilascio con scuole e Forum capogruppo. Ripetute
con successo anche le prove browser con intervallo effettivo di 15 minuti e
la suite ingressi. Verifiche e migration collegate sono documentate in
[rilascio congiunto](rilascio-presenze-scuole-forum-2026-10-17.md).
