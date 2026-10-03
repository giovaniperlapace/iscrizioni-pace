# Prestazioni dashboard — 18 settembre 2026

Vincolo dell’intervento: testi, grafica, campi e comandi visibili invariati.
Nessuna migration, riscrittura dati, modifica ai permessi o invio email.

## Diagnosi e intervento

- La scheda Admin/Manager era selezionata esclusivamente dalla pagina server:
  sia l’apertura sia la chiusura con `edit` ricostruivano l’intera dashboard.
  Ora la selezione usa i dati già autorizzati e caricati nella tabella e la
  query string del browser. Link diretti, ricaricamento, cronologia, filtri,
  colonne e ordinamento restano disponibili. I link modificati per aprire
  un’altra scheda/finestra conservano il comportamento nativo.
- La stessa apertura locale vale nella vista Duplicati; la tabella condivisa
  resta montata anche quando presenta soltanto la scheda. Confronto,
  eliminazione e risoluzione dei duplicati mantengono i percorsi precedenti.
- Le presenze sono lette separatamente dopo l’apertura, con gli stessi testi,
  campi e azione di salvataggio. Il nuovo GET `/dashboard/participants/attendance`
  autentica la sessione, controlla ruolo ed evento, rifiuta iscrizioni eliminate
  e invia `Cache-Control: private, no-store` anche per gli errori. La chiusura
  annulla la lettura pendente; le risposte tardive non aggiornano altre schede.
  Ogni nuova risposta server rinnova il pannello, anche dopo un salvataggio.
- La chiusura della scheda capogruppo nasconde il contenuto tramite lo stato
  dell’URL. L’apertura continua a verificare sul server scope, QR e presenze.
  I link di iscrizione del gruppo si caricano solo quando il relativo strumento
  è aperto.
- Le dashboard caricano solo i dati necessari alla sezione: statistiche senza
  lo snapshot operativo completo, ruoli senza partecipanti, iscritti senza
  gerarchia completa/link/identità di tutti gli operatori. I gruppi mantengono
  i partecipanti e i referenti necessari ai conteggi e ai comandi già presenti.
- `loadRowsForIds` mantiene deduplica, blocchi da 100 ID, paginazione e ordine,
  ma legge tre blocchi alla volta. Gli errori interrompono le ondate successive
  e non restituiscono risultati parziali. L’effetto si estende a statistiche,
  export, controlli qualità, segnalazioni e caricamenti capogruppo che lo usano.
- La sincronizzazione dell’attività non riparte per ogni parametro transitorio:
  continua all’ingresso/cambio della sezione stabile e con l’intervallo di un
  minuto già previsto per tastiera/puntatore/scroll. Timeout e controlli della
  sessione restano invariati.

L’uso della cronologia nativa segue la
[documentazione Next.js](https://nextjs.org/docs/app/getting-started/linking-and-navigating#native-history-api).
Non viene introdotta una cache persistente di dati personali o autorizzazioni.

## Regione di esecuzione

Il deployment precedente `dpl_5uFprySANjKxA52LpzNj4wAYMpva` eseguiva le funzioni
in `iad1` (USA). I metadata ufficiali della VM database, letti via SSH senza
scritture, restituiscono `fsn1-dc14` (Falkenstein, Germania). `vercel.json` ora
fissa `regions: ["fra1"]`, Francoforte, secondo la
[configurazione regionale Vercel](https://vercel.com/docs/functions/configuring-functions/region).
La verifica del deployment deve confermare `fra1`; non si attribuiscono a questo
cambio i tempi del benchmark locale, che non misura la rete Vercel–database.

## Misure

Confronto locale prima/dopo sulla stessa fixture, 500 partecipanti, Admin e
Manager, un giro di riscaldamento e tre misure per dashboard. Server di sviluppo,
400 ms di attesa server sintetica identica per entrambi, completamento misurato
nel browser fino all’effettiva comparsa/scomparsa del dialogo:

| Operazione | Mediana prima | Mediana dopo |
| --- | ---: | ---: |
| Apertura scheda | 1028,5 ms | 97 ms |
| Chiusura scheda | 1095 ms | 47,5 ms |
| Navigazioni server per apertura + chiusura | 2 | 0 |

Sono misure comparative locali, non una garanzia di latenza della produzione.
Il testo estratto dalle schede prima/dopo coincide per entrambe le dashboard.
La build locale production conferma apertura 32–71 ms e chiusura 13–25 ms
su Chromium e WebKit, nelle due dashboard, con zero navigazioni server.

Lettura reale in sola lettura: 966 iscrizioni, 904 assegnazioni correnti, dieci
blocchi. Ordine alternato sequenziale/parallelo/parallelo/sequenziale:
661 / 618 / 353 / 586 ms. Medie: 623,5 ms sequenziale, 485,5 ms parallelo
(circa 22% in meno). Conteggio e SHA-256 dell’intero risultato ordinato identici
in tutte e quattro le letture. Nessuna scrittura eseguita dal benchmark.

## Collaudo e limiti

- Test di regressione sulle query realmente eseguite dalle pagine per sezione.
- Autenticazione, ruoli, evento estraneo, UUID non valido, dati mancanti, errore
  database e intestazioni private del nuovo endpoint.
- Blocchi fuori ordine, paginazione interna, ID duplicati, limite URL, errore in
  una lettura successiva e limite di tre richieste contemporanee.
- Fixture browser con componenti reali e dati sintetici, anche su build locale
  production: apertura/chiusura, Escape, Indietro/Avanti, URL diretto/ricarica,
  filtri/colonne, focus, permessi di sola lettura, mobile, errori presenze,
  riapertura e cancellazione di richieste pendenti.
- Le prove di scrittura utilizzano il trasporto sintetico delle fixture;
  non sono stati modificati partecipanti reali per collaudare i salvataggi.
- La copia di verifica viene creata da Git con `npm ci`, senza includere le
  due modifiche locali preesistenti al modulo d’iscrizione e al suo test.

Verifica finale: 340 test, lint completo, typecheck e build production superati.
Browser Chromium/WebKit desktop e mobile superati; salvataggi sintetici e
flussi duplicati superati; chiusura capogruppo e cronologia superati.

Comandi: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
Le fixture browser devono girare separatamente in una copia isolata, mai in
produzione. `dashboard-performance.mjs` monta e ripristina temporaneamente le
pagine Admin/Manager; richiede Playwright (anche dal runtime fornito da Codex).
Per provarlo su `next start`, montare la fixture prima della build.
