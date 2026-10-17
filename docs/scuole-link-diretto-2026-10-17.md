# Scuole tramite link diretto — 17 ottobre 2026

Richiesta: rendere utilizzabile `https://registrationspeace.santegidio.org/scuole`
per le scuole, senza richiamo nella home e senza aprire le prenotazioni personali.
La pubblicazione dei singoli Forum resta indipendente dall’apertura generale.

## Comportamento e controlli

- `events.school_link_enabled` abilita il percorso scuola indipendentemente da
  `panel_access_mode`. Default false; la modalità generale open resta compatibile.
- Elenco limitato all’evento corrente pubblicato, entro la finestra iscrizioni,
  ai Forum pubblicati/pubblici, con location e categoria scuola attive e quota
  scuola con disponibilità canonica positiva. Capienza riletta al salvataggio,
  con lock e transazione. Il catalogo non espone capacità o identità di terzi.
- Gate separato in pagina, accesso, conferma, azioni docente e DB; nessun cambio
  al gate personale/capogruppo. Home senza link scuole anche nella futura versione
  programma. Metadati noindex/nofollow su tutto `/scuole`.
- Docente verificato: solo proprie prenotazioni e QR. RPC dedicata ai metadati
  dei Forum, senza aprire le tabelle pubbliche; conserva anche le prenotazioni
  proprie su Forum successivamente pieni/non pubblicati. Modifica, annullamento,
  audit, QR e quote restano canonici.
- Corretto il payload docente: `seat_section_id` richiesto dalla RPC. Concesso
  a service_role il get delle opzioni scuola, necessario all’azione pubblica.
- Quantità proposte per Forum derivate dai totali della classe; possibile ridurle
  singolarmente. Campi dei Forum non selezionati disabilitati.

## Verifiche

937 test applicativi nel workspace condiviso; 910 nella copia pulita del solo
rilascio. Lint, TypeScript e build production Webpack con npm ci superati. Revisione React: etichette, stato locale, selezione esplicita,
assenza di richieste dal componente quantità e di persistenza nel browser.

`node tests/sql/run-school-direct-link.mjs` crea un PostgreSQL temporaneo:
chiusura iniziale, apertura scuole soltanto, esclusione bozze/quote esaurite o
assenti, RLS docente/estraneo, chiusura/revoca, riduzione/annullamento, QR,
rollback del sovrannumero e richieste concorrenti sull’ultima disponibilità.

Con `--browser`, `SCHOOL_BUILD_DIR` (copia production con URL Supabase loopback)
e `PLAYWRIGHT_MODULE`: pagine e Server Action originali, trasporto Auth/REST
sintetico verso il DB temporaneo. Prenotazione, email in modalità log con QR,
conferma, pagina docente, modifica, annullamento, desktop/mobile, noindex,
assenza del link in home e assenza di errori browser. Non equivale a un invio
email reale o a un login production. Nessun dato reale usato nei test.

## Rilascio autorizzato

L’utente richiede esplicitamente l’abilitazione operativa del link. Migration
`20261017160000_school_direct_link` applicata e registrata atomicamente in
production: confrontati i valori di 63 tabelle, 110.398 righe invariate al netto
della nuova colonna false. Catalogo confrontato: solo funzioni/policy scuola,
nuova colonna e permesso get service-role previsti. Corpi precedenti verificati
prima della sostituzione. Staging e migration capogruppo parallela esclusi.

Backup custom completo verificato con pg_restore, permessi 600:
`/tmp/iscrizioni-pace-production-before-school-direct-1792236277850.dump`.
SHA-256 backup: `111baaa39eda5dbb7b7506c3993a6e349490b8053c775eb19134184c1686bc5c`.
SHA-256 migration: `9c4fb737c5ebfaa3e04a57de4ee5a7f632cfec4c535bb4979fcf6503b096c163`.

All’applicazione, apertura generale internal, catalogo pubblico vuoto,
zero prenotazioni scuola, 16 Forum pubblicati con disponibilità scuola.
Il nuovo flag resta false durante il rilascio del codice; attivazione separata
successiva al deployment, per il solo evento corrente, con audit dedicato.
Variabili Postmark di produzione presenti; segreti non esportabili dal pull.
Nessuna variazione alla configurazione email o invio reale di collaudo.
