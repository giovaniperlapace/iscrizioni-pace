# Accoglienza semplificata — 16 ottobre 2026

La richiesta riguarda la scheda dopo la lettura del QR, sia da scanner USB sia
nella modalità telefono appena pubblicata. La scansione continua a essere una
lettura: non scrive presenze. L’accesso operativo rimane solo Admin.

## Comportamento

- Singolo senza minori: nome, codice e stato; **Registra presenza** salva con
  un solo clic, senza modale. Dopo la risposta del server compaiono spunta e
  colore verde, con transizione disattivata da reduced motion. Una presenza
  già registrata disabilita il comando. Modifica presenze conserva rilettura,
  conferma, revisione e annullamento esplicito.
- Gruppo o famiglia con minori: una sola finestra con una sola lista. Ogni riga
  riporta nome, presenza, codice e, sul computer, conteggio delle stampe.
  La selezione parte vuota, offre Seleziona tutti e resta conservata chiudendo
  e riaprendo la finestra. Non selezionare una persona non cancella un ingresso.
- Computer: **Registra presenze e stampa QR** usa la stessa selezione per le
  due azioni. Restano disponibili i comandi separati di presenza e stampa.
  I minori condividono il QR del genitore: selezionare genitore e figli produce
  una sola etichetta di quel QR, senza aggiungere presenze non selezionate.
- Telefono: la stessa vista delle presenze, senza comandi o richieste di stampa.
  L’anteprima viene nascosta dopo la lettura; Passa al prossimo codice riprende
  il lettore. Cambio modalità rilascia la fotocamera. Inserimento manuale
  conservato, anche quando l’accesso alla fotocamera è negato.
- Scuole: quantità e correzioni nella finestra dedicata. Forum e assistenza in
  sala mantengono la console precedente. Badge completo del gruppo e sedute
  restano disponibili in una sezione richiudibile; anche il collaudo stampante
  è spostato negli strumenti secondari.

## Salvataggio e stampa

Il comando combinato non è una transazione con la stampante: prima salva tramite
la sessione/RPC esistente, poi controlla che le persone selezionate risultino
presenti nella risposta, infine usa la coda e il renderer QR originali. Nessuna
nuova migration, coda o persistenza locale.

Conflitto, revoca o esito incerto della presenza impediscono la stampa. Il retry
ripete lo stesso identificatore di richiesta e non avvia automaticamente la
stampante: dopo la verifica si usa il comando di stampa sulla selezione rimasta.
Se la stampa fallisce dopo il salvataggio, la presenza resta visibile come salvata;
si può riprovare solo la stampa. Nessun rollback di un ingresso riuscito.

Il blocco sincrono impedisce doppi clic, nuove scansioni o cambio modalità durante
le operazioni. Ogni stampa rilegge scope e QR e mantiene snapshot, tentativi,
profilo 29 × 45 e lock di pagina. Il ritorno del browser non conferma l’uscita
fisica. Una revoca dell’accesso rimuove la scheda.

## Verifiche

Browser con componenti originali e dati sintetici, stampa simulata: singolo senza
modale, doppio clic, correzione/annullamento, una lista gruppo, selezione mantenuta,
comando combinato, conflitti, richiesta incerta con retry identico, errore stampa
dopo presenza salvata, stampa senza presenza, minori con QR genitore deduplicato,
scuole e terminatore scanner, layout desktop/mobile, fotocamera e fallback manuale.
Regressioni stampa autonoma, gestione partecipanti e vecchia console fotocamera.

SQL e concorrenza su PostgreSQL temporaneo: controlli e RPC esistenti verificati
separatamente dal browser. Nessuna prova di scrittura su dati production, email,
stampa fisica o configurazione hardware. Staging escluso.

Controlli completati: 898 test applicativi, lint completo, TypeScript, build
production Webpack in copia pulita con npm ci e senza credenziali applicative;
SQL/concorrenza e cinque flussi browser (USB, telefono, stampa autonoma,
modifica dalla gestione partecipanti, console fotocamera precedente).

Rilascio richiesto dall’utente tramite commit e push su main e normale deployment
Git Vercel. Le modifiche hardware e i relativi verbali già presenti nel workspace
sono esclusi da questo commit.
