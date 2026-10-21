# Inaugurazione: sala reale, protocollo e assegnazioni Manager

## Configurazione concordata

Fonte: fotografia fornita dall'utente il 21 ottobre 2026 e precisazioni nella
conversazione. Inaugurazione del 25 ottobre, ore **16:30–19:00 Europe/Rome**,
Umbria Fiere, Padiglione 9 e sala collegata. Ammissibilità dalla presenza
comunicata nel pomeriggio del 25 ottobre, senza registrare ingressi.

Il palco è a sinistra dello schema, come nella fotografia. Le fasce A–E vanno
dal palco al fondo. Ogni fascia comprende sei blocchi da dieci file di dieci
sedie. I blocchi b1–b6 sono numerati da sinistra a destra **guardando il palco**:
perciò b1 è in basso nella fotografia. Le file interne 1–10 partono dal palco;
i numeri delle sedie crescono da sinistra a destra guardando il palco.

| Settore | Posti fisici | Posti assegnabili | Numerazione |
| --- | ---: | ---: | --- |
| A1 | 100 | 100 | Sì, blocco esterno sinistro guardando il palco |
| A centrale | 400 | 110 | Sì, 290 posti protocollo bloccati |
| A2 | 100 | 100 | Sì, blocco esterno destro guardando il palco |
| B1 | 300 | 300 | Prime cinque file di tutti i blocchi B |
| B2 | 300 | 300 | Ultime cinque file di tutti i blocchi B |
| C | 600 | 600 | Sì |
| D | 600 | 600 | Sì |
| E | 600 | 600 | Sì |
| F, sala collegata | 400 | 400 | Solo settore |
| H1 | 70 | 70 | Sette file da dieci, lato sinistro guardando il palco |
| H2 | 70 | 70 | Sette file da dieci, lato destro guardando il palco |
| **Totale** | **3.540** | **3.250** | **3.140 sedie nella piantina principale** |

Correzione definitiva dei posti disponibili di A, che supera l'indicazione
intermedia da 140 posti: **A-b2 file 9–10; A-b3/A-b4/A-b5 file 8–10**.
Le altre sedie centrali sono grigie e non selezionabili. La quota A non può
superare 110 neppure tramite una chiamata diretta. La geometria è uno schema
delle sedute: non riproduce impianti, uscite o dimensioni di sicurezza della sala.
La sala F è mostrata separatamente senza inventarne una disposizione interna.

## Percorso per gli operatori

Accesso da **Forum → Cerimonie → Inaugurazione**, riservato ad Admin e Manager
dell'evento corrente. Il Viewer non è incluso in questa apertura. Restano
separati i precedenti gate di collaudo delle viste capogruppo e personale.
La configurazione della finale resta indipendente e non viene creata.

1. In **Preparazione e quote**, scegliere una quota del settore, un gruppo e
   la quantità di posti. La dotazione occupa subito la quota; i nominativi
   vengono scelti in **Assegnazioni alle persone**, inclusi i figli.
2. Per un'assegnazione diretta, scegliere **Persona**, il partecipante e poi
   l'adulto o il singolo figlio. Ogni scelta consuma un solo posto; ripetere
   per gli altri figli che necessitano di una sedia. Funziona anche senza
   appartenenza a un gruppo e senza assegnare automaticamente un posto all'adulto.
3. **Scegli le sedie** apre la piantina sulla dotazione appena scelta. Riservare
   le sedie alla dotazione e abbinarle ai nominativi già assegnati. Il numero
   completa il posto quantitativo senza consumarne un secondo.
4. In **F** il settore completa l'assegnazione: non occorre riservare sedie
   numerate. I contatori non mostrano sedute numerate mancanti per questa sala.

La vista d'insieme mostra i 32 blocchi della sala principale e apre il dettaglio
del blocco. Selettore settore, ricerca e tabella accessibile restano disponibili.
Su telefono la piantina scorre nel proprio riquadro senza allargare la pagina.
L'editor Admin conserva bozze/versioni e consente di correggere le sedie; non
espone F nel generatore di file numerate. Una nuova versione deve rispettare
le sedie già impegnate e il limite quantitativo del settore.

