# Cerimonie: bozze condivise e pubblicazione — 24 ottobre 2026

## Comportamento

Decisione confermata dall’utente: bozze condivise fra tutti gli Admin/Manager,
pubblicazione di tutte le bozze della sola cerimonia selezionata.

- La piantina apre la stessa modale del settore. «Salva assegnazione in bozza»
  salva una prova, senza un’ulteriore conferma e senza assegnazioni pubbliche.
  La ricerca globale, l’avviso famiglia 1 + x con nomi, i controlli e i retry
  rimangono. Le persone già in bozza sono riconoscibili nella ricerca.
- Le bozze si vedono sia nel settore sia nel riepilogo sopra la piantina.
  Si possono spostare tra settori, modificare le quantità ai gruppi o rimuovere.
  Gli altri Admin/Manager le leggono all’apertura o con Aggiorna disponibilità;
  nessun polling. I conteggi disponibili sottraggono anche le bozze condivise.
- Colori: viola per bozze, verde per posti pubblicati e nominativi, arancio per
  posti pubblicati ai gruppi ancora da abbinare, azzurro liberi, grigio protocollo.
  I quadratini rappresentano quantità di settore, non una sedia individuale.
  Quando il capogruppo abbina i posti, questi passano dall’arancio al verde.
- «Conferma posti e invia notifica ai partecipanti» spiega visibilità e notifiche. Il dialogo elenca
  destinatari, settori e quantità della cerimonia. Confermare pubblica tutto
  in una sola transazione; Annulla non modifica nulla. Se l’esito è incerto,
  il dialogo conserva richiesta, avviso e retry, senza permettere altre operazioni.
- Le assegnazioni già pubblicate restano tali. Sezioni nominali/gruppi e pop-up
  di revoca precedenti conservati, incluso Escape disabilitato nella revoca e
  modale del settore mantenuta aperta dopo il salvataggio.
- Il capogruppo continua a vedere soltanto i posti pubblicati: sette lingue,
  precedenza della presenza nella fascia canonica prima delle pagine da 100,
  minori espliciti, riepilogo, controlli e retry invariati.

## Selezione nominale del gruppo e report

La modale conserva le modalità persona/famiglia e quantità al gruppo e aggiunge
«Ai membri di un gruppo · assegnazione nominale». Si può scegliere ogni nome,
selezionare tutti gli adulti disponibili o includere esplicitamente tutti i
minori disponibili. I minori non vengono selezionati insieme agli adulti.
Ricerca locale sull’elenco completo, dopo il caricamento di tutte le pagine da
100 con verifica di revisione, totale e unicità; nessuna selezione parziale in
caso di errore. La selezione collettiva include anche i nomi nascosti dalla
ricerca. Nomi già assegnati/in bozza esclusi; assenti e sconosciuti selezionabili.
Riepilogo nominale con Rimuovi e avviso di capienza; chiusura/cambio gruppo
scartano i risultati tardivi. Pubblicazione ricontrolla l’appartenenza corrente.

Le bozze nominali di gruppo conservano il gruppo come ambito di selezione:
alla pubblicazione creano assegnazioni personali, senza consumare o aumentare
riserve. Producono email personali aggregate per iscrizione/famiglia, senza
email di abbinamento al capogruppo. Le quantità di gruppo conservano il percorso
con nomina successiva del capogruppo. Il dialogo di pubblicazione distingue
esplicitamente le due destinazioni.

Il report si apre dopo la pubblicazione o dal pulsante nel riepilogo della
cerimonia. Usa schede, bottoni, campi, tabella e paginazione nello stile delle
campagne esistenti: storico per pubblicazione, conteggi, ricerca nome/gruppo/email,
filtri per esito, pagine da 50, dettagli e CSV completo con protezione formule.
Indirizzo effettivo, oggetto e testo vengono salvati prima dell’invio; nessuna
ricostruzione da contatti correnti. Il report è privato/no-store e riservato ai
Manager/Admin dell’evento e della cerimonia autorizzati.

«Aggiorna report» rilegge il database. «Verifica consegne» consulta Postmark per
20 invii accettati alla volta, dai meno recentemente verificati, senza reinviare.
Si acquisiscono soltanto esito/data: MessageID, stream e indirizzo storico devono
corrispondere. Consegna al server distinta da accettazione API e da lettura;
rifiuti, fallimenti, esclusi e incerti restano distinti. Se il provider non è
disponibile si conservano gli esiti precedenti. Nessun polling né reinvio
implicito; nessuna modifica al webhook broadcast delle campagne.
Riferimento API: https://postmarkapp.com/developer/api/messages-api

## Dati e atomicità

Migration locale `20261024100000_ceremony_drafts.sql`. Tre nuove tabelle con
RLS e accesso riservato al service role: bozze, richieste idempotenti e coda
notifiche. Nessun aggiornamento dei dati preesistenti, nessuna riclassificazione
delle assegnazioni, estensione della RPC canonica di assegnazione con l’azione `group_nominal`,
senza cambiare i percorsi precedenti.

