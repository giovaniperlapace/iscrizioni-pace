# Esportazioni delle presenze per gruppo

La sezione **Esportazioni**, separata dalle statistiche nelle dashboard Manager e
Admin, offre quattro download XLSX. Anche il Manager Viewer dell’evento corrente
può scaricarli: sono aggregati in sola lettura. Capogruppo, accoglienza, utenti non
autenticati e operatori di altri eventi non possono accedere all’endpoint.

## Report e fonti

| Report | Criterio |
| --- | --- |
| A | Gruppo d’iscrizione corrente, con dettaglio dei singoli gruppi |
| A/2 | Come A, accorpando i raggruppamenti espliciti |
| B | Tag operatore, altrimenti servizio assegnato, altrimenti gruppo corrente |
| B/2 | Come B, accorpando i raggruppamenti espliciti |

Interpretazione di `Specifiche_report.docx` e `Gruppi_ZRT.xlsx`, ricevuti il
1 ottobre 2026. `Report_a.xlsx`, `Report_a2.xlsx`, `Report_a_sempl.xlsx` e
`Report_b.xlsx` sono esempi di formato, non fonti dei conteggi né dei nomi correnti.
Le due versioni complete A e A/2 soddisfano anche l’alternativa di fornire un
report parziale dei soli gruppi accorpati: non occorre un quinto report ridondante.

I nomi di gruppi e servizi sono sempre quelli del database al download, anche
quando il file originale usa un nome precedente. Nessun gruppo viene rinominato.
`assisi-2026.json` contiene i collegamenti per ID e la provenienza del raccordo:
118 corrispondenze esatte su 119 righe. Il nome dei Giovani per la Pace era stato
esteso nel catalogo; la sua zona Roma deriva dal padre reale, senza matching
approssimato e senza stampare il nome storico. I nodi Roma, Italia, Polonia e
Spagna fungono da radici delle zone coerenti con i gruppi mappati nel file.

Le sezioni sono Roma, Italia (eccetto Roma), Altri paesi, Associazioni-Vari e,
nei report B, Servizi. Sono visualizzate solo le righe con persone. Le persone
senza gruppo restano in una riga dedicata della sezione Da classificare.

## Conteggi

- Solo iscrizioni non eliminate dell’evento corrente; nessun filtro della tabella
  iscritti, limite di pagina, residenza o nazionalità condiziona questi report.
- Ogni persona conta una volta nel totale. I figli accompagnati sono inclusi,
  anche quelli storicamente maggiorenni, con le presenze del genitore.
- Per scelta esplicita dell’utente, i figli restano nel gruppo d’iscrizione;
  non ereditano servizi o tag di operatore del genitore.
- I servizi contano solo con stato `assigned`, anche se successivamente
  disattivati nel catalogo. Preferenze, proposte e rifiuti non spostano persone.
- Il collegamento operatore è quello della colonna Tag associato del raccordo.
  Prevale sul servizio. I tag sono confrontati con spazi esterni rimossi e senza
  distinzione maiuscole/minuscole, senza matching approssimato.
- Le fasce provengono dal calendario dell’evento e includono il pomeriggio
  precedente l’inizio. Le presenze storiche senza fascia valgono per entrambe
  le fasce effettivamente previste. Duplicati identici non aumentano i conteggi.
- Date non indicate significa nessuna fascia positiva nel calendario, comprese
  schede senza risposte o con presenza da comunicare. Una scheda con risposte
  soltanto negative rientra qui, coerentemente col riepilogo presenze esistente.
  La colonna non è il complemento di una singola fascia.
- Il totale delle persone non è la somma delle fasce. I subtotali e il totale
  generale sono formule Excel con valori calcolati già memorizzati, senza sommare
  contemporaneamente righe di dettaglio e subtotali.

## Raccordo e nuove edizioni

Ogni file contiene `Presenze`, con stampa A4 orizzontale su una pagina in
larghezza e più pagine in altezza, intestazioni ripetute, data e ora di Roma e
numeri di pagina, e `Raccordo`, con i nomi correnti, zone, raggruppamenti, tag e
stato. L’ID gruppo è conservato nella colonna F nascosta del foglio Raccordo,
fuori dall’area di stampa.

