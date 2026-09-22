# P12 — scanner e ingresso evento

Implementazione locale del 2026-09-22 sul branch `codex/panel-p0-p10`, base
`e13d95a`. L’utente ha richiesto P12 e rinviato la revisione funzionale P11 al
collaudo del flusso completo su cellulare. Questa decisione non certifica la
chiusura delle prove P11 né delle prove hardware P12.

## Flusso

La dashboard `/dashboard/accoglienza` mostra l’evento corrente e l’incarico
**Registra ingresso evento** prima di qualsiasi lettura. L’intestazione resta
visibile durante lo scorrimento. Fotocamera predefinita, avvio esplicito per il
permesso del browser, preferenza posteriore e comando per passare all’anteriore.
Il codice manuale conserva la stessa azione. Per le scuole serve il QR (o il
suo contenuto); il codice pubblico di quattro caratteri è dei partecipanti.

- Singolo: verifica e ingresso automatico, con interblocco continuo tra le
  due richieste. L’esito positivo compare solo dopo la risposta alla scrittura.
- Famiglia: nessuna selezione automatica; si confermano i componenti presenti.
  In ingresso, gli altri check-in già esistenti sono conservati.
- Scuola: quantità esplicite, intere, entro il prenotato e con totale positivo.
  Un ingresso già esistente mostra ora e conteggi, senza sostituirli.
- Lo stesso QR resta bloccato anche dopo fotogrammi illeggibili, pause e cambio
  fotocamera. Un QR diverso procede automaticamente; una nuova lettura dello
  stesso QR richiede un comando esplicito con conferma.
- Correzione/annullamento sono in un percorso manuale separato: azione scelta
  prima del codice, nuova verifica, revisione corrente e conferma esplicita.
  Per annullare tutte le presenze usare Annulla ingresso selezionando i presenti:
  la RPC P11 non ammette una selezione familiare vuota.
- Risposta persa, errore di rete o attesa oltre 20 secondi: scanner e campi
  bloccati; retry dello stesso oggetto/comando e UUID. Una risposta tardiva non
  aggiorna l’interfaccia. Nessun retry automatico, nessuna coda offline.
- Sessione scaduta/incarico revocato: stop e ritorno all’accesso. Un conflitto
  richiede una nuova lettura. Nessun dato dell’ultima persona resta in vista
  dopo un codice invalido o un esito incerto.

La richiesta incerta è conservata **solo in memoria nella pagina**. Un avviso
`beforeunload` aiuta a evitare ricariche, ma il sistema operativo può chiudere
la scheda senza avviso. In quel caso verificare la presenza prima di ripetere
un ingresso; per correzioni serve sempre una nuova verifica. Non promettere
recupero dopo chiusura o crash del browser.

## Incarichi e autorizzazione

P12 rende esplicito il solo incarico `event_entry`. La fonte canonica resta
`event_user_roles`: `accoglienza` nell’evento corrente significa **accoglienza
EVENTO**; admin globale e manager hanno già autorizzazione server/DB. Non viene
introdotto un selettore fittizio di panel o un ruolo globale aggiuntivo.
La dashboard viene esposta solo se la sessione ha un incarico nell’evento
corrente. La regola preesistente che indirizza i manager alla sola dashboard
manager rimane invariata: per il collaudo UI usare admin globale o accoglienza.

Il nuovo contratto richiede `duty=event_entry`; altri incarichi, campi panel,
attore/evento inviati nel comando sono rifiutati. La pagina lega l’action
all’ID evento visualizzato: il server lo confronta con l’evento corrente, senza
usarlo come autorizzazione. Un cambio di evento richiede di riaprire la pagina.

Migration nuova `20260922220000_reception_event_duty.sql`:
`reception_event_check_in` è SECURITY INVOKER e accessibile solo a service_role.
Rifiuta incarichi diversi da `event_entry` e delega alla RPC P11, che ricontrolla
attore, ruoli ed evento corrente sotto lock a ogni operazione e retry. Restano
immutati audit atomico, protezione dei minori, idempotenza e revisioni P11.
Nessuna migration già applicata viene riscritta, nessuna riga di presenza o
assegnazione viene migrata. Il ruolo accoglienza esistente mantiene esattamente
il suo significato di ingresso evento.

