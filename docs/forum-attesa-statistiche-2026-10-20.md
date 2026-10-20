# Lista d’attesa e disponibilità nelle viste Admin/Manager

Le viste Forum e statistiche mostrano persone in lista d’attesa (adulti e soli
minori selezionati), distinguendo la coda dalle offerte valide da confermare.
Il totale filtrato è una somma per Forum, non un numero di persone uniche.
Offerte scadute, richieste concluse e iscrizioni annullate/eliminate sono escluse.
Letture paginate e circoscritte all’evento; errori interrompono il caricamento.
Solo aggregati sono passati ai componenti. I gate Admin/Manager precedono le
letture con service client; nessuna nuova autorizzazione DB o client.

Lo stato, la percentuale e i posti prenotabili residui delle statistiche escludono
le quote ospiti e includono le offerte valide nell’occupazione. La capienza fisica
e il dettaglio delle quote restano visibili. Un Forum con soli posti ospiti liberi
è Pieno. Anche la gestione Forum indica Pieno a esaurimento delle quote prenotabili.

Verifica produzione in sola lettura alle 23:54 Europe/Rome: 20 persone in coda
(11 Forum 13, 6 Forum 4, 3 Forum 5), nessuna iscrizione attiva invalida; scheduler
con prossimo ciclo regolare. Forum 5 e 13 con quota iscritti completamente occupata;
Forum 4 con due posti liberati, da osservare al successivo ciclo automatico.
Il nuovo loader è stato eseguito sui dati reali e restituisce i conteggi attesi.

Verifiche: 994 test applicativi più test aggiuntivo di paginazione (501 richieste),
TypeScript, lint, build production; suite PostgreSQL temporanea completa:
FIFO, scadenza/claim a un’ora, minori, capigruppo, revoche, READ ONLY,
prenotazioni/claim/accettazioni concorrenti. Browser sui componenti originali
Admin/Manager, desktop 1440 e telefono 390: conteggi, stato, filtro, nessun overflow
orizzontale o errore JS. La verifica autenticata delle pagine production non è
stata eseguita. Nessuna migration o modifica operativa remota, nessun invio di prova.
