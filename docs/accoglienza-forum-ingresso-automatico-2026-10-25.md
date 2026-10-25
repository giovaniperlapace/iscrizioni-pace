# Forum: ingresso automatico del singolo iscritto — 25 ottobre 2026

## Comportamento

Nella console Forum, una nuova lettura con fotocamera, scanner USB o codice
manuale verifica la prenotazione e registra subito l’ingresso se la risposta
canonica contiene un solo adulto, con accoglienza generale già registrata e
senza indicazioni di inidoneità. Su chiarimento dell’utente, il pulsante
«Segna entrata» / «Conferma ingresso» rimane nel flusso manuale originale:
si automatizza la sua operazione per questa nuova lettura. Come prima, dopo
il salvataggio è disabilitato sul computer e nascosto nella scheda compatta
della fotocamera. Il verde conferma il salvataggio ricevuto dal server;
i contatori si aggiornano con il percorso esistente.

Su successiva richiesta, la scheda dell’ingresso automatico rimane completamente
leggibile e utilizzabile per **10 secondi dal salvataggio riuscito**, poi si
chiude. Vale per fotocamera, USB e codice manuale. Durante questi dieci secondi
la fotocamera e lo scanner USB accettano subito un QR diverso, che sostituisce
la scheda. Ogni nuovo ingresso automatico ha il proprio intervallo completo;
il timer precedente non può chiudere il nuovo risultato, un errore, una richiesta
pendente/incerta, una famiglia da selezionare o una conferma di rimozione.
Il QR rimasto inquadrato resta bloccato dal latch, senza duplicazioni.

La sessione distingue l’esito di una scrittura automatica dalle consultazioni
e dalle operazioni manuali, anche dopo retry. L’attesa parte dal successo,
non dall’inizio della verifica. Gli altri flussi mantengono la chiusura prevista
in precedenza; lo storico e le conferme manuali non ricevono il timer automatico.

La stessa regola vale per gli incarichi delle sale collegate, con prenotazione
e ingresso verificati sulla specifica sala. Non sposta prenotazioni o ingressi
fra Forum principale e collegata.

Restano espliciti famiglie con più persone, minori e quantità delle scuole.
L’assenza di accoglienza generale mantiene l’avviso e «Segna l’ingresso comunque»:
l’automatismo non registra l’accoglienza generale e non usa questa eccezione.
Verifica iscrizione, accoglienza generale e cerimonie non cambiano.

«Apri Scheda» nello storico, l’ispezione per rimuovere un ingresso e la correzione
non attivano l’automatismo. Dopo una rimozione si può confermare di nuovo
con il pulsante oppure con una nuova lettura; aprire la scheda dallo storico
non ricrea da solo l’ingresso.
Se l’ingresso è già presente, basta la lettura: nessun nuovo comando di scrittura.

## Implementazione e controlli

- La sessione distingue la nuova lettura operativa dalla consultazione. Il
  consenso all’automatismo rimane locale alla lettura, compreso il retry di
  un’ispezione incerta; non è un nuovo parametro dell’API.
- Il blocco sincrono rimane attivo fra verifica e salvataggio. Nessuna seconda
  scansione può sostituire la persona durante la richiesta.
- Si usa il normale comando `enter`, con UUID e persona espliciti. La RPC
  ricontrolla prenotazione, evento/incarico, capienza e accoglienza generale;
  non sono introdotti bypass, nuove RPC o migration.
- Un esito incerto conserva scheda e richiesta. Il retry invia lo stesso UUID
  e payload; risposte tardive non trasformano l’incertezza in conferma.
- Il latch impedisce che il QR ancora inquadrato ripeta l’operazione, anche
  dopo riavvio della fotocamera. Uscire prima della fine dell’ispezione impedisce
  l’avvio automatico della scrittura.

## Verifiche

- 13 nuove regressioni della sessione: QR/manuale, esclusioni, altri incarichi,
  storico/rimozione, sovrapposizione di scansioni, timeout, retry identico,
  revoca sessione, prenotazione mancante, capienza e conflitto.
- Browser originale → API originale → PostgreSQL temporaneo: codice manuale,
  USB e decoder QR reale, ingresso unico, contatori aggiornati, pulsante manuale
  conservato e funzionante anche dalla scheda riaperta dallo storico,
  rimozione/storico senza scritture implicite, risposta persa dopo commit SQL e
  retry con identico payload. Fotocamera a 320/390/844 px: scheda pienamente
  visibile oltre i primi due secondi, chiusura ritardata, latch,
  riavvio e assenza di overflow/errori runtime.
- Regressione temporale sui componenti originali con orologio browser controllato:
  scheda ancora visibile e opaca al 100% dopo nove secondi, chiusa dopo dieci;
  nuovo QR a nove secondi con timer indipendente; precedenti timer innocui su
  richieste pendenti/incerte, errori, famiglie e rimozioni. Retry riuscito con dieci
  secondi completi. Fotocamera 320/390/844 px e USB 1360 px, latch e nessun errore
  runtime.
- Regressione della fotocamera passata: arresto, cambio app, pagehide e
  interruzione dispositivo; callback obsolete, famiglie/minori, selezione scuola,
  richieste pendenti/incerte, revoca, conflitto e capienza. Passata anche la suite
  dello scanner condiviso dell’accoglienza generale.
- Browser iPhone/Android: Indietro/Avanti/ricarica, arresto camera, conferma di
  rimozione e retry identico della scrittura automatica dopo esito incerto.
- Sale collegate: riepilogo sotto la scheda/azioni, conteggi indipendenti,
  capienza raggiunta, errore RPC e recupero, aggiornamento dopo ingresso
  automatico e riavvio camera. L’errore di permesso RPC nel log è indotto
  intenzionalmente dalla regressione e recuperato ripristinando il grant locale.
- Suite SQL Forum/scuole e concorrenza passata nel medesimo ambiente temporaneo.
- Lint mirato sui file modificati e `git diff --check` passati.
- 1.163 test, TypeScript e build production passati in copia isolata da `npm ci`.
  Il checkout ha ancora la dipendenza preesistente `pdfkit` non installata:
  il primo test/typecheck locale fallisce per questo motivo. Il lockfile è stato
  riallineato solo nella copia temporanea, come nei precedenti collaudi;
  manifest e dipendenze del checkout non sono stati modificati.
- Lint generale: tre errori `no-explicit-any` e un warning preesistenti in
  `tests/ceremony-navigation.test.mts`.

Comandi delle verifiche dedicate:

```sh
AUTO_PANEL_TIMING_ONLY=1 PLAYWRIGHT_MODULE=/percorso/playwright/index.mjs node tests/browser/run-forum-event-reception.mjs
AUTO_PANEL_ENTRY_ONLY=1 PLAYWRIGHT_MODULE=/percorso/playwright/index.mjs node tests/browser/run-forum-event-reception.mjs
```

Nessuna prova su persone reali, scrittura operativa remota o email.
Commit e push di tutte le modifiche richiesti dall’utente il 25 ottobre 2026,
comprese le migration delle fasce orarie già applicate e documentate in
`accoglienza-fasce-orarie-2026-10-23.md`. Il normale push su `main` avvia il
deployment Git; il suo esito deve essere verificato separatamente.
