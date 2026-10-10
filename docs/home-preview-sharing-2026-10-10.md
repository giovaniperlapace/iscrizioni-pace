# Condivisione riservata della home

Richiesta esplicita: link senza login, revocabile, con home pubblica invariata.
La pagina `/anteprima-home/[token]` riusa la home futura, compresi i Forum in
bozza aggiornati dal gestionale. Il form email è disabilitato e le iscrizioni
restano chiuse. Il link non conferisce ruoli e non espone persone o iscrizioni.

Token casuale di 32 byte, solo SHA-256 persistito; valido 30 giorni. RPC
`get_shared_home_preview` solo service_role, verifica revoca/scadenza/evento
corrente a ogni richiesta, con disponibilità aggregate dalla funzione canonica.
Risposte no-store, no-referrer e noindex. Token invalidi/scaduti/revocati: 404.
La revoca agisce nel DB e quindi anche sui deployment precedenti.

Admin globale: anteprima → Condividi anteprima. Creazione con nome, link
mostrato una volta e copiabile; elenco con scadenze e Revoca link. Manager,
Viewer e pubblico non possono gestire i link, anche via action diretta.

Migration applicate e registrate in transazione in production:
- 20261010120000_home_preview_shares: tabella RLS senza privilegi anon/authenticated,
  RPC service-only. Impronte delle 45 tabelle preesistenti invariate.
- 20261010121000_reserve_preview_group_slug: riserva il percorso anche per i link
  gruppo; nessuna collisione esistente. Impronte delle 46 tabelle invariate.

Backup custom verificato sul server, permessi 600:
`/tmp/iscrizioni-pace-before-home-shares-20261010.dump`.
Modalità corrente `internal` conservata. Creato soltanto il link di approvazione,
nessuna iscrizione, prenotazione, sessione o email.

Verifiche: 741 test, lint, TypeScript, build; PostgreSQL 17 temporaneo per privilegi,
invalidità, altro evento, aggiornamenti, disponibilità, revoca e scadenza.
