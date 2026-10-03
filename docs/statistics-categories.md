# Statistiche per categoria

Le dashboard Admin e Manager (incluso Viewer già autorizzato alle statistiche)
mostrano una sola categoria alla volta. La barra superiore comprende Gruppi e
partecipanti, Presenze, Fasce di età e Iscrizioni per settimana. Senza parametro
`report`, o con un valore non riconosciuto, si apre Gruppi e partecipanti.

La categoria è nell'URL: ricarica e cronologia del browser la conservano.
Il cambio di categoria conserva il formato della sidebar; espanderla o
comprimerla conserva la categoria. Il collegamento Statistiche della sidebar
riapre la prima categoria. Link reali, focus da tastiera, aria-current e feedback
di navigazione condiviso; su mobile le voci vanno a capo. Prefetch disabilitato
per non richiedere in anticipo le categorie non selezionate.

## Caricamento

Autorizzazione ed evento corrente restano verificati prima delle letture.
`loadEventStatisticsSnapshot` conserva il comportamento completo preesistente
senza quarto argomento; i drilldown degli iscritti passano esplicitamente `all`.
Le pagine statistiche passano invece la categoria selezionata:

- Gruppi: iscrizioni e ID figli, gerarchia/assegnazioni correnti e presenze.
  Non legge nomi, residenza, nascite e date d'iscrizione.
- Presenze: iscrizioni e ID figli, presenze; niente gruppi/assegnazioni.
- Età: iscrizioni con nascite dei partecipanti e figli; niente presenze/gruppi.
- Settimane: soltanto ID e date delle iscrizioni non eliminate dell'evento.

Paginazione deterministica, batch degli ID ed errori bloccanti conservati.
I report aggregati non serializzano l'elenco delle persone verso il browser.
Gli snapshot parziali sono utilizzabili solo per la categoria richiesta:
le metriche non lette non vengono renderizzate né usate nei drilldown.
Nessuna migration, scrittura dati o modifica permessi.

## Verifica locale del 26 settembre 2026

Test di caricamento con oltre mille iscrizioni/gruppi, confronto dei conteggi
con lo snapshot completo, proiezione reale delle colonne nel provider sintetico,
assenza di richieste alle sorgenti inutilizzate ed errori nelle pagine successive.
Rendering di una sola categoria per Admin/Manager, menu esteso/ridotto, fallback,
collegamenti e indicazione della sezione corrente. Regressioni esistenti sui
permessi Manager/Viewer, pagine dashboard e statistiche.

Build production riuscita in copia isolata con npm ci dal lockfile; lint e
TypeScript superati. Browser locale: prima categoria con dati reali; tutte le
categorie con fixture sintetica e viewport mobile 390px, senza overflow di
pagina. La sessione reale è tornata alla login durante la navigazione: il giro
completo autenticato tra le categorie richiede un nuovo accesso dell'utente.
La route temporanea di collaudo è stata rimossa. Modifiche locali, non pubblicate.

## Disabilità e difficoltà dichiarate

Quinta categoria disponibile ad Admin, Manager e Manager Viewer dell'evento
corrente. Il server verifica lo scope prima che il loader legga dichiarazioni
o nominativi. Viewer può consultare i dati ma non modificarli.

Il loader dedicato legge gli ID delle sole iscrizioni attive dell'evento,
poi le dichiarazioni correnti usando le stesse tre opzioni boolean di
`accessibilitySummary`. Nomi e assegnazioni sono letti solo per le iscrizioni
con almeno una risposta esplicita `true`; richieste generiche di supporto,
risposte storiche ad altre domande o valori stringa non sono diagnosi implicite.
La seconda lettura delle iscrizioni verifica ancora evento e mancata eliminazione.
Nessuna attribuzione delle dichiarazioni ai figli accompagnati.

Gerarchia reale di iscrizione, inclusi nodi paese/città e gruppi superiori:
conteggi dei discendenti, omonimi distinti per ID, assegnazioni dirette e senza
gruppo conservate. Una persona con più dichiarazioni pesa una sola volta.
Il conteggio è un pulsante che filtra l'elenco nella stessa pagina e sposta
il focus sul titolo del risultato. Mostra tutte include anche i senza gruppo.
Tabella con nome, percorso del gruppo e tutte le difficoltà dichiarate.
Dati caricati soltanto quando si apre la categoria. Letture paginate/batched,
errori bloccanti e verifica integrità della gerarchia. Nessuna modifica dati.

Verificati 574 test, lint, TypeScript e build production in copia isolata con
le dipendenze installate da lockfile. Browser con dati sintetici: paese, città,
assegnazioni dirette, singolo gruppo, elenco completo, difficoltà multiple,
focus da tastiera e viewport 390px senza overflow della pagina (la tabella
ha scorrimento orizzontale interno). Fixture riutilizzabile in
`tests/browser/disability-statistics-fixture.tsx`; route temporanea rimossa.

