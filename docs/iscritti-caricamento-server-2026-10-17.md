# Caricamento iscritti — 17 ottobre 2026

## Intervento

La paginazione di `b12455c` limita già le righe renderizzate a 100. Il caricamento
precedente, però, arricchiva e trasferiva ancora tutte le iscrizioni a ogni apertura.
Il nuovo loader condiviso Admin/Manager/Viewer conserva gli stessi controlli,
testi, colonne e layout, trasferendo i dettagli della pagina richiesta e, quando
necessario, della singola scheda aperta tramite URL.

1. Un indice globale compatto resta sul server. Ricerca, filtri, ordinamento e
   conteggi vengono applicati prima della pagina, con le stesse regole JavaScript
   e lo stesso ordinamento italiano preesistenti. Le letture dell'indice sono
   ordinate e paginate a 500 righe, al massimo tre in parallelo, senza tetto al
   totale. Presenze previste, questionario, accessibilità, dettagli dei figli e
   note dei servizi vengono caricati solo per gli ID visibili. L'ordinamento su
   una colonna aggiuntiva legge la proiezione globale necessaria per quella colonna.
2. Nazionalità, associazione e delega email condividono una sola proiezione del
   questionario, anche nei loader completi delle viste speciali. Gli ultimi
   valori vuoti restano vuoti; la delega conserva la scelta esplicita storica.

Non è un `LIMIT 100` applicato a tutti i dati: l'indice globale rimane necessario
per mantenere esattamente ricerca, ordinamento e conteggi esistenti. Nessuna
migration, modifica di dati reali, email, nuova cache o variazione dei permessi.
Il sesso interno resta separato e viene letto per ordinare solo se la colonna è
effettivamente visibile e autorizzata; Viewer, eliminate e Senza gruppo esclusi.

## Integrità delle operazioni globali

- Filtri combinati, ricerca dei contatti, ordinamento e conteggi includono tutte
  le iscrizioni autorizzate dell'evento corrente, prima della paginazione.
- Il download Excel mantiene la route completa esistente. `participantPage` non
  limita l'esportazione; filtri e colonne autorizzate sono conservati.
- Statistiche e relativi approfondimenti, figli accompagnati, duplicati, scuole,
  gruppi, ruoli e altre sezioni non ricevono uno snapshot parziale della tabella.
- Schede personali/QR e i loro loader non cambiano. La scheda operativa tramite
  URL può essere aperta anche fuori pagina, ma sempre all'interno dell'evento
  autorizzato. I salvataggi continuano a ricaricare il risultato aggiornato.
- Cambio pagina, indietro/avanti, filtri non ancora inviati, colonne, ordine,
  apertura/chiusura scheda e indirizzo di ritorno conservano il contesto.
- Un errore di lettura interrompe il caricamento, senza mostrare un prefisso
  dell'elenco come se fosse completo. Nessuna soglia speciale a 1.000 o 5.000.

## Misure prima della pubblicazione

Confronto in sola lettura, dalla stessa macchina e sullo stesso evento reale:
3.935 iscrizioni principali e 163 figli. Loader originale estratto da `b12455c`,
confrontato campo per campo con il nuovo per prima pagina, ultima pagina e ricerca
di una persona fuori dalla prima pagina. Tutti i valori confrontati coincidono.

| Caricamento | Tempo | Richieste dati | Righe dettagliate | Snapshot JSON |
| --- | ---: | ---: | ---: | ---: |
| Originale completo | 7.868 ms | 393 | 3.935 | 12.837.282 byte |
| Nuova prima pagina | 2.283 ms | 18 | 100 | 347.393 byte |
| Nuova ultima pagina | 2.809 ms | 17 | 35 | 129.092 byte |
| Nuova ricerca puntuale | 1.973 ms | 17 | 1 | 24.442 byte |

Il conteggio originale comprende la lettura dell'evento; al nuovo loader l'evento
è già passato dalla pagina. Queste sono misure del loader, non del caricamento
completo del browser e non una prova di carico con utenti concorrenti.

Baseline browser di produzione, dopo la paginazione del collega: 3,72–4,71 s
di caricamento, circa 8,19 MB di documento decompresso, 100 righe renderizzate.
La verifica browser del nuovo rilascio viene registrata separatamente.

## Collaudo

- Installazione pulita dal lockfile; 960 test automatici, ESLint, TypeScript e
  build production superati.
- Fixture di 5.005 iscrizioni: prima/ultima pagina, filtri combinati, ricerca
  oltre la prima pagina, ordine globale, conteggi dei figli, esclusione di altri
  eventi/eliminate, pagine che si riducono, autorizzazioni e letture fallite.
- Excel reale generato e riletto: 5.005 iscrizioni più intestazione anche con
  `participantPage=51`; ricerca dell'ultimo record, colonne e dati dei figli.
- Browser con dati sintetici e componenti reali: Admin/Manager/Viewer, desktop
  e mobile, pagina 2/51, ricerca, filtri combinati, ordinamento discendente,
  preferenze salvate, filtri non inviati, cronologia, ricarica, scheda e chiusura,
  vista Senza gruppo e sola lettura Viewer. Nessun salvataggio su persone reali.

## Limiti e manutenzione

La quantità dei dettagli trasferiti rimane limitata alla pagina, anche oltre
5.000 iscrizioni; l'indice globale e gli ordinamenti su campi aggiuntivi crescono
con il totale. Non si promette quindi latenza costante o assenza di ogni futura
necessità di ottimizzazione. Per volumi molto maggiori si potrà spostare ricerca
e ordinamento nel database, verificando prima la parità delle regole linguistiche.
Le viste speciali e gli export completi possono richiedere più tempo della lista.
Come prima, letture REST successive non costituiscono uno snapshot transazionale
unico in presenza di modifiche concorrenti; non è stata introdotta una cache che
possa conservare dati vecchi tra richieste.
