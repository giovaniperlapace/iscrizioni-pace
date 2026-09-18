# Verifica dei limiti PostgREST — 18 settembre 2026

## Risultato

Il limite di 1.000 righe è applicato a ciascuna risposta, non alla dimensione
complessiva della tabella. Filtrare per account o iscrizione sul server resta
corretto anche quando l'evento supera tale soglia. Le letture di elenchi completi
richiedono invece paginazione; suddividere gli ID da solo non basta quando un ID
può avere molti record associati.

Audit delle query in `app`, `lib` e `proxy.ts`, delle chiamate Auth Admin e dei
percorsi RPC, includendo letture usate dalle azioni di modifica.

## Correzioni

- Monitoraggio in Impostazioni Admin: tutte le iscrizioni e gli errori email;
  QR, assegnazioni, contatti e supporto caricati in blocchi di 100 ID e pagine
  di 500. Evita anche richieste HTTP 414 per URL troppo lunghi.
- Campagne: selezione completa dei destinatari, anteprime, referenti e relative
  relazioni, anche oltre 1.000 righe per singolo blocco. Selezione/esclusione
  aggiornata con filtri di 100 chiavi. Prima delle scritture viene invalidato il
  test precedente: un errore intermedio non lascia la campagna pronta all'invio.
  Nessun cambiamento al worker, ai retry o agli esiti incerti delle consegne.
- Identità operative: profili, iscrizioni e contatti paginati e filtrati in
  blocchi; sincronizzazione degli ID con scritture limitate per richiesta.
- Ricerca di account Auth esistenti: scorre tutte le pagine da 500 utenti,
  interrompendosi alla corrispondenza o alla fine; errori distinti da assenza.
- Cataloghi, gerarchie, ruoli, membership e link nelle dashboard e nelle azioni:
  paginazione con ordine stabile. Anche il catalogo città e il resolver della
  città personale leggono l'elenco completo.
- Conservato il caricamento su richiesta delle sezioni Manager: la costruzione
  di una query paginata non deve eseguirla per sezioni che non la utilizzano.

## Percorsi già protetti o indipendenti dal totale iscritti

- Elenchi iscritti Admin/Manager/Capogruppo, statistiche, controlli duplicati,
  export/import e segnalazioni usano già paginazione e filtri per blocchi.
- Scheda personale corretta nel rilascio 8039a57: filtro account prima del limite.
- Accesso/sessione/proxy filtrano ruoli e membership per l'utente autenticato;
  non leggono tutti i ruoli degli iscritti prima di identificare l'account.
- Dettagli individuali, presenze, QR, contatti e aggiornamenti puntuali filtrano
  per iscrizione/account/chiave. Le famiglie sono limitate dal modulo; tali
  risposte non crescono con il numero totale di iscritti.
- Le anteprime recenti delle campagne (8) e le ricerche di esistenza (`limit(1)`)
  sono limiti intenzionali. Il worker reclama piccoli lotti tramite RPC; i
  riepiloghi e le mutazioni SQL agiscono nel database senza leggere un elenco
  PostgREST troncato prima di elaborarlo.

## Verifiche

- Fixture con 1.205 iscrizioni, account, destinatari e membership; query costruite
  dal client Supabase reale e risposte sintetiche con massimo 1.000 righe.
- Monitoraggio completo, filtri URI sotto 8 KiB, aggiornamento destinatari oltre
  la millesima riga, relazioni uno-a-molti oltre 1.000 righe, errori sulle pagine
  successive e interruzione delle scritture al primo errore.
- Verifica in sola lettura sul database reale: al controllo 1.071 iscrizioni
  attive, 1.118 persone inclusi figli, nessun QR mancante nel monitoraggio.
- Nessuna email inviata, nessuna iscrizione/account modificato, nessuna migration
  o modifica a RLS; testi e markup dell'interfaccia ordinaria invariati.

La paginazione REST non costituisce uno snapshot transazionale: modifiche
concorrenti possono cambiare gli elenchi tra pagine, come per i loader già
esistenti. Le operazioni atomiche di import e assegnazione restano nelle RPC.