Le bozze sono separate da allocations/nominees: dashboard personali e
capogruppo, QR, ingressi, campagne e riserve pubblicate non le leggono.
La nuova RPC di lettura Manager aggiunge bozze e conteggi email allo snapshot
canonico. La lettura HTTP conserva private/no-store e verifica la stessa
revisione tra directory e piantina.

Ogni scrittura rilegge ruolo/evento, usa il lock canonico dell’evento e la
revisione attesa. Al salvataggio verifica la capienza includendo le altre bozze,
blocca doppie bozze nominali e usa la RPC canonica in una subtransazione
obbligatoriamente annullata per validare famiglia, destinatari, duplicati e
configurazione senza creare assegnazioni, audit canonici o riserve pubbliche.

La pubblicazione richiama la RPC canonica per ciascuna bozza e accoda le email
nella stessa transazione. Qualunque errore annulla anche le assegnazioni già
processate nel lotto. Famiglia cambiata, iscrizione non valida, duplicati o
capienza insufficiente richiedono revisione delle bozze. Anche eventuali
scritture sui percorsi canonici preesistenti vengono ricontrollate in questa fase.
Nessuna bozza consuma la riserva pubblicata di un gruppo. Dopo pubblicazione,
i posti personali restano distinti dai posti ricevuti dal gruppo.

Il fingerprint comprende evento, operatore, piano, revisione, operazione e
contenuto. Ripetere la stessa richiesta restituisce l’esito memorizzato senza
ripubblicare o ricreare email; riutilizzarla con altro contenuto viene rifiutato.
Le bozze rimosse/pubblicate rimangono archiviate, con audit delle operazioni.

## Email

- Una notifica per capogruppo coinvolto e pubblicazione, aggregando i suoi
  gruppi/settori. Include tutti i referenti con scope canonico, anche dai gruppi
  antenati; non soltanto chi sta eseguendo la pubblicazione.
- Una notifica per iscrizione con nuove assegnazioni nominali, includendo i
  minori al contatto dell’adulto. Risoluzione del contatto/delegato con le stesse
  regole correnti delle comunicazioni individuali; nessun indirizzo del minore.
- Titolo della cerimonia, data/ora Roma, sede, nomi e settori; per i gruppi anche
  quantità e invito ad abbinare i posti. Testi in sette lingue e HTML escapato.
- La migration e il salvataggio delle bozze non accodano email. Soltanto la
  pubblicazione crea le notifiche. Il cron email già autenticato le elabora,
  mantenendo indipendenti campagne, Forum e scuole.
- Claim persistente esclusivo prima dell’invio. Prima di preparare il messaggio
  vengono ricontrollati scope del capogruppo o nomine attive dell’iscrizione.
  Destinatario memorizzato prima della chiamata al provider. Esiti: in coda,
  in elaborazione, accettata dal servizio, fallita, incerta, non inviata.
  L’accettazione API non viene presentata come consegna confermata.
- Invii interrotti diventano incerti; fallimenti/incerti non vengono reinviati
  automaticamente. La dashboard mostra i conteggi, riletti con Aggiorna.
  Contatti mancanti diventano fallimenti espliciti; gruppi senza capogruppo
  vengono segnalati nel risultato della pubblicazione. Queste anomalie
  richiedono una verifica operativa, non un reinvio alla cieca.

Esempio italiano per un destinatario nominale:

> Oggetto: Il tuo settore per la cerimonia — Inaugurazione
>
> È stata pubblicata la seguente assegnazione. Il settore è disponibile anche
> nella tua area personale.
>
> Nome Cognome · Settore A

Esempio italiano per un capogruppo:

> Oggetto: Posti alle cerimonie da assegnare — Inaugurazione
>
> Sono stati pubblicati nuovi posti per i tuoi gruppi. Accedi a «Posti alle
> cerimonie» e assegnali nominalmente alle tue persone, scegliendo esplicitamente
> gli eventuali minori.
>
> Nome gruppo · Settore B · 20 posti

Entrambi includono cerimonia, data, sede e collegamento alla relativa dashboard.

## Verifiche

- 1.106 test applicativi superati; TypeScript superato.
- Lint dei file coinvolti superato. Lint generale: tre `no-explicit-any` e un
  warning `no-unused-vars` preesistenti in `tests/ceremony-navigation.test.mts`.
- Build production Webpack da `npm ci` in copia temporanea senza file `.env`
  né credenziali operative, con configurazione Supabase sintetica: superata.
- PostgreSQL temporaneo: tutte le migration e regressioni cerimonie; bozze
  invisibili nelle letture pubbliche, famiglia completa, duplicati, capienza,
  spostamento/quantità/rimozione, autorizzazioni/RLS/ACL, rollback della
  pubblicazione dopo un gruppo già elaborato, retry e claim email. Corse tra
  Manager/Admin sulle bozze e sulla pubblicazione: un salvataggio, un conflitto,
  una sola assegnazione. Nessuna modifica parziale o coda duplicata.
