# Posti disponibili nel badge del catalogo pubblico

Il badge di stato nella home mostra, su una seconda riga in corpo piccolo,
«Posti disponibili: N» nelle sette lingue già previste. Rimossa la precedente
riga separata usata dall’anteprima. Il conteggio nell’area personale resta.

La nuova RPC `get_public_panel_program_with_seats` conserva il catalogo canonico
con i suoi filtri e aggiunge solo il totale dei posti individuali prenotabili:
capienza meno occupazione canonica (incluse le offerte), zero nelle sezioni con
coda in attesa, nessun posto scuola. Nessun dato personale esposto. Vecchia RPC
conservata; nessuna modifica a prenotazioni, ruoli o apertura.

Verifiche: lint e TypeScript, build production, 17 test applicativi, suite SQL
concorrenza su database temporaneo e test aggiuntivo `public-forum-seats.sql`
(parità catalogo, accesso anonimo, disponibilità, conteggio e chiusura).
Il test aggiuntivo è stato eseguito tramite una copia temporanea del runner,
per conservare le modifiche parallele al runner condiviso.

Migration 20261020233000 applicata e registrata atomicamente dopo backup custom
verificato con elenco e lettura completa:
`/root/backups/iscrizioni-pace/production-before-public-seats-20261020.dump`.
SHA256: `ce3615c6a9111d0da4d83094fcc7f4e302a5b9214fb6586161e494918e800a4a`.
Confronto transazionale: 67 tabelle / 135.637 righe e 202 funzioni preesistenti
(definizioni, proprietari e ACL) invariati. Conservati Forum open e scuole attive.
Nessuna prenotazione o email reale di collaudo.
