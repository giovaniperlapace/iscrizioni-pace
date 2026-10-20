# Contatore delle persone in attesa senza Forum nella stessa fascia

Sostituisce il riquadro riepilogativo Minori prenotati nelle statistiche Forum
Admin/Manager. Conta le persone uniche con almeno una richiesta attiva in lista
d’attesa per una fascia in cui non hanno alcuna prenotazione confermata.

La fascia è giorno Rome + mattina prima delle 12 / pomeriggio dalle 12, compreso
il Forum delle 17: stessa regola di app.panel_slot_key. Si confrontano tutti i
Forum dell’evento, senza limitare le prenotazioni alternative ai filtri visibili.
Il contatore è esplicitamente totale evento e resta tale applicando i filtri.
Una persona si conta una volta anche per più code/fasce scoperte. Una prenotazione
in un’altra fascia o giorno non la esclude. Adulti e soli minori selezionati sono
valutati individualmente; la prenotazione dell’adulto non copre automaticamente
un minore non selezionato. Offerte valide non ancora accettate sono incluse;
richieste concluse/scadute e iscrizioni annullate/eliminate escluse.

Le letture già paginate della coda sono riusate, senza interrogazione duplicata.
Il browser riceve solo il numero aggregato, entro gli stessi gate Admin/Manager;
nessun elenco nominale aggiuntivo, migration, scrittura operativa o invio.
I conteggi minori per singolo Forum restano disponibili.

Verifiche: 999 test, TypeScript, lint, build production; casi deduplicazione,
mezzogiorno/17:00, cambio giorno UTC/Rome, giorni distinti, prenotazioni alternate,
minori selezionati, offerte valide/scadute e richieste invalide. Browser originale
Admin/Manager a 1089 e 390 px: nuovo valore, filtri, nessun overflow/errori JS.
Confronto in sola lettura del loader con SQL indipendente basato su
app.panel_slot_key e app.panel_child_ids: 3 persone nello snapshot verificato.
Il primo snapshot precedente indicava 4, poi passato a 3 durante attività reale;
non è un valore permanente. Nessuna sessione autenticata production aperta.
