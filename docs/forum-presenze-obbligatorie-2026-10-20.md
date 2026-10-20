# Forum: presenza comunicata nella fascia richiesta

Per nuove prenotazioni personali e del capogruppo, inserimenti in lista d’attesa
e accettazioni di posti offerti, deve risultare `yes` per il giorno e la fascia
mattina/pomeriggio del Forum. La fascia usa la funzione canonica `panel_slot_key`:
orario Europe/Rome, mattina prima delle 12:00, pomeriggio dalle 12:00.

Una scelta storica per l’intera giornata vale per entrambe le fasce; una scelta
esplicita della singola fascia prevale. Nessuna scelta, `no` o giorni ancora
`unknown` bloccano l’operazione. La regola riguarda le presenze dichiarate,
non il check-in. I minori seguono la presenza dichiarata dell’iscrizione adulta.

Il controllo server/DB usa l’errore dedicato `PFA01`. Il percorso famiglia
controlla prima di modificare selezioni o prenotazioni. Trigger sulle tabelle
canoniche proteggono anche le RPC precedenti e le scritture dirette. Cancellazioni
e uscite dalla coda restano consentite; nessuna cancellazione retroattiva o
modifica automatica delle presenze. Un’accettazione rifiutata lascia intatta
l’offerta, con la sua scadenza originale di un’ora.

Le scuole usano le proprie prenotazioni e sono escluse. Nessuna modifica ai
loro moduli, alle quote o ai controlli di capienza.

Messaggi in sette lingue invitano a salvare prima le presenze e riprovare.
Nell’area personale il link apre la scheda di iscrizione con la sezione delle
presenze già espansa. Il capogruppo viene rimandato ai partecipanti filtrati
sul nome della persona, per aprirne la scheda e modificarne le presenze.

Verifiche in copia isolata dai lavori paralleli: suite applicativa (967 test),
nuovo test del messaggio e riesecuzione dei 14 test UI pertinenti; PostgreSQL
sintetico per mancanza/no/unknown, giorno e fascia errati, precedenza sulle
scelte storiche, salvataggio e successiva prenotazione, capogruppo, tentativi
tramite RPC precedenti e scritture dirette, coda e conservazione dell’offerta.
Suite completa scuole, vincoli classe e concorrenza superata. Browser sintetico
con componenti originali in sette lingue, desktop e mobile: messaggio, link,
editor espanso e assenza di overflow. Nessuna email o prenotazione reale di prova.

Lint, build production e TypeScript superati. Migration
`20261020170000_forum_attendance_required` applicata e registrata atomicamente
in produzione dopo backup custom verificato (12.981.070 byte; SHA256
`1cfaa7c47bdafab3adf71f18fcb648042aafa0b4910d8ddb78f0a9103d2402da`).
Confronto integrale prima/dopo: 64 tabelle, 134.521 righe e ACL/proprietari
delle 194 funzioni esistenti invariati. Lista d’attesa vuota; apertura Forum
`internal` conservata. Verifica autenticata su dati reali non eseguita.
