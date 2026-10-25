# Cerimonie: selezione nominale Senza gruppo — 25 ottobre 2026

L’utente ha precisato: «Solo nominalmente con la possibilità di selezionarli
tutti». La voce **Senza gruppo** compare nel selettore **Gruppo per assegnazione
nominale** della modale settore Admin/Manager, per entrambe le cerimonie.

Si possono scegliere singoli nomi oppure tutti gli adulti disponibili, anche
oltre le pagine da 100 e i risultati della ricerca. I minori restano una scelta
esplicita. Le persone già assegnate o presenti in una bozza sono escluse dalla
selezione; il riepilogo contiene i nomi effettivi. Cambiare gruppo azzera la scelta.

## Implementazione

- La voce è virtuale: nessuna creazione di gruppi, membership o assegnazioni
  operative. Il lettore esistente usa `groupId: null, withoutGroup: true`.
- Il comando nominale `group_nominal` ammette `groupId: null` esplicito. Questa
  combinazione significa esclusivamente assenza di appartenenza corrente
  confermata; non consente riserve anonime per quantità.
- La migration `20261025140000_ceremony_without_group.sql` aggiorna la RPC
  canonica conservandone firma, ACL service-only, lock, revisione, audit,
  idempotenza, capienza e overbooking. Oltre al controllo del parametro,
  ricontrolla la membership di ogni iscrizione, compresi i minori, nel percorso
  usato sia dalla validazione delle bozze sia dalla pubblicazione.
- Se una persona entra in un gruppo dopo la selezione, salvataggio/pubblicazione
  restituiscono `ineligible`. La pubblicazione torna interamente indietro,
  incluse nomine, revisioni e coda email. Le appartenenze storiche non escludono.
- Bozze spostabili e rimovibili, assegnazioni personali e notifiche per iscrizione
  con minori al contatto adulto restano nel flusso esistente. La riga della bozza
  mostra «Senza gruppo · N nomi».

## Verifiche

- Suite completa: 1.136 test passati; successivamente aggiunto e verificato un
  ulteriore test del contratto, con tutti gli 8 test del file bozze passati.
- TypeScript, lint dei file modificati e `git diff --check` passati.
- `npm ci`, TypeScript e build production passati in copia isolata, senza env
  reali e con endpoint sintetici locali.
- Lint generale: tre errori `no-explicit-any` e un warning già presenti in
  `tests/ceremony-navigation.test.mts`, estraneo alla modifica.
- Tutte le migration, regressioni SQL cerimonie e prove di concorrenza passate
  su PostgreSQL temporaneo. Nuova prova: lettura, membership storica/cambiata,
  minori espliciti, bozze non visibili, spostamento, rollback della pubblicazione,
  notifiche personali, retry e rifiuto di nomi estranei/Viewer.
- Componenti originali, HTTP, azioni e SQL nel browser a 1440 e 390 px:
  selezione individuale, selezione totale oltre 100 iscritti anche con ricerca
  attiva, minori, salvataggio/rimozione, cambio gruppo e assenza di overflow.
  Passate anche le regressioni esistenti di bozze, quantità dei gruppi reali,
  pubblicazione, esito incerto, report, revoche e overbooking.
- Anteprime sintetiche: `/tmp/pace-ceremony-without-group-1440.png` e
  `/tmp/pace-ceremony-without-group-390.png`.

## Stato

Implementato e verificato in locale su `main`, allineato a `origin/main`
all’avvio. Modifiche preesistenti all’orario dell’accoglienza conservate.
Migration applicata e registrata in produzione il 25 ottobre su richiesta
esplicita dell’utente, che ha autorizzato anche commit e push.
Nessuna email o assegnazione reale effettuata nei test.

La migration è stata applicata prima del codice, in un’unica transazione con
registrazione e reload dello schema. Il wrapper di rilascio, verificato anche
su PostgreSQL temporaneo, controlla la definizione preesistente della RPC e
confronta dati, funzioni/ACL, proprietà, RLS, policy e trigger. Esito: **74 tabelle,
268.134 righe originarie e 242 funzioni/ACL conservate**, modificato soltanto il
corpo di `assign_ceremony_seats`. Nessun lock sulle tabelle operative aggiunto
per i confronti: snapshot transazionale repeatable-read e timeout conservativi.

Backup completo remoto: `/root/backups/iscrizioni-pace/production-before-ceremony-without-group-1792936103.dump`,
26.717.845 byte, permessi 600, elenco e lettura integrale `pg_restore` verificati.
SHA-256: `4e5020118e8a22dc76639bc47374ae6edb7cdc3ca23080ea4a6793f567087d5c`.
Il backup rimane sul server. Il codice precedente è compatibile con la nuova RPC.
Evidenze del rilascio in `output/cerimonie-senza-gruppo-2026-10-25/` (escluse da Git).
