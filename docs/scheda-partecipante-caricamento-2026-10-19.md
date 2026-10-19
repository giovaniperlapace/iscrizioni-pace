# Scheda partecipante completa dopo il caricamento — 19 ottobre 2026

## Comportamento richiesto e implementato

La scheda condivisa dalle dashboard Manager e Admin mostra un unico stato
«Caricamento scheda partecipante…» prima di rendere disponibili i contenuti.
Aspetta QR (compresa la decodifica dell’immagine), verifica della partecipazione,
contatore/disponibilità delle etichette, giorni comunicati, dati anagrafici
aggiuntivi, associazione, accessibilità e gli eventuali indicatori adulto/minori.

Si attende soltanto ciò che quella scheda è autorizzata a caricare. Viewer,
iscrizioni eliminate e sezioni già fornite dal server non attivano letture
aggiuntive. Non viene introdotto un pulsante «Mostra QR»: il QR continua a
essere richiesto all’apertura della scheda, mai caricando o scorrendo la tabella.

La finestra mantiene altezza e intestazione fisse, inclusa la chiusura, durante
il passaggio dal caricamento ai contenuti. Il corpo rimane montato per eseguire
le letture esistenti, ma nascosto e `inert`: campi e comandi non sono visibili,
focalizzabili o cliccabili finché tutte le sezioni iniziali non si sono risolte.
La visualizzazione congiunta non comporta un secondo montaggio né altre letture.

Gli errori conclusivi delle singole sezioni vengono mostrati insieme alla scheda,
con i messaggi e i retry esistenti. Una lettura ancora pendente dopo 25 secondi
lascia i contenuti nascosti e offre «Riprova caricamento»; il retry rimonta soltanto
la scheda, che non è ancora stata resa modificabile. È possibile chiudere durante
il caricamento. Risposte arrivate dopo chiusura o cambio persona non popolano
la scheda successiva. Dopo il timeout si riprende soltanto con retry esplicito.

Dopo la prima visualizzazione, aggiornamenti, salvataggi e riconciliazioni delle
presenze non nascondono né rimontano l’intera scheda. Campi non salvati conservati.
Conferma/rimozione presenza e stampa rimangono azioni esplicite e separate, con
controlli e blocchi operativi preesistenti. Il nuovo coordinamento usa soltanto
segnali locali di completamento: nessuna nuova API, cache dei QR o autorizzazione.

## Verifiche

- 961 test applicativi, lint e TypeScript superati.
- Build production Webpack completata con entrambi gli interventi nella copia
  temporanea installata con npm ci dal lockfile, senza ambienti reali e dopo
  aver ripristinato tutte le pagine/azioni originali dalle fixture browser.
- Browser sulla tabella, scheda e componenti originali in copia isolata senza
  credenziali reali: Manager desktop e Admin mobile; risposte trattenute una
  per volta per QR, partecipazione, contatori stampa, giorni comunicati,
  anagrafica, associazione e accessibilità.
- Nessuna lettura iniziale del QR; contenuti nascosti durante l’attesa;
  immagine decodificata alla visualizzazione; coordinate del pulsante Chiudi
  identiche prima/dopo; comandi presenza stabili dopo la visualizzazione.
- Chiusura anticipata, apertura di un’altra persona, risposta QR tardiva,
  errori, timeout di 25 secondi verificato con orologio browser controllato,
  retry completo, bozze conservate durante aggiornamento presenze, Viewer
  e iscrizioni eliminate. Nessuna azione automatica di presenza o stampa.
- Screenshot mobile di caricamento e scheda pronta ispezionati.
- Regressione con tabella e Server Action originali collegate a PostgreSQL
  temporaneo: Manager, Admin e Viewer, conferma/rimozione, revisione, download,
  stampa simulata e revoca del ruolo. Alla revoca, nessuna RPC operativa e nessuna
  presenza scritta. Il runner storico ora ammette anche il messaggio conservativo
  «Esito da verificare» quando il middleware intercetta la Server Action prima
  della RPC, oltre al messaggio esplicito di sessione/incarico non autorizzato.

Fixture riproducibile: `tests/browser/participant-sheet-loading.mjs`; modifica
soltanto copie temporanee delle pagine e dei trasporti server, ripristinandole
alla fine. Il runner rifiuta un checkout con `.env.local`.

## Rilascio congiunto autorizzato

L’utente ha autorizzato backup, migration production, commit/push su main e
verifica del deployment insieme ai QR gruppo. Per questa modifica non serve
una migration aggiuntiva; le due migration QR sono state applicate e registrate
atomicamente prima del codice, con backup verificato e dati invariati, come
riportato nel [verbale QR gruppo](qr-gruppo-manager-2026-10-19.md).
Nessuna scrittura applicativa reale, email o stampa fisica di collaudo.

Pubblicata con commit `7251f7d`; deployment production READY e dominio ufficiale
allineato, senza errori runtime rilevati nel controllo. Il browser disponibile
non era autenticato: verifica online limitata alle superfici pubbliche e alla
protezione delle dashboard; nuove interazioni verificate con i test sopra.
