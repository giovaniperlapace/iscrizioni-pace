# Anteprima, dimensione badge e sessioni — 27 ottobre 2026

## Diagnosi verificata

- L’anteprima delle campagne partecipanti restituiva HTTP 500 / `PGRST201`:
  PostgREST trovava due relazioni tra `participant_group_assignments` e `groups`
  (gruppo assegnato e provenienza dell’escalation). Riprodotto nel browser sulla
  rete Wi-Fi e nel caricamento server; non era un blocco del firewall.
- Tre email della cerimonia finale, create alle 09:00:15 ora Roma, erano
  `failed / preparation_failed`, prima di qualsiasi chiamata al provider.
  Ciascuna conteneva undici nominativi: PDF più immagini superavano 6 MiB.
  Dimensioni originali: 7.627.373, 7.574.967 e 7.642.067 byte.
- Le chiamate a `auth.signOut()` usavano lo scope globale predefinito Supabase.
  Un browser inattivo poteva quindi revocare anche le sessioni degli altri
  dispositivi. I log mattutini contengono `refresh_token_not_found`, ma non
  consentono di attribuire con certezza ogni episodio a questa causa.
- Le prove effettuate non dimostrano un blocco generale della rete dell’evento.
  I due ulteriori rifiuti Postmark 406 riguardano recapiti già soppressi per
  hard bounce e sono esclusi dal recupero richiesto.

## Correzioni

- La lettura canonica per anteprima/prova/consegna specifica il vincolo
  `participant_group_assignments_group_id_fkey`: usa il gruppo corrente,
  conserva gli errori bloccanti e non confonde il gruppo di provenienza.
- Le email personali della finale mantengono la qualità JPEG 95 finché
  rientrano nel limite. Oltre il limite rigenerano tutti i badge a qualità 85
  dai PNG originali, conservando 941 × 1672 pixel e crominanza 4:4:4.
  Ogni persona mantiene immagine CID e PDF con la stessa immagine incorporata;
  nessuna suddivisione, omissione di nominativi o rimozione di allegati.
  Il limite complessivo di 6 MiB e quello del trasporto rimangono obbligatori.
  Campagne ordinarie e PDF cumulativi dei capigruppo conservano i default.
- Inattività nel proxy, endpoint di attività ed «Esci» revocano esplicitamente
  la sola sessione corrente (`scope: "local"`). Restano invariati scadenza
  dopo 24 ore, pulizia cookie, controlli dei ruoli e nuovo accesso.
- Nessuna migration o modifica alle assegnazioni.

## Verifiche

- Copia pulita dei sorgenti da Git con sole modifiche del rilascio, `npm ci`.
- 1.233 test passati; regressioni su due relazioni al gruppo, errori di
  lettura, famiglie di undici persone nei tre colori, corrispondenza PDF/CID,
  qualità ordinaria invariata, duplicati e persistente superamento del limite.
- Esecuzione dei veri handler/proxy con autenticazione sintetica e due
  dispositivi: scadenza/uscita chiudono il corrente, conservando l’altro;
  la sessione attiva continua e il rinnovo magic link resta coperto.
- TypeScript, lint dei file modificati e build production passati.
  Il lint generale segnala solo tre errori
  `no-explicit-any` e un warning già presenti in
  `tests/ceremony-navigation.test.mts`, fuori da questo intervento.
- Lettura reale dell’anteprima corretta per il destinatario tecnico previsto;
  badge verde generato. Ispezione visiva del badge compresso sintetico.
- Preparazione senza invio dei tre messaggi reali: 22 allegati ciascuno,
  rispettivamente 3.800.197, 3.763.353 e 3.809.157 byte. Verificate tutte le
  33 nomine attive, recapiti personali disponibili e nessun altro messaggio
  per le tre iscrizioni nel medesimo piano.

## Recupero autorizzato

L’utente ha richiesto commit/push, produzione e recupero dei soli tre errori
di dimensione. Il recupero deve seguire il deployment READY del commit:
conservare una copia privata delle righe originali; ricontrollare stato,
assenza di accettazione e invii alternativi; riaccodare i soli tre identificativi.
La normale coda ricontrolla nomine e recapiti correnti nel claim atomico.
L’accettazione Postmark va distinta dalla consegna, senza reinvii automatici
di risultati incerti. Evidenze private e messaggi originali sono in
`output/wifi-diagnosi-2026-10-27/`, escluso da Git.
