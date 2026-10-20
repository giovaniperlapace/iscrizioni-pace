# Elenco Iscritti: inclusione della lista d’attesa

Il pulsante Iscritti nella gestione Forum Admin/Manager apre anche la lista
nominale d’attesa, in una sezione distinta dai confermati. Include i soli minori
selezionati per quel Forum, mantenuti sotto l’adulto, in ordine di richiesta.
Le offerte valide riportano lo stato Posto offerto da confermare e la scadenza
in ora di Roma. Richieste concluse/scadute e iscrizioni inattive sono escluse;
un partecipante già confermato non viene duplicato nella coda.

Il totale dei posti prenotati continua a comprendere soltanto confermati e scuole.
Il download Excel conserva i fogli precedenti e aggiunge Lista attesa, con stato
e scadenza, oltre ai relativi contatori nel riepilogo. Dati riletti al download.

I controlli Admin/Manager, evento corrente e Forum precedono ogni lettura nominale.
Viewer, partecipanti e capigruppo restano esclusi. Letture paginate con errori
bloccanti, senza modifiche a RLS/RPC, prenotazioni, promozioni o notifiche.
Nessuna migration necessaria e nessuna scrittura operativa remota.

Verifiche: 997 test, TypeScript, lint e build production. Regressioni specifiche:
FIFO e famiglie, minori non selezionati, offerte scadute, richieste annullate,
iscrizioni eliminate, eventi/Forum estranei, 1.003 richieste e ultima pagina
fallita; Excel riletto e route export protetta. Browser componenti originali
Admin e Manager a 1440/390 pixel: elenco, stati, minori, totali distinti, link
export corretto, nessun overflow pagina o errore JS.

Verifica reale in sola lettura: nomi caricati correttamente dal nuovo loader,
conteggi riconciliati con le statistiche per tutti i Forum con coda: Forum 13
11 in attesa; Forum 4 5 in attesa e 2 offerte; Forum 5 4 in attesa (snapshot,
non valori permanenti). Nessun dato nominale riportato nel verbale.
Le pagine autenticate in produzione non sono state aperte con una sessione utente.