- Browser sui componenti originali, HTTP e Server Action con PostgreSQL
  temporaneo, 1440px/390px: salvataggio bozza con risposta persa e retry,
  modale riaperta vuota, spostamento, quantità gruppo, colori, riepilogo e
  annullamento pubblicazione, risposta persa dopo pubblicazione e retry senza
  duplicazioni, pop-up revoca con Escape disabilitato e settore ancora aperto.
  Nessun errore JavaScript o overflow orizzontale; letture HTTP finite.
- Regressione browser originale: famiglie, assegnazioni e revoche, risposte
  tardive, ripartizione gruppo 20/80, capogruppo in sette lingue; superata.
- Nuova verifica browser desktop/mobile: selezione di 105 membri su più pagine
  anche con ricerca attiva, adulti/minori separati, pubblicazione mista personale
  e gruppo, quattro notifiche esatte, report filtrabile e nessun overflow pagina.
- Test endpoint report: accesso negato, altro evento/piano, indisponibilità DB,
  conservazione degli snapshot, CSV protetto, verifica consegne senza reinvio.
- Trasporto email verificato con provider fittizio: nessun invio reale,
  accettazione distinta dall’incertezza, errori prima dell’invio, conferma DB
  persa, modalità log che non consuma la coda.

## Stato repository e rilascio

`main` riallineato da `91059bb` a `8c85d96` prima delle modifiche, conservando
integralmente i lavori locali sugli incarichi/fasce Accoglienza. Le modifiche
Accoglienza e le migration `20261023130000`/`20261023140000` restano estranee.

Il 24 ottobre l’utente ha autorizzato le migration necessarie, commit e push.
Migration `20261024100000` applicata e registrata atomicamente in produzione,
prima del push, con lo script del repository e guardie verificate anche sul
PostgreSQL temporaneo. Il corpo precedente della RPC è confrontato con l’hash
atteso; snapshot sotto lock e confronto nella stessa transazione: 71 tabelle,
226.514 righe e metadati/ACL delle 234 funzioni preesistenti conservati. Cambia
soltanto il corpo di `assign_ceremony_seats`; tre tabelle nuove vuote e tre
nuove RPC service-only. Nessuna migration Accoglienza inclusa.

Backup completo in infrastruttura, permessi 600, verificato con elenco e
decodifica integrale:
`/root/backups/iscrizioni-pace/production-before-ceremony-drafts-1792828032.dump`
(22.537.111 byte), SHA-256
`0784e892f2ed2933fc892b2e3b8fc28d405f16ae242c1bab1309f21d0dcbc6fd`.

Lettura live con il ruolo service e autorizzazione Admin canonica: inaugurazione
validata, otto settori, zero bozze/notifiche; registro migration presente.
Nessuna assegnazione/revoca, presenza o email reale di prova. Il nuovo percorso
non ripiega su assegnazioni dirette in caso di errore. Nessun recupero email
per assegnazioni preesistenti. Codice implementativo `7e58cb9`; push su main
tramite integrazione Git Vercel, con verifica del relativo deployment prima di
considerarlo disponibile. Il solo stato BUILDING non costituisce verifica READY.

## Correzione Postmark 300 — 24 ottobre

La chiave metadata `ceremonyPublicationEmailId` aveva 26 caratteri, oltre
al limite Postmark di 20. Riprodotto con `POSTMARK_API_TEST`, destinatari
sintetici e nessuna consegna: HTTP 422 / ErrorCode 300; la nuova chiave
`ceremony_email_id` restituisce HTTP 200 / ErrorCode 0. Identificativo e
contenuto delle notifiche restano invariati.

Il trasporto verifica preventivamente numero di campi (10), lunghezze
(20/80) e chiavi duplicate senza distinzione di maiuscole. Nessun troncamento
degli identificativi; payload invalidi rifiutati localmente anche nei batch.
Test di regressione sul percorso reale di preparazione, sia personale sia
capogruppo, e sui limiti del trasporto.

Verifiche: 1.111 test superati, lint mirato e build isolata da npm ci superati.
TypeScript generale incontra un errore estraneo in
`tests/participant-birth-place-column.test.mts:33` (TS2559), già presente
nel commit di partenza `f9fe067`; nessuna modifica a quel lavoro.
Nessuna migration necessaria. Lavori Accoglienza conservati.

Al controllo iniziale risultavano due notifiche `failed/postmark_300`, senza
message ID, accettazione o consegna. Il rilascio della correzione non modifica
le righe fallite, accettate o incerte: il recupero dei due rifiuti è separato.

Riferimento: https://postmarkapp.com/support/article/1125-custom-metadata-faq
