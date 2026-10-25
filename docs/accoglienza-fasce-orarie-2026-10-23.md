# Accoglienza Forum ed eventi: elenco per fascia oraria — 23 ottobre 2026

Regola concordata per il selettore degli incarichi (Europe/Rome):

- Forum del mattino: dalle 07:30 alle 13:30, anche quando iniziano più tardi.
- Forum del pomeriggio: dalle 13:30, compreso il Forum che inizia alle 17:00.
- Inaugurazione: dalle 13:30 nel giorno della cerimonia (anticipo richiesto il 25 ottobre).
- Finale: dalle 13:30 nel giorno conclusivo.
- Pomeriggio e cerimonie terminano la disponibilità 90 minuti dopo la fine
  registrata, senza oltrepassare la mezzanotte del giorno relativo.

Le finestre sono chiuse all’inizio e aperte alla fine: esattamente alle 13:30
scompaiono le scelte del mattino e compaiono quelle del pomeriggio/finale.
Date e orari derivano dagli eventi canonici, non dai titoli. La classificazione
mattino usa l’ora di inizio precedente alle 12:00 di Roma.

La lettura production del turno precedente ha verificato l’inaugurazione del
25 ottobre 16:30–19:00, i Forum del 26 e 27 ottobre e l’assenza di un piano
cerimonia finale. Senza piano, il selettore usa `events.ends_on` per il giorno
della finale e la rende disponibile dalle 13:30 fino a mezzanotte. Questo non
crea una cerimonia, non assegna posti e non consente ingressi senza i controlli
canonici: la configurazione operativa della finale resta distinta. Per una
inaugurazione ancora senza piano il giorno deriva da `events.starts_on`.

## Implementazione

Migration `20261023140000_reception_duty_windows.sql`: aggiorna soltanto i due
cataloghi RPC esistenti, conservandone ACL e ambito. Il catalogo completo resta
invariato nelle chiavi; aggiunge le finestre UTC con offset e l’ora server.
Nessun incarico viene revocato dal filtro orario, nessuna modifica a ingressi,
prenotazioni, assegnazioni o permessi. Pubblicare insieme a codice e migration.

Il selettore aggiorna il proprio orologio localmente al confine della fascia e
al ritorno alla scheda, senza polling o navigazioni. Il riferimento iniziale
è l’ora del database; il fuso del dispositivo non determina la fascia.
La ricerca si azzera quando cambia l’insieme degli incarichi disponibili.
Fuori fascia mostra l’assenza di incarichi e il prossimo orario, quando esiste.

Una postazione già attiva rimane montata, conservando scansione e conferma;
un avviso invita a concludere l’operazione e cambiare incarico. Alla successiva
scelta si applica l’elenco aggiornato. Cambiare modalità conserva l’incarico
se ancora disponibile; uno scaduto richiede una nuova scelta. Il collaudo con
QR fittizi resta sempre disponibile, senza limitazioni di orario.

## Verifiche e rilascio

Test unitari su confini, cambio giorno, orario di Roma dopo il cambio dell’ora
legale, date assenti/non valide e prossimo incarico. Suite SQL temporanea su
finestre, catalogo completo, finale non configurata e configurazione canonica.
Nessuna prova su ingressi reali. Al 23 ottobre migration e codice erano ancora
locali; rilascio production del 24 ottobre descritto sotto.

Verificati 1.076 test applicativi, lint dei file modificati, TypeScript e build
production. Browser originale con PostgreSQL temporaneo: regressione ingressi,
prenotazioni, camera, revoca e collaudo; selettore con orologio controllato a
1440/390px e fuso dispositivo America/New_York, cambio 07:30/13:30/14:00,
ricerca, fine evento, aggiornamento al focus e conservazione del codice inserito
nella postazione attiva. Nessun polling o chiamata operativa nel test di fascia.


## Rilascio autorizzato — 24 ottobre 2026

Su richiesta esplicita dell’utente di pubblicare anche i lavori Accoglienza,
applicate e registrate atomicamente in produzione le migration `20261023130000`
e `20261023140000`, prima del commit/push del codice. Backup completo conservato
sul server: `/root/backups/iscrizioni-pace/production-before-reception-1792842943.dump`, 23.135.145 byte,
SHA-256 `d1d6822dd7daca81896eff58ba17eb945ad42dc4ab544adcf4d6fa15c2af6607`.
Verificati indice del dump e decodifica completa con pg_restore; permessi 600.