## Implementazione e integrità

Migration `20261021180000_opening_ceremony_layout`:

- Settori con modalità numerata o solo quantitativa; il vincolo delle quote
  sulla piantina si applica ai soli settori numerati. F conserva capienza e
  limite quantitativo, senza creare 400 sedie fittizie.
- Identità storica del figlio nelle assegnazioni dirette; registro nominale
  condiviso con i gruppi. Una persona non può ricevere due posti nella stessa
  cerimonia. Revoca, storico, controllo di ammissibilità e protezione delle
  sedie già occupate sono conservati.
- RPC di preparazione solo Admin, evento corrente, nessuna sostituzione di
  una configurazione già esistente. Identità deterministiche delle sedie
  nella configurazione; nessuna assegnazione automatica a persone o gruppi.
- Pagine e azioni Manager verificano il ruolo nell'evento corrente prima del
  servizio; RPC ricontrollano i permessi. Nessuna apertura diretta delle tabelle.
- Lock/revisioni condivisi: due operatori sull'ultimo posto non possono
  superare la quota. Posti protocollo rifiutati anche dal database.

## Verifiche

- **1.031 test applicativi**, inclusi attivazione Manager, esclusione Viewer/
  evento estraneo, parsing dei figli e gate delle vere Server Action condivise.
- Lint, TypeScript e build production Webpack in copia temporanea senza
  credenziali reali, con dipendenze installate dal lockfile tramite `npm ci`.
- PostgreSQL temporaneo con tutte le migration: regressioni E1/E2/E3, 3.540
  posti fisici, 3.250 assegnabili, esatte file A, 290 posti bloccati, B1/B2,
  pubblicazione mista con F, adulto e figlio diretti, minore estraneo, duplicati,
  nominazione della sedia e permessi. Concorrenza Manager/Admin: una sola
  assegnazione sull'ultimo posto, un conflitto, un solo nominativo.
- Browser desktop/390px sui componenti originali e snapshot esportato dal DB
  sintetico: 32 blocchi, blocco A-b2 con 80 sedie disabilitate, selezione e
  conflitto, F senza numeri, payload del figlio, editor Admin, H1 da 70 sedie,
  assenza di overflow globale ed errori del browser. Le risposte dei comandi
  nella fixture UI sono sintetiche; l'integrità dei comandi è verificata in SQL.
- Riproduzione: `node tests/sql/run-opening-ceremony.mjs`, con opzione
  `--export-fixture=/percorso/fixture.json`; poi dev server in copia senza
  credenziali e `CEREMONY_FIXTURE_FILE=... PLAYWRIGHT_MODULE=... node
  tests/browser/opening-ceremony.mjs http://127.0.0.1:3139`.

## Applicazione in produzione

Backup custom completo, catalogo leggibile e lettura integrale verificati sul
server: `/root/backups/iscrizioni-pace/production-before-opening-layout-1792597311.dump`,
17.898.186 byte, SHA-256
`2b016f4a3faea9ba57f1706e28c8444db756d7f5993bfe3536eb0a737f75f82a`.

Migration applicata e registrata in un'unica transazione, dopo prova locale dello
stesso guard di conservazione: **68 tabelle e 182.310 righe canoniche invariate**;
proprietari e ACL delle **215 funzioni preesistenti**, ACL/RLS e policy conservati.

Configurazione reale creata successivamente tramite i comandi canonici Admin,
validata e piantina pubblicata in transazione, con audit del rilascio. Verificati
11 settori, 3.140 sedie in piantina, 290 bloccate e 3.250 posti nelle quote.
Nessuna dotazione, assegnazione nominale o presenza creata; nessuna email inviata.
Gli orari UTC memorizzati sono 15:30–18:00, equivalenti a 16:30–19:00 a Roma.

Il codice è pronto per la pubblicazione; identificativo del commit, deployment
ed esiti dei controlli sul dominio vengono registrati al completamento.