Il box iniziale include anche i tre totali per difficoltà dichiarata, derivati
dalle chiavi booleane originali (nessun parsing delle etichette). Più risposte
incrementano i rispettivi contatori ma non duplicano il totale delle persone.
Categorie senza risposte a zero; nessuna query aggiuntiva rispetto alla sezione.

L'elenco consente filtri combinati per difficoltà e gruppo corrente esatto
(ID, con percorso completo e distinzione degli omonimi), incluso Senza gruppo.
Le tre intestazioni ordinano in entrambi i sensi con aria-sort. Indicatore
risultati, stato vuoto e Azzera filtri; apertura da un conteggio o Mostra tutte
azzera i filtri, conservando l'ordinamento. Filtri e ordinamento operano solo
sui dati già autorizzati, senza query aggiuntive. Verificati combinazioni,
risultati vuoti, reset e ordine decrescente nel browser con dati sintetici;
test dedicati, lint e TypeScript superati.

## Presenze del giorno precedente l'evento

Rimossa l'esclusione del giorno precedente da buildPeopleDetail: le statistiche
usano ora tutto il calendario del modulo, incluso il solo pomeriggio del
24 ottobre per l'evento del 25–27. Nessuna fascia mattutina inventata. Valori
storici giornalieri limitati alle fasce consentite, figli accompagnati inclusi,
nessun doppio conteggio; collegamenti agli iscritti filtrati conservati.
La fascia compare sia nel riepilogo Presenze sia nella tabella dei gruppi.
Confermata l'esistenza di dichiarazioni reali con lettura aggregata in sola
lettura. Regressioni su calendario, figli, presenze sconosciute e drilldown;
browser con dati sintetici e controllo del link del 24 pomeriggio.


## Collegamenti dai totali per difficoltà

I tre totali per tipo aprono Gestione iscritti nella stessa dashboard Admin o
Manager, mantenendo il formato del menu e mostrando la colonna Informazioni
sulla disabilità. Il filtro `stat` usa le chiavi delle dichiarazioni originali:
nessuna deduzione dai testi, nessuna attribuzione ai figli. Il banner esistente
identifica il filtro e permette di rimuoverlo. Le statistiche generali non
vengono caricate per questo tipo di drilldown.

L'Excel conserva lo stesso filtro anche quando la colonna disabilità viene
nascosta. Manager Viewer può consultare pagina e download; gli accessi fuori
evento e i filtri non validi sono respinti, con letture paginate e bloccanti su errore.
579 test, lint e TypeScript superati; build in copia isolata con lockfile.
Prova nel browser locale: clic sul totale Udito, apertura Gestione iscritti,
numero di righe corrispondente al totale e colonna delle difficoltà visibile.
Modifica locale, senza pubblicazione.


## Riquadri presenze compatti

Riepilogo e riquadri giornalieri con padding e spazi ridotti; celle numeriche
alte almeno 64px e valori ancora a 24px. Nei layout desktop le giornate con
una sola fascia occupano metà delle colonne delle giornate complete. Su mobile
ogni giorno usa tutta la larghezza disponibile. Conteggi e link invariati.


## Verifica per il rilascio del 26 settembre 2026

Commit, push su main e pubblicazione in produzione autorizzati dall'utente,
con inclusione dei riquadri presenze più compatti. Verifica finale in copia
isolata con dipendenze del lockfile: 579 test, lint, build production e
TypeScript superati. Browser desktop e mobile 390px: proporzioni dei riquadri,
leggibilità, link conservati e nessun overflow della pagina. Nessuna migration
né modifica dei dati; le note locali precedenti descrivono le fasi di anteprima.


## Manager Viewer: consultazione completa

Correzione richiesta dopo il rilascio: Manager Viewer può consultare tutte le
categorie, inclusa disabilità, nell'evento per cui è incaricato. Sono disponibili
anche drilldown, colonna difficoltà e relativo export. Non cambia alcun permesso
di modifica, inserimento, eliminazione o importazione. I precedenti riferimenti
all'esclusione del Viewer sono superati da questa indicazione dell'utente.

I loader della dashboard verificano lo scope dell'evento prima della lettura.
L'export verifica qualityAccess e legge le dichiarazioni con client server solo
per gli ID derivati dal risultato autorizzato, perché la policy SQL storica
riserva la lettura diretta delle dichiarazioni ai gestori. Nessuna modifica RLS,
ruoli o dati. Test degli accessi sull'evento corrente/estraneo e delle scritture
vietate conservati; fixture della tabella aggiornata per la sola lettura.
