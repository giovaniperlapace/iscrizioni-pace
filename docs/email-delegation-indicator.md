# Indicatore email delegata — 25 settembre 2026

La colonna Email delle tabelle Capogruppo e Manager/Admin/Viewer mostra un badge
localizzato «Email delegata al capogruppo» quando lo snapshot di inserimento
registra questa scelta. L’indirizzo personale attualmente presente ha precedenza.
L’assenza di email senza una scelta documentata resta «—».

La lettura usa soltanto gli ID delle iscrizioni già autorizzate, con batch e
paginazione e propagazione degli errori. Recupera esclusivamente origine e flag
contact dello snapshot, senza esporre identificativi del delegato o risposte
complete. Per gli inserimenti manager/admin, hasEmail=false e
useLeaderEmail=false rappresentano la consegna al referente del gruppo, come
previsto dal flusso assistito. Il badge descrive la scelta registrata e non
certifica la disponibilità attuale di un destinatario.

Nessuna modifica a dati, schema, permessi, invio email, contatti o export.
Le schede storiche incomplete restano leggibili.

Verifiche: test di classificazione, loader scoped/paginato e fallimenti, mapper,
render nelle sette lingue e precedenza email personale. Il test dashboard
controlla che la lettura sia attivata soltanto nella sezione iscritti.
Fixture browser `tests/browser/email-delegation.mjs`: tre tabelle, sette lingue,
desktop/mobile, dati sintetici e nessuna scrittura reale.

Rilascio autorizzato su main il 25 settembre: 541 test, lint, TypeScript e build
production con npm ci in copia pulita dell’ultimo commit a25fba9 più la sola
colonna email. Browser superato nelle sette lingue; export capogruppo simulato
conferma insieme badge email e overlay di caricamento al 25%. Componenti
dell’animazione e correzione dei conteggi conservati. Correzione separata degli
errori presenze lasciata fuori dal commit.
