# Associazioni dichiarate nelle statistiche

In Statistiche → Gruppi e partecipanti, il riquadro Appartenenza ad associazioni
mostra il numero di iscrizioni attive dell'evento con un testo non vuoto nel
campo `externalGroupAssociation`. Il questionario attuale raccoglie il testo
libero, senza un boolean Sì/No separato: non si deduce l'appartenenza dai gruppi
operativi o dalle risposte sulle precedenti partecipazioni.

Il numero apre e chiude una tabella nella stessa pagina con nome e cognome,
presenze previste per data e fascia e testo dell'associazione. Nome mancante
segnalato; assenza di dichiarazioni di presenza resa come Da comunicare.
Calendario dell'evento incluso il pomeriggio precedente, senza duplicare fasce
né inventare mattine storiche. Testi trattati come testo, mai HTML.

Disponibile ad Admin, Manager e Manager Viewer autorizzati all'evento corrente.
Il loader è invocato dopo l'autorizzazione solo nella categoria territory.
Legge tutte le pagine degli ID attivi e solo il campo associazione del JSON;
fra versioni del questionario prevale la più recente (created_at e id), anche
se vuota. Nomi e presenze sono richiesti solo per le corrispondenze. La seconda
lettura controlla nuovamente evento e mancata eliminazione. Ogni iscrizione
vale una persona, senza figli accompagnati ereditati. Errori bloccanti: mai
conteggi parziali. Nessuna migration, modifica di dati, RLS o invio email.

Verifiche: tests/association-statistics.test.mts (oltre mille iscrizioni,
paginazione, batch, versioni, valori non testuali, presenze e fallimenti);
tests/dashboard-performance.test.mts (ruoli, evento estraneo, caricamento solo
nella categoria prevista). Fixture visiva in
tests/browser/association-statistics-fixture.tsx: collegarla temporaneamente
come pagina locale e rimuovere la route dopo la prova. Verificare numero,
apertura/chiusura da tastiera, stato vuoto e tabella mobile con scorrimento
orizzontale interno.


## Verifica del 1 ottobre 2026

Copia isolata da HEAD con i soli cambi di questa funzionalità, npm ci dal
lockfile: 593 test superati con TZ=Europe/Rome, lint, TypeScript e build
production superati. Con il fuso del Salvador, due test preesistenti delle
intestazioni data negli export falliscono di un giorno; i sei nuovi test
passano anche in quel fuso. Non modificata la logica degli export.

Browser con dati sintetici: conteggio, apertura e chiusura, tastiera e focus,
nomi mancanti, testo non interpretato come HTML, stato vuoto, desktop e mobile
390px senza overflow di pagina verificati. Route temporanea rimossa. Le altre
modifiche contemporanee nel workspace sono state preservate; questa verifica
isolata non ne certifica il rilascio.

L’utente ha autorizzato commit, push su main e normale deployment Vercel
il 1 ottobre 2026. Il rilascio comprende solo questa funzionalità; le altre
modifiche in corso rimangono locali. Configurazione email di localhost
corretta solo nel processo di sviluppo, senza modificare quella di produzione.
