# Posti disponibili per le scuole — 20 ottobre 2026

Il modulo `/scuole` mostra un badge discreto per ogni Forum: «Posti disponibili
per le scuole: N», tradotto nelle sette lingue. La disponibilità è quella della
sezione scolastica, al netto dell'occupazione canonica (studenti e accompagnatori).
Non comprende le altre quote. Il controllo atomico all'invio rimane invariato;
il numero rappresenta la disponibilità al caricamento della pagina.

La nuova RPC `get_public_school_booking_options_with_availability` riusa il
catalogo canonico e i suoi gate senza sostituirlo. Espone solo il residuo scuole,
non capienza o occupazione delle altre categorie. I Forum esauriti restano
esclusi come prima. Il selettore docente, che non riceve questo dato, è invariato.

Verifiche: 986 test applicativi, lint, TypeScript, build production isolata con
npm ci; migration e regressioni SQL su PostgreSQL temporaneo. Verificati residuo
25 prima della prenotazione e 3 dopo 20 studenti + 2 accompagnatori, chiusura,
annullamento, concorrenza e vincoli di classe. Browser sulle pagine originali con
DB temporaneo: badge, iscrizione, modifica, annullamento, desktop/mobile e nessun
errore JS. Nessuna prenotazione o email reale di collaudo.

Migration `20261020234000_public_school_seats` applicata e registrata atomicamente
in production dopo backup custom verificato con pg_restore (catalogo e contenuti):
`/root/backups/iscrizioni-pace/production-before-school-seats-20261020.dump`.
SHA256: `963416b9678512a0291e03215ebdf79c683ef513f1b6f5450902fed0e591d962`.
Lettura READ ONLY come anon: 10 Forum con residui scolastici fra 5 e 250 posti.
Nessun cambiamento a prenotazioni, quote, apertura o permessi preesistenti.