**Vincolo per P13:** introdurre gli incarichi panel/sala come assegnazioni
separate, senza concedere `event_user_roles.accoglienza` a chi deve operare solo
su panel/sala. Il possesso di un incarico panel non deve mai diventare una
condizione sufficiente per chiamare questa RPC. Gli incarichi multipli e la
loro amministrazione specifica appartengono a P13; P12 ne vieta la selezione e
l’uso nel contratto evento.

## Fotocamera e dipendenze

`jsqr@1.4.0` è una dipendenza diretta, senza dipendenze transitive, caricata
solo all’avvio della fotocamera. Legge i pixel del video localmente: nessun
fotogramma viene salvato o trasmesso. Si invia al server solo il token opaco
tramite server action POST; non compare in URL, log o storage del browser.

Acquisizione senza audio, `playsInline`/muted per mobile, fotogramma massimo
960 pixel sul lato lungo e lettura ogni 250 ms. La camera viene chiusa al
cambio modalità, uscita dal componente, cambio camera, errore hardware e
passaggio in background. Un permesso accordato dopo l’uscita viene rilasciato
immediatamente. Tornando in primo piano si riavvia esplicitamente la camera.

Fonti tecniche: [jsQR](https://github.com/cozmo/jsQR) e
[getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
La fotocamera richiede HTTPS (localhost è un’eccezione locale); l’indirizzo
HTTP del computer in rete locale non è la procedura prevista per il telefono.

## Collaudo su telefono dopo pubblicazione staging

1. Applicare la sola nuova migration allo staging, verificarla, poi pubblicare
   il branch panel su Preview. Queste operazioni sono state autorizzate dalla
   richiesta successiva del 2026-09-22 «Puoi già preparare la preview»; la
   migration è applicata e verificata. Nessun rilascio production è compreso.
2. Aprire in Safari su iPhone e Chrome su Android la
   [dashboard staging](https://iscrizioni-pace-git-codex-pan-f98a13-giovaniperlapaces-projects.vercel.app/dashboard/accoglienza).
3. Usare un account operativo sintetico staging. Le email staging sono in
   modalità log: non presumere che un Magic Link arrivi nella posta personale.
   Preparare un accesso di test tramite la procedura amministrativa autorizzata;
   non copiare account o dati production. Aprire il link di accesso nello stesso
   browser del telefono, poi la dashboard Accoglienza.
4. Mostrare su un secondo schermo QR staging validi per singolo, famiglia e
   scuola; ripetere con stampe. Usare QR dello staging, non quelli production.
5. Avviare la fotocamera e consentire il permesso. Verificare: singoli consecutivi,
   QR fermo nell’inquadratura, famiglia parziale, scuola con quantità, già presente,
   codice invalido, fallback manuale, correzione e annullamento con conferma.
6. Provare camera anteriore/posteriore, permesso negato e recupero, luce scarsa,
   QR piccoli/grandi, passaggio a un’altra app e ritorno. Annotare modello,
   sistema operativo, browser e versione, supporto QR e risultato.
7. Provare rete lenta/interrotta durante una scrittura: esito da verificare,
   campi/scanner bloccati, retry identico e una sola presenza nel DB.
8. Con due operatori, verificare una correzione concorrente e la revoca del ruolo
   fra due scansioni. Una nuova lettura non deve operare dopo la revoca.

Almeno due dispositivi reali e una sessione autenticata end-to-end sono necessari
per chiudere la revisione P12. Le fixture browser e i test del decoder non
certificano messa a fuoco, permessi o prestazioni dell’hardware reale.

## Integrazione Git

Fetch eseguito: branch panel e upstream allineati a `e13d95a`. Pull non eseguito
perché il checkout contiene la cancellazione preesistente di
`presentazioni/novita-panel-assisi-2026.pptx` e la cartella `output/`; nessuna delle
due è stata modificata dal lavoro P12. L’upstream non contiene nuovi commit da
scaricare. `origin/main` a `9bdd098` contiene 25 commit non incorporati (201 file,
11 migration), inclusi email Postmark, presenze, minori e annullamento personale.
Il merge non viene mescolato alla P12 con lavoro estraneo non salvato; resta
obbligatorio il riallineamento e la regressione delle aree condivise prima del
rilascio. In particolare preservare la tutela P11 della storia dei minori nelle
funzioni di modifica introdotte da main, e riallineare esplicitamente lo staging
alle migration integrate. Nessuna applicazione automatica delle migration dati.

## Evidenze locali

- Suite completa: 345 test, inclusi 23 reception (server, macchina a stati e
  decoder). Il decoder legge realmente un PNG QR sintetico; stream simulato
  per abort, permesso tardivo e disconnessione. Lint e typecheck superati;
  rigenerati i tipi Next perché quelli preesistenti appartenevano a main.
- `node tests/sql/run-reception-checks.mjs`: PostgreSQL 17 temporaneo, migration
  canoniche e nuova P12, dati legacy conservati, ruoli e RLS P11, duty errate,
  evento estraneo, revoca prima di ingresso/retry, privilegi RPC. Concorrenza:
  8 ingressi famiglia e 8 scuola, 8 retry uguali (1 salvato/7 replay), due
  correzioni concorrenti (1 salvata/1 conflitto).
- Browser locale con il componente reale e backend/fotocamera sintetici della
  fixture: singolo automatico, QR mantenuto, famiglia con solo minore, scuola
  18+2, correzione confermata, fallback manuale, esito incerto e UUID identico
  nel retry, camera negata/recupero/cambio, sessione scaduta. Viewport desktop
  e 390×844, nessun overflow orizzontale, nessun errore console; titolo/esito
  verificati visivamente anche dopo scroll. La fixture resta in
  `tests/browser/reception-fixture.tsx`; il runner riutilizzabile
  `tests/browser/reception.mjs` è aggiornato, ma in questa sessione le azioni
  browser sono state eseguite tramite il browser integrato.
- Build ottimizzata con `npm run build:staging`, dopo rimozione della route
  temporanea. Il readiness check distingue staging e consegna email log.
- Nessun test end-to-end autenticato su Supabase remoto, nessuna scrittura
  remota, nessuna email inviata. Le prove hardware restano aperte.


## Preparazione preview autorizzata — 2026-09-22

Applicata e registrata soltanto allo staging la migration
`20260922220000_reception_event_duty.sql`. Copia temporanea senza i soli
BEGIN/COMMIT esterni, così DDL e registrazione restano nella transazione unica
del runner `psql -1`; aggiunti limiti locali di lock/esecuzione. Il file canonico
non è stato modificato. Schema pre-migration e fingerprint conservati nella
directory locale privata `/tmp/pace-p12-release`.

Corpo funzione identico al file, SECURITY INVOKER ed EXECUTE solo service_role
verificati. PostgREST risolve la nuova RPC e rifiuta correttamente la richiesta
senza attore (403/42501) e quella anonima (401/42501). HTTPS verificato tramite
SNI sul server staging, senza disabilitare la verifica del certificato.

`tests/sql/reception-p12-staging-rollback-check.sql` verifica incarichi estranei,
famiglia parziale, scuole, retry, conflitto, correzione, annullamento e audit,
conservando intenzioni e prenotazioni panel. Tutto il test viene annullato;
nessun account nuovo, ruolo o presenza di test rimane nel database. Conteggi/hash
invariati su tutte le 42 tabelle pubbliche, dopo migration e dopo collaudo.

La pubblicazione usa il push del solo branch `codex/panel-p0-p10`, con le sue
variabili Preview e alias esistenti. Le variabili Vercel sono di tipo sensitive:
la CLI ne elenca scope e date ma non restituisce i valori; l’export vuoto non
indica valori runtime mancanti. Nessuna variabile Vercel modificata. Production
e `main` rimangono esclusi. La revisione autenticata su telefono resta rinviata
al mattino seguente, come richiesto dall’utente.