Confronto nella stessa transazione su 74 tabelle: 232.670 righe originarie
conservate nella prima migration; sole aggiunte attese di 336 incarichi Forum,
1 incarico cerimonia e 52 voci audit per completare 54 operatori. La seconda
conserva tutte le 233.072 righe rilevate al suo avvio. Ruoli, prenotazioni,
ingressi, tabelle estranee, policy, trigger e ACL/proprietari di 239 funzioni
conservati; cambiano soltanto le tre definizioni previste. Controllo preventivo
delle definizioni originali e rollback automatico per differenze inattese.

Verifica della versione completa: 1.119 test applicativi, TypeScript, lint mirato
e build production in copia isolata da npm ci superati. Lint generale: restano
i problemi preesistenti in `tests/ceremony-navigation.test.mts` documentati nel
rilascio duplicati. Suite SQL/concorrenza e wrapper di rilascio verificati su
PostgreSQL temporaneo con dati sintetici; browser originale desktop/mobile,
assegnazione e secondo salvataggio, scanner, QR scuole, revoca e cambio fascia
superati. Il test attende il caricamento del catalogo prima del salvataggio
e l’esito effettivo prima di riaprire il modulo. Nessuna email o presenza reale
di collaudo. Commit e push su main autorizzati insieme al rilascio.

Lettura finale READ ONLY: entrambe le versioni registrate, 54 operatori senza
incarichi mancanti, 32 voci del catalogo con finestre valide e 52 audit del
completamento. Nessuna scrittura operativa per la verifica finale.

## Anticipo apertura — 25 ottobre 2026

Su richiesta, incarico inaugurazione disponibile dalle 13:30 Europe/Rome.
Migration `20261025130000_opening_reception_1330` applicata e registrata in
produzione: sostituisce soltanto l'orario nella funzione corrente, con guardia
sulla definizione attesa. Nessun cambiamento a incarichi, ingressi o altre fasce.
Cinque test delle finestre e suite SQL/concorrenza Forum/eventi superati su
PostgreSQL temporaneo; fixture browser allineata (browser non rieseguito).
Backup completo verificato tramite indice e decodifica pg_restore:
`/root/backups/iscrizioni-pace/production-before-opening-1330-1792928097952.dump`,
SHA-256 `41853f97a4f07e0cc901b543b101568da42cfe7b828af0f998a645b2d68dc49a`.
Lettura produzione conferma 25 ottobre 13:30–20:30 ora Roma.
Nessun deployment applicativo necessario; nessun commit/push eseguito.

## Anticipo incarichi del lunedì mattina — 25 ottobre 2026

Su richiesta esplicita di attivarli già per la spiegazione agli operatori,
applicata e registrata in produzione la migration `20261025180000`.
I dieci incarichi del 26 ottobre mattina (Forum 1–8 e sale collegate di 1/3)
sono selezionabili dal 25 ottobre alle 18:25 Europe/Rome; restano disponibili
attraverso la mezzanotte fino al confine ordinario del 26 ottobre alle 13:30.
La Cerimonia di Apertura conserva esattamente la propria fascia corrente,
25 ottobre 13:30–20:30. Pomeriggio, martedì, finale e altri eventi invariati.

L’eccezione è circoscritta all’UUID dell’evento e alla data canonica del 26
ottobre, solo per i panel con inizio prima delle 12:00 di Roma. Nessuna nuova
assegnazione, apertura pubblica delle prenotazioni, ingresso, email o modifica
di permessi. Non serve un deployment applicativo: gli operatori con la pagina
aperta devono ricaricarla per leggere il catalogo aggiornato.

Backup completo, indice e lettura integrale pg_restore verificati:
`/root/backups/iscrizioni-pace/production-before-morning-early-1792949214051.dump`,
27.408.728 byte, permessi 600, SHA-256
`5fa5649fb04b899b5945ac56828919c80efb51bb2e45e0b1e17ff65adb10ad11`.
Applicazione e registrazione nella stessa transazione REPEATABLE READ, con
confronto di tutte le 74 tabelle/274.094 righe, ACL e metadati di 242 funzioni,
policy e trigger. Solo il corpo previsto del catalogo cambia. Confronto completo
delle 32 voci prima/dopo: cambiano soltanto i dieci `availableFrom` attesi.

Sei test unitari delle finestre, lint mirato e suite SQL/concorrenza su
PostgreSQL temporaneo passati, compresa la nuova regressione sull’evento/data
esatti, sulle sale collegate e sul mancato effetto sugli altri eventi.
Lettura finale in produzione tramite il catalogo pubblico autenticato per tutti
i 55 operatori Forum: dieci incarichi mattutini disponibili e Apertura conservata.
Nessuna scansione reale di collaudo. Nessun nuovo commit/push in questo turno.
