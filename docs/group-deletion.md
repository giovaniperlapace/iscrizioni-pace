# Eliminazione dei gruppi

> Aggiornamento rilascio 22 settembre 2026: migration applicata e registrata in
> produzione nella stessa transazione delle altre due attività, prima del push
> su main autorizzato. Controlli integrati: 439 test, lint, TypeScript, build,
> SQL e browser superati. Le indicazioni sotto sul mancato rilascio descrivono
> lo stato preparatorio. Verificate invarianza di 13 tabelle operative e RLS;
> la sola migration email ha scollegato 11 identità eliminate, con audit.
> Test incrociato: `psql -U postgres -v ON_ERROR_STOP=1 -f tests/sql/combined-operational-release.sql`
> esclusivamente in un database temporaneo vuoto.

Milestone del 22 settembre 2026. Implementazione locale, non ancora pubblicata.

## Comportamento

Il comando `Elimina gruppo` è nell’elenco Gruppi di Admin e Manager. L’apertura
locale non cambia URL, filtri o selezione. Una verifica server mostra conteggi
completi di sottogruppi, assegnazioni attuali/storiche, referenti, link e regole.
La conferma esplicita è obbligatoria. Il successo aggiorna l’elenco conservando
la query e mostra un messaggio; errori e conflitti richiedono nuova verifica.
Dialog nativo con focus confinato, ritorno al pulsante, Esc e controlli pendenti.
Il portal interrompe la propagazione del cambio checkbox, per non azionare i
filtri del modulo Manager che contiene il pulsante nella struttura React.
Testi nelle sette lingue.

Scelta esplicita dell’utente: cancellare il gruppo senza cancellare iscritti
o capogruppo. Vengono rimossi solo membership, link, regole e assegnazioni del
gruppo. Le iscrizioni correnti restano senza gruppo. Persone, account, ruoli
evento, registrazioni, figli, QR, presenze e incarichi su altri gruppi non sono
modificati. Le eventuali assegnazioni ad altri gruppi che riferivano questo
come origine storica mantengono il gruppo corrente; solo il riferimento
`escalated_from_group_id` viene azzerato. I precedenti collegamenti sono
salvati nell’audit atomico. Sottogruppi presenti bloccano la rimozione: vanno
prima spostati o eliminati individualmente, senza cancellazioni ricorsive.

## Database e autorizzazioni

`20260922180000_group_deletion.sql` introduce la RPC service_role-only
`manage_group_deletion`. L’attore proviene dalla sessione, mai dal browser.
La RPC verifica Admin globale oppure Manager dello stesso evento, anche per
l’anteprima. Capogruppo, viewer e Manager di altro evento sono esclusi.
Revoca DELETE diretto su groups a anon/authenticated; gli altri grant e le
policy esistenti restano invariati.

Lock del gruppo e dei collegamenti, impronta del contenuto, conflitto PT409
(non 40001) se la conferma è obsoleta. La cancellazione usa le FK esistenti e
l’audit è nella stessa transazione. Il controllo dei link canonici già in uso
permette il cascade soltanto quando il gruppo non esiste più.

La tabella privata `app.deleted_group_link_tokens` conserva soltanto gli hash
dei token rimossi. Un trigger impedisce di riutilizzarli con un altro gruppo:
ricreare un gruppo omonimo non riattiva vecchi URL distribuiti. Il generatore
esistente gestisce il conflitto 23505 proponendo il suffisso successivo.
Nessun token, hash o ciphertext entra nei conteggi o nell’audit applicativo.

La migration è preparata, non applicata in produzione. Applicarla e registrarla
prima del rilascio del codice, con le procedure atomiche esistenti. Non occorre
riscrivere gruppi o persone. Non eseguire eliminazioni di collaudo su dati reali.

## Esito del collaudo

Verificati 428 test, lint, typecheck e build production. SQL su PostgreSQL 17
temporaneo, incluse 1.205 assegnazioni e concorrenza reale fra sessioni; anche
il riuso concorrente di URL rimossi viene respinto. Browser sintetico nelle
sette lingue, desktop/mobile senza errori. Nessuna prova autenticata né
eliminazione su dati di produzione.

## Verifiche riproducibili

- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- In PostgreSQL temporaneo: `psql -v ON_ERROR_STOP=1 -f tests/sql/group-deletion.sql`.
  Usa un cluster usa e getta perché crea ruoli e tabelle di fixture. Verifica
  scope, grant, audit/rollback, conflitti, canonici, URL dismessi e integrità
  completa di persone/account/iscrizioni/QR/presenze/figli, anche con 1.205
  assegnazioni. Il fixture include il corpo del trigger canonico di produzione.
- Dopo il fixture, nel solo DB temporaneo con nome `group_deletion_*` e porta
  locale 55xxx: `node tests/sql/group-deletion-concurrency.mjs PORT DB_NAME`.
  Due sessioni reali verificano modifica concorrente e PT409, inserimenti
  concorrenti di figli, membership e assegnazioni contro il lock della DELETE.
- Separatamente dalla build e dal typecheck, avvia un dev server locale e lancia
  `node tests/browser/group-deletion.mjs http://localhost:3107`.
  Monta una route temporanea copiando il componente reale e sostituendo solo
  l’azione server con risposte sintetiche. Copre sette lingue, desktop/mobile,
  conferma, annullamento/focus, errori/conflitti, blocco sottogruppi, filtri e
  mancato invio del form contenitore. Rimuove la route alla fine.

La guida esterna è `docs/guida-gruppi.docx`, con sorgente leggibile in
`docs/guida-gruppi.md`. Sei pagine verificate tramite rendering, quattro tipi
creabili ed esempi, visibilità/link, referenti ed eliminazione.
