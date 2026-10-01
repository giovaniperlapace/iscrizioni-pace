# Partecipazione a un solo giorno

Nelle statistiche Admin/Manager/Viewer il riquadro separato «Partecipano solo
un giorno» compare in Gruppi e partecipanti e in Presenze. Il clic apre una
tabella con una riga per data del calendario, incluso il pomeriggio precedente
l'evento e le date a zero. Il totale non cambia gli indicatori esistenti.

Una persona è conteggiata quando le sue fasce di presenza dichiarate `yes`,
normalizzate sul calendario dell'evento, appartengono a una sola data. Basta
una mezza giornata; mattina e pomeriggio nella stessa data valgono una volta.
Righe duplicate e presenze storiche giornaliere seguono la normalizzazione
esistente. Date diverse escludono la persona, anche se ha una sola fascia
per ciascuna data. Presenze mancanti o dichiarate `unknown` sono escluse.
I figli accompagnati seguono il genitore e sono inclusi, come nelle altre
statistiche delle presenze; questa regola è indicata nel riquadro.

Ogni numero apre Gestione iscritti nella dashboard corrente, conservando
il formato del menu. Il parametro `stat` contiene `singleDay=YYYY-MM-DD`:
conteggio e filtro usano la stessa funzione. I dati sono filtrati prima della
paginazione della tabella. Il banner distingue persone e iscrizioni familiari;
i figli sono visibili sotto il genitore. Il percorso di esportazione esistente
riusa lo stesso parser e filtro. Date non valide o parametri duplicati sono
respinti anziché diventare un elenco senza filtro.

Nessuna nuova query: il caricamento paginato di gruppi/presenze legge già
le fonti necessarie. La categoria Presenze riceve soltanto i conteggi aggregati,
mentre il collegamento agli iscritti usa lo snapshot completo autorizzato.
Nessuna migration, scrittura dati, modifica permessi o email.

## Verifica

- `tests/single-day-attendance.test.mts`: unicità delle date, mezze giornate,
  figli, duplicati, presenze storiche, giorno precedente, sconosciuti, mancanti,
  risposte negative, date fuori calendario, conteggi e iscrizioni filtrate.
- `tests/statistics-loading.test.mts`: conteggi non nulli oltre mille iscrizioni
  negli snapshot completo, Gruppi e Presenze; niente nomi nel report aggregato.
- `tests/browser/single-day-attendance.mjs`: riquadro chiuso, apertura da tastiera,
  tabella giornaliera, link Admin/Manager, menu, mobile e tabella partecipanti
  reale con dati sintetici. La destinazione dei link viene riscritta soltanto
  nel collaudo verso la fixture locale dopo aver verificato gli URL originali.

## Esito locale del 1 ottobre 2026

Copia isolata con `npm ci` dal lockfile: 618 test superati con
`TZ=Europe/Rome`, lint, TypeScript e build production riusciti. I nuovi test
passano anche nel fuso America/El_Salvador; in quel fuso due test Excel
preesistenti sulle etichette delle date falliscono (giorno precedente), senza
coinvolgere il nuovo filtro o il formato UTC delle date nel riquadro.

Prova browser del nuovo flusso superata in entrambe le dashboard e categorie,
menu esteso/ridotto, desktop e mobile 390px, apertura da tastiera e clic verso
la tabella reale su dati sintetici. Controllo visivo dei riquadri e della tabella.
Le route di collaudo sono temporanee e rimosse a fine prova.
Queste verifiche precedono la richiesta di pubblicazione.
Anche la regressione browser della gerarchia dei gruppi è superata per entrambe
le dashboard: espansione ricorsiva, filtri esistenti e layout mobile conservati.

## Rilascio autorizzato del 1 ottobre 2026

Dopo la prova locale, l’utente ha autorizzato commit, push su main e il normale
deployment Vercel. Verifica del solo perimetro da pubblicare in una nuova copia
pulita basata su main, con npm ci dal lockfile: 599 test (TZ=Europe/Rome), lint,
TypeScript e build production superati. Il conteggio differisce dalla prova
precedente perché esclude i test delle altre modifiche locali ancora in corso.
Nessuna migration o scrittura sui dati richiesta dal rilascio.