La configurazione è legata all’ID evento: non viene applicata a un’altra edizione.
Per un’edizione nuova aggiungere una configurazione e registrarla in
`presenceConfigForEvent`. Per aggiornare il raccordo modificare la configurazione
versionata, usando ID verificati nel catalogo; editare un Excel scaricato non
modifica il sito.

I nuovi discendenti ereditano la zona e l’eventuale raggruppamento del nodo
configurato più vicino. Nuove radici senza raccordo restano in Da classificare,
con avviso, senza sparire dai totali. Gli omonimi restano separati per ID.
Un tag `acc_` senza collegamento, un destinatario operatore mancante o più tag
diretti a gruppi diversi collocano la persona una sola volta in Da verificare.
Il programma non sceglie arbitrariamente tra operatori o servizi.

Al primo controllo del catalogo, 15 tag previsti dal raccordo non esistevano
ancora. Restano segnalati nel foglio Raccordo e non creano operatori; se aggiunti
con il nome previsto, saranno riconosciuti al download seguente.

## Implementazione e limiti

- `lib/presence-exports`: configurazione, loader minimo, aggregazione e XLSX.
- `app/dashboard/exports-section.tsx`: pulsanti condivisi, con PendingDownload
  e avanzamento/errori/retry esistenti. Nessun caricamento dei dati del report
  all’apertura della sezione: le letture partono al download.
- `/dashboard/manager/esportazioni?report=a|a2|b|b2&event=...`: autorizza la sessione
  e l’evento corrente prima di creare il client di servizio o leggere le persone.
  Un cambio di evento da una pagina vecchia restituisce 409. Nessuna cache privata
  riutilizzabile: tutte le risposte sono `private, no-store`.
- Tutte le fonti sono paginate a 500 righe, i filtri ID a blocchi di 100 e con
  concorrenza limitata. Un errore su qualsiasi pagina annulla l’intero download.
  Gruppi/servizi correnti multipli e gerarchie mancanti/cicliche bloccano il file.
- Vengono letti solo ID e dati necessari ai conteggi, senza nominativi, contatti,
  date di nascita, disabilità o sesso interno. Nessuna scrittura, migration,
  modifica delle assegnazioni o email.
- Le letture sono richieste distinte, come nelle statistiche esistenti: non è
  uno snapshot transazionale del database. Il file indica l’avvio dell’estrazione;
  quattro download separati possono differire se nel frattempo arrivano iscrizioni.
  Lo script CLI condivide la stessa lettura per tutti e quattro i file.

## Script e verifiche

```bash
node --env-file=.env.local scripts/export-group-presence.mts output/presence-exports
node --test tests/presence-exports*.test.mts
# In una copia locale isolata, dopo aver avviato next dev sulla stessa porta:
node tests/browser/presence-exports.mjs http://localhost:3149
```

Il CLI è amministrativo, usa le credenziali d’ambiente e non le stampa. Scrive
solo nella directory locale indicata; non modifica il database. Tenere gli
output operativi fuori dai commit.

I test includono conservazione dei totali tra A/A2/B/B2, figli, precedenza dei
tag, conflitti, nuovi gruppi, rinomine/omonimi, date mancanti, fasce storiche,
formule e stampa XLSX, etichette letterali contro formula injection, permessi
dell’endpoint e paginazione oltre 1.000 righe per tutte le fonti. La fixture
browser usa UI e generatore reali con dati sintetici, desktop/mobile, menu
compatto/esteso, Manager/Viewer/Admin, quattro download, errore e retry.

Verifica del 1 ottobre 2026: 619 test nella copia isolata con `npm ci`, fuso
`TZ=UTC` per la suite storica, lint, TypeScript e build production. I 36 test
mirati coprono esportazioni e navigazione. Fixture browser superata; i quattro
file reali riletti e ricalcolati con Artifact Tool senza errori di formula,
convertiti con LibreOffice incluso nel runtime e controllati visivamente.
I quattro file della stessa estrazione riportano 2.896 persone. È una fotografia
del collaudo, non un conteggio da mantenere fisso.

Le modifiche parallele a statistiche associazioni/presenze giornaliere sono
state conservate; la verifica integrata le include, ma non sono parte di questa
funzione. Commit/push su main e normale rilascio Vercel autorizzati dall’utente.
